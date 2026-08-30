import { nanoid } from 'nanoid';
import argon2 from 'argon2';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';
import type { CreateExperienceInput, UpdateExperienceInput } from '@letter/validation';

export class ExperienceService {
  async list(userId: string) {
    return prisma.experience.findMany({
      where: { userId },
      include: { theme: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getOne(id: string, userId: string) {
    const exp = await prisma.experience.findUnique({
      where: { id },
      include: {
        theme: true,
        sections: { include: { blocks: { include: { media: true }, orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } },
        media: true,
        memories: { include: { media: true }, orderBy: { order: 'asc' } },
        openWhenMessages: { orderBy: { order: 'asc' } },
        futureLetter: true,
        finalSurprise: true,
      },
    });

    if (!exp) throw new AppError(404, 'EXPERIENCE_NOT_FOUND', 'Experience not found');
    if (exp.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');

    return exp;
  }

  async create(userId: string, input: CreateExperienceInput) {
    const publicToken = nanoid(32);
    const exp = await prisma.experience.create({
      data: {
        title: input.title,
        recipientName: input.recipientName,
        eventType: input.eventType,
        eventDate: input.eventDate ? new Date(input.eventDate) : null,
        openingMessage: input.openingMessage ?? null,
        closingMessage: input.closingMessage ?? null,
        userId,
        publicToken,
      },
      include: { theme: true },
    });

    await auditService.log(userId, exp.id, 'EXPERIENCE_CREATED');
    return exp;
  }

  async update(id: string, userId: string, input: UpdateExperienceInput) {
    await this.assertOwnership(id, userId);
    const exp = await prisma.experience.update({
      where: { id },
      data: {
        ...input,
        eventDate:
          input.eventDate === undefined
            ? undefined
            : input.eventDate
              ? new Date(input.eventDate)
              : null,
      },
      include: { theme: true },
    });
    await auditService.log(userId, id, 'EXPERIENCE_UPDATED');
    return exp;
  }

  async delete(id: string, userId: string) {
    await this.assertOwnership(id, userId);
    await prisma.experience.delete({ where: { id } });
  }

  async publish(id: string, userId: string) {
    const exp = await this.assertOwnership(id, userId);
    if (exp.status === 'REVOKED') {
      throw new AppError(400, 'REVOKED', 'Cannot publish a revoked experience');
    }
    if (!exp.coverMediaId) {
      throw new AppError(400, 'COVER_REQUIRED', 'A cover image is required before publishing');
    }
    const updated = await prisma.experience.update({
      where: { id },
      data: { status: 'PUBLISHED' },
    });
    await auditService.log(userId, id, 'EXPERIENCE_PUBLISHED');
    return updated;
  }

  async unpublish(id: string, userId: string) {
    await this.assertOwnership(id, userId);
    const updated = await prisma.experience.update({
      where: { id },
      data: { status: 'UNPUBLISHED' },
    });
    await auditService.log(userId, id, 'EXPERIENCE_UNPUBLISHED');
    return updated;
  }

  async revoke(id: string, userId: string) {
    await this.assertOwnership(id, userId);
    // Rotate the public token so old links stop working
    const newToken = nanoid(32);
    const updated = await prisma.experience.update({
      where: { id },
      data: { status: 'REVOKED', publicToken: newToken },
    });
    await auditService.log(userId, id, 'EXPERIENCE_REVOKED');
    return updated;
  }

  async setPin(id: string, userId: string, pin: string | null) {
    await this.assertOwnership(id, userId);
    if (pin) {
      const pinHash = await argon2.hash(pin, { type: argon2.argon2id });
      await prisma.experience.update({
        where: { id },
        data: { pinEnabled: true, pinHash },
      });
      await auditService.log(userId, id, 'PIN_ENABLED');
    } else {
      await prisma.experience.update({
        where: { id },
        data: { pinEnabled: false, pinHash: null },
      });
      await auditService.log(userId, id, 'PIN_DISABLED');
    }
  }

  async setTheme(id: string, userId: string, themeId: string) {
    await this.assertOwnership(id, userId);
    const theme = await prisma.theme.findUnique({ where: { id: themeId } });
    if (!theme) throw new AppError(404, 'THEME_NOT_FOUND', 'Theme not found');
    return prisma.experience.update({ where: { id }, data: { themeId }, include: { theme: true } });
  }

  async assertOwnership(id: string, userId: string) {
    const exp = await prisma.experience.findUnique({ where: { id } });
    if (!exp) throw new AppError(404, 'EXPERIENCE_NOT_FOUND', 'Experience not found');
    if (exp.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');
    return exp;
  }
}

export const experienceService = new ExperienceService();
