import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { mediaService } from '../services/media.service';
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

    const authHeader = req.headers.authorization;
    let owner = false;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const jwt = await import('jsonwebtoken');
        const payload = jwt.verify(authHeader.slice(7), config.JWT_SECRET) as { userId: string };
        owner = payload.userId === media.experience.userId;
      } catch {
        owner = false;
      }
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

mediaRouter.use(authenticate);

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
