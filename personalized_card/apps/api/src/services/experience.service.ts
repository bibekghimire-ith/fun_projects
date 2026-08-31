import { nanoid } from 'nanoid';
import argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';
import { mediaService } from './media.service';
import { PUBLISH_ISSUE, evaluatePublishCheck, type PublishCheckInput } from './publishCheck';
import type { PublishCheck } from '@letter/types';
import type {
  CreateExperienceInput,
  PublishOptionsInput,
  UpdateExperienceInput,
} from '@letter/validation';

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

    // Media is returned in the same shape everywhere — with resolved urls —
    // so the client never has to know how storage paths are built.
    const withUrls = (m: Parameters<typeof mediaService.withUrls>[0] | null) =>
      m ? mediaService.withUrls(m) : null;

    return {
      ...exp,
      media: exp.media.map((m) => mediaService.withUrls(m)),
      sections: exp.sections.map((section) => ({
        ...section,
        blocks: section.blocks.map((block) => ({ ...block, media: withUrls(block.media) })),
      })),
      memories: exp.memories.map((memory) => ({ ...memory, media: withUrls(memory.media) })),
    };
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

  /** Everything the publish rules need, in one query. */
  private async loadPublishCheckInput(id: string): Promise<PublishCheckInput> {
    const exp = await prisma.experience.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        recipientName: true,
        coverMediaId: true,
        pinEnabled: true,
        pinHash: true,
        sections: { select: { enabled: true, blocks: { select: { enabled: true } } } },
        futureLetter: { select: { unlockDate: true } },
      },
    });
    if (!exp) throw new AppError(404, 'EXPERIENCE_NOT_FOUND', 'Experience not found');
    return exp;
  }

  /** Is this letter ready for someone to open? */
  async publishCheck(id: string, userId: string): Promise<PublishCheck> {
    await this.assertOwnership(id, userId);
    return evaluatePublishCheck(await this.loadPublishCheckInput(id));
  }

  async publish(
    id: string,
    userId: string,
    options: PublishOptionsInput = { allowWithoutCover: false },
  ) {
    const exp = await this.assertOwnership(id, userId);
    if (exp.status === 'REVOKED') {
      throw new AppError(400, 'REVOKED', 'Cannot publish a revoked experience');
    }

    const check = evaluatePublishCheck(await this.loadPublishCheckInput(id));
    // The cover is the only requirement a creator may deliberately waive —
    // a text-only letter is a real thing someone might want to send.
    const blocking = options.allowWithoutCover
      ? check.issues.filter((issue) => issue.code !== PUBLISH_ISSUE.MISSING_COVER)
      : check.issues;

    if (blocking.length > 0) {
      throw new AppError(
        400,
        'NOT_READY',
        'This letter is not quite ready to send yet.',
        { issues: blocking },
      );
    }

    const updated = await prisma.experience.update({
      where: { id },
      data: { status: 'PUBLISHED' },
    });
    await auditService.log(userId, id, 'EXPERIENCE_PUBLISHED');
    return updated;
  }

  /**
   * Deep-copy an experience as a fresh draft. Media rows are referenced, not
   * re-uploaded — the copy points at the same files. Responses, access logs and
   * the PIN are deliberately left behind.
   */
  async duplicate(id: string, userId: string) {
    await this.assertOwnership(id, userId);

    const source = await prisma.experience.findUnique({
      where: { id },
      include: {
        sections: { include: { blocks: { orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } },
        memories: { orderBy: { order: 'asc' } },
        openWhenMessages: { orderBy: { order: 'asc' } },
        futureLetter: true,
        finalSurprise: true,
        config: true,
      },
    });
    if (!source) throw new AppError(404, 'EXPERIENCE_NOT_FOUND', 'Experience not found');

    const copyId = await prisma.$transaction(async (tx) => {
      const created = await tx.experience.create({
        data: {
          userId,
          title: `${source.title} (copy)`,
          recipientName: source.recipientName,
          eventType: source.eventType,
          eventDate: source.eventDate,
          openingMessage: source.openingMessage,
          closingMessage: source.closingMessage,
          status: 'DRAFT',
          publicToken: nanoid(32),
          pinEnabled: false,
          pinHash: null,
          themeId: source.themeId,
          coverMediaId: source.coverMediaId,
          musicMediaId: source.musicMediaId,
          templateSlug: source.templateSlug,
        },
      });

      for (const section of source.sections) {
        await tx.experienceSection.create({
          data: {
            experienceId: created.id,
            title: section.title,
            order: section.order,
            enabled: section.enabled,
            blocks: {
              create: section.blocks.map((block) => ({
                type: block.type,
                order: block.order,
                enabled: block.enabled,
                content: block.content as Prisma.InputJsonValue,
                mediaId: block.mediaId,
              })),
            },
          },
        });
      }

      if (source.memories.length) {
        await tx.memory.createMany({
          data: source.memories.map((memory) => ({
            experienceId: created.id,
            date: memory.date,
            title: memory.title,
            description: memory.description,
            location: memory.location,
            order: memory.order,
            mediaId: memory.mediaId,
          })),
        });
      }

      if (source.openWhenMessages.length) {
        await tx.openWhenMessage.createMany({
          // openedAt is not copied: the sealed notes start sealed again.
          data: source.openWhenMessages.map((note) => ({
            experienceId: created.id,
            label: note.label,
            emoji: note.emoji,
            content: note.content,
            mediaId: note.mediaId,
            unlockType: note.unlockType,
            unlockDate: note.unlockDate,
            isOneTime: note.isOneTime,
            order: note.order,
          })),
        });
      }

      if (source.futureLetter) {
        await tx.futureLetter.create({
          data: {
            experienceId: created.id,
            title: source.futureLetter.title,
            content: source.futureLetter.content,
            unlockDate: source.futureLetter.unlockDate,
            mediaId: source.futureLetter.mediaId,
          },
        });
      }

      if (source.finalSurprise) {
        await tx.finalSurprise.create({
          data: {
            experienceId: created.id,
            question: source.finalSurprise.question,
            buttonText: source.finalSurprise.buttonText,
            successMessage: source.finalSurprise.successMessage,
            responseType: source.finalSurprise.responseType,
            options:
              source.finalSurprise.options === null
                ? Prisma.JsonNull
                : (source.finalSurprise.options as Prisma.InputJsonValue),
            mediaId: source.finalSurprise.mediaId,
            ctaText: source.finalSurprise.ctaText,
            ctaUrl: source.finalSurprise.ctaUrl,
          },
        });
      }

      if (source.config) {
        await tx.experienceConfig.create({
          data: {
            experienceId: created.id,
            navigationMode: source.config.navigationMode,
            showProgressBar: source.config.showProgressBar,
            enableConfetti: source.config.enableConfetti,
            musicAutoplay: source.config.musicAutoplay,
            musicVolume: source.config.musicVolume,
            locale: source.config.locale,
            dateFormat: source.config.dateFormat,
            copy: source.config.copy as Prisma.InputJsonValue,
            features: source.config.features as Prisma.InputJsonValue,
          },
        });
      }

      return created.id;
    });

    await auditService.log(userId, copyId, 'EXPERIENCE_CREATED', { duplicatedFrom: id });

    return prisma.experience.findUnique({ where: { id: copyId }, include: { theme: true } });
  }

  /** The final-surprise responses, oldest first, for the CSV export. */
  async listResponses(id: string, userId: string) {
    await this.assertOwnership(id, userId);
    return prisma.response.findMany({
      where: { experienceId: id },
      orderBy: { respondedAt: 'asc' },
    });
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
