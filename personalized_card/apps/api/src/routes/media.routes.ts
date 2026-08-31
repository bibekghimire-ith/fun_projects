import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/auth';
import { mediaService } from '../services/media.service';
import { experienceService } from '../services/experience.service';
import { config } from '../config/env';
import { prisma } from '../config/prisma';

export const mediaRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
});

mediaRouter.get('/media/:id/stream', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const media = await prisma.media.findUnique({
      where: { id: req.params.id },
      include: { experience: true },
    });
    if (!media) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
    }

    // Two ways to prove you may see a draft's media:
    //   1. a normal bearer token (used by fetch/XHR), or
    //   2. a short-lived media token in the query string — because an <img>,
    //      <audio> or <video> element cannot send an Authorization header, and
    //      the creator has to be able to see their own work before publishing.
    // The media token is scoped to one experience, so it cannot be replayed
    // against another, and it is not the account's access token.
    let owner = false;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(authHeader.slice(7), config.JWT_SECRET) as { userId: string };
        owner = payload.userId === media.experience.userId;
      } catch {
        owner = false;
      }
    }

    const mediaToken = typeof req.query.mt === 'string' ? req.query.mt : undefined;
    if (!owner && mediaToken) {
      owner = verifyMediaToken(mediaToken, media.experienceId);
    }

    if (!owner && media.experience.status !== 'PUBLISHED') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const useThumb = req.query.thumb === '1' && media.thumbnailPath;
    const key = useThumb ? media.thumbnailPath! : media.storagePath;
    const buf = await mediaService.readFile(key);
    res.setHeader('Content-Type', useThumb ? 'image/webp' : media.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Length', buf.length);
    res.send(buf);
  } catch (err) {
    next(err);
  }
});

/** Signs a token that unlocks one experience's media for direct element loads. */
export function signMediaToken(experienceId: string): string {
  return jwt.sign({ typ: 'media', experienceId }, config.JWT_SECRET, {
    expiresIn: `${config.MEDIA_TOKEN_MINUTES}m`,
  });
}

function verifyMediaToken(token: string, experienceId: string): boolean {
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as {
      typ?: string;
      experienceId?: string;
    };
    return payload.typ === 'media' && payload.experienceId === experienceId;
  } catch {
    return false;
  }
}

mediaRouter.use(authenticate);

/**
 * Hands the creator a token their <img> tags can carry as `?mt=`. Short-lived
 * and scoped to this experience only.
 */
mediaRouter.get(
  '/experiences/:id/media-token',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await experienceService.assertOwnership(req.params.id, req.user!.userId);
      res.json({
        success: true,
        data: {
          token: signMediaToken(req.params.id),
          expiresInSeconds: config.MEDIA_TOKEN_MINUTES * 60,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

mediaRouter.get('/experiences/:id/media', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await mediaService.list(req.params.id, req.user!.userId);
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
});

mediaRouter.post(
  '/experiences/:id/media/upload',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, error: { code: 'NO_FILE', message: 'No file uploaded' } });
      }
      const media = await mediaService.upload(req.params.id, req.user!.userId, req.file);
      res.status(201).json({ success: true, data: media });
    } catch (err) {
      next(err);
    }
  },
);

mediaRouter.post('/media/upload', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experienceId = String(req.body.experienceId ?? '');
    if (!req.file || !experienceId) {
      return res
        .status(400)
        .json({ success: false, error: { code: 'NO_FILE', message: 'File and experienceId required' } });
    }
    const media = await mediaService.upload(experienceId, req.user!.userId, req.file);
    res.status(201).json({ success: true, data: media });
  } catch (err) {
    next(err);
  }
});

mediaRouter.get('/media/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const media = await mediaService.getOne(req.params.id, req.user!.userId);
    res.json({ success: true, data: media });
  } catch (err) {
    next(err);
  }
});

mediaRouter.delete('/media/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await mediaService.delete(req.params.id, req.user!.userId);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});
