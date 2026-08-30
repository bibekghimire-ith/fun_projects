import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { prisma } from '../config/prisma';
import { config } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';
import { MediaType } from '@prisma/client';
import { getStorageProvider } from '../storage';

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_AUDIO_MIMES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac'];
const MAX_SIZE_BYTES = config.MAX_UPLOAD_SIZE_MB * 1024 * 1024;

function detectMediaType(mime: string): MediaType {
  if (ALLOWED_IMAGE_MIMES.includes(mime)) return 'IMAGE';
  if (ALLOWED_VIDEO_MIMES.includes(mime)) return 'VIDEO';
  if (ALLOWED_AUDIO_MIMES.includes(mime)) return 'AUDIO';
  throw new AppError(400, 'INVALID_MIME', `Unsupported file type: ${mime}`);
}

export class MediaService {
  private storage = getStorageProvider();

  async list(experienceId: string, userId: string) {
    const exp = await prisma.experience.findUnique({ where: { id: experienceId } });
    if (!exp || exp.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');
    const items = await prisma.media.findMany({
      where: { experienceId },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((m) => this.withUrls(m));
  }

  async getOne(id: string, userId?: string, allowPublished = false) {
    const media = await prisma.media.findUnique({
      where: { id },
      include: { experience: true },
    });
    if (!media) throw new AppError(404, 'NOT_FOUND', 'Media not found');
    const owner = userId && media.experience.userId === userId;
    const published = allowPublished && media.experience.status === 'PUBLISHED';
    if (!owner && !published) throw new AppError(403, 'FORBIDDEN', 'Access denied');
    return this.withUrls(media);
  }

  async readFile(storagePath: string): Promise<Buffer> {
    return this.storage.get(storagePath);
  }

  async upload(experienceId: string, userId: string, file: Express.Multer.File) {
    const exp = await prisma.experience.findUnique({ where: { id: experienceId } });
    if (!exp || exp.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    if (file.size > MAX_SIZE_BYTES) {
      throw new AppError(
        413,
        'FILE_TOO_LARGE',
        `File exceeds maximum size of ${config.MAX_UPLOAD_SIZE_MB}MB`,
      );
    }

    const mediaType = detectMediaType(file.mimetype);
    const ext = this.safeExtension(file.mimetype);
    const id = uuidv4();
    const filename = `${id}${ext}`;
    const storagePath = path.posix.join(experienceId, filename);
    await this.storage.put(storagePath, file.buffer, file.mimetype);

    let thumbnailPath: string | undefined;
    let width: number | undefined;
    let height: number | undefined;

    if (mediaType === 'IMAGE') {
      const info = await this.processImage(file, id, experienceId);
      thumbnailPath = info.thumbnailPath;
      width = info.width;
      height = info.height;
    }

    const media = await prisma.media.create({
      data: {
        id,
        experienceId,
        type: mediaType,
        originalName: path.basename(file.originalname).slice(0, 255),
        storagePath,
        thumbnailPath,
        mimeType: file.mimetype,
        size: file.size,
        width,
        height,
      },
    });

    await auditService.log(userId, experienceId, 'MEDIA_UPLOADED', { mediaId: id });
    return this.withUrls(media);
  }

  async delete(id: string, userId: string) {
    const media = await prisma.media.findUnique({
      where: { id },
      include: { experience: true },
    });

    if (!media) throw new AppError(404, 'NOT_FOUND', 'Media not found');
    if (media.experience.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');

    await this.storage.delete(media.storagePath);
    if (media.thumbnailPath) await this.storage.delete(media.thumbnailPath);

    await prisma.media.delete({ where: { id } });
    await auditService.log(userId, media.experienceId, 'MEDIA_DELETED', { mediaId: id });
  }

  private async processImage(file: Express.Multer.File, id: string, expId: string) {
    const optimizedKey = path.posix.join(expId, `${id}_opt.webp`);
    const thumbKey = path.posix.join(expId, `${id}_thumb.webp`);

    const optimized = await sharp(file.buffer)
      .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true });

    await this.storage.put(optimizedKey, optimized.data, 'image/webp');

    const thumb = await sharp(file.buffer).resize(400, 400, { fit: 'cover' }).webp({ quality: 75 }).toBuffer();
    await this.storage.put(thumbKey, thumb, 'image/webp');

    return {
      thumbnailPath: thumbKey,
      width: optimized.info.width,
      height: optimized.info.height,
    };
  }

  withUrls<T extends { id: string; thumbnailPath: string | null }>(media: T) {
    return {
      ...media,
      url: this.mediaUrl(media.id),
      thumbnailUrl: media.thumbnailPath ? `${this.mediaUrl(media.id)}?thumb=1` : null,
    };
  }

  mediaUrl(id: string) {
    return `${config.APP_BASE_URL}/api/media/${id}/stream`;
  }

  private safeExtension(mime: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/quicktime': '.mov',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'audio/ogg': '.ogg',
      'audio/mp4': '.m4a',
      'audio/aac': '.aac',
    };
    return map[mime] ?? '';
  }
}

export const mediaService = new MediaService();
