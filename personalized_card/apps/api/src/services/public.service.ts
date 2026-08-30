import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config/env';
import { isFutureLetterUnlocked, isOpenWhenUnlocked } from '../utils/unlock';
import { mediaService } from './media.service';

export class PublicService {
  signPinToken(experienceId: string) {
    return jwt.sign({ typ: 'pin', experienceId }, config.JWT_SECRET, { expiresIn: '12h' });
  }

  verifyPinToken(token: string | undefined, experienceId: string): boolean {
    if (!token) return false;
    try {
      const payload = jwt.verify(token, config.JWT_SECRET) as {
        typ?: string;
        experienceId?: string;
      };
      return payload.typ === 'pin' && payload.experienceId === experienceId;
    } catch {
      return false;
    }
  }

  async getExperience(token: string, ipAddress?: string, userAgent?: string, pinToken?: string) {
    const exp = await prisma.experience.findUnique({
      where: { publicToken: token },
      include: {
        theme: true,
        sections: {
          where: { enabled: true },
          include: {
            blocks: {
              where: { enabled: true },
              include: { media: true },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
        memories: { include: { media: true }, orderBy: { order: 'asc' } },
        openWhenMessages: { include: { media: true }, orderBy: { order: 'asc' } },
        futureLetter: { include: { media: true } },
        finalSurprise: { include: { media: true } },
      },
    });

    if (!exp) throw new AppError(404, 'NOT_FOUND', 'Experience not found');
    if (exp.status !== 'PUBLISHED') {
      throw new AppError(403, 'UNAVAILABLE', 'This experience is not available');
    }

    if (exp.pinEnabled) {
      const ok = this.verifyPinToken(pinToken, exp.id);
      if (!ok) {
        return {
          pinRequired: true as const,
          title: exp.title,
          recipientName: exp.recipientName,
          theme: exp.theme,
          publicToken: exp.publicToken,
        };
      }
    }

    if (ipAddress) {
      const ipHash = createHash('sha256')
        .update(ipAddress + config.COOKIE_SECRET)
        .digest('hex');
      await prisma.experienceAccess.create({
        data: { experienceId: exp.id, ipHash, userAgent: userAgent?.slice(0, 500) },
      });
    }

    const mapMedia = (m: Parameters<typeof mediaService.withUrls>[0] | null) =>
      m ? mediaService.withUrls(m) : null;

    return {
      pinRequired: false as const,
      id: exp.id,
      title: exp.title,
      recipientName: exp.recipientName,
      eventType: exp.eventType,
      eventDate: exp.eventDate,
      openingMessage: exp.openingMessage,
      closingMessage: exp.closingMessage,
      theme: exp.theme,
      coverMedia: exp.coverMediaId
        ? await prisma.media
            .findUnique({ where: { id: exp.coverMediaId } })
            .then((m) => (m ? mediaService.withUrls(m) : null))
        : null,
      musicMedia: exp.musicMediaId
        ? await prisma.media
            .findUnique({ where: { id: exp.musicMediaId } })
            .then((m) => (m ? mediaService.withUrls(m) : null))
        : null,
      sections: exp.sections.map((s) => ({
        ...s,
        blocks: s.blocks.map((b) => ({ ...b, media: mapMedia(b.media) })),
      })),
      memories: exp.memories.map((m) => ({ ...m, media: mapMedia(m.media) })),
      openWhenMessages: exp.openWhenMessages.map((msg) => {
        const unlocked = isOpenWhenUnlocked(msg);
        return {
          id: msg.id,
          label: msg.label,
          emoji: msg.emoji,
          unlockType: msg.unlockType,
          unlockDate: msg.unlockDate,
          isOneTime: msg.isOneTime,
          isUnlocked: unlocked,
          ...(unlocked ? { content: msg.content, media: mapMedia(msg.media) } : {}),
        };
      }),
      futureLetter: exp.futureLetter
        ? {
            id: exp.futureLetter.id,
            title: exp.futureLetter.title,
            unlockDate: exp.futureLetter.unlockDate,
            isUnlocked: isFutureLetterUnlocked(exp.futureLetter.unlockDate),
            ...(isFutureLetterUnlocked(exp.futureLetter.unlockDate)
              ? {
                  content: exp.futureLetter.content,
                  media: mapMedia(exp.futureLetter.media),
                }
              : {}),
          }
        : null,
      finalSurprise: exp.finalSurprise
        ? { ...exp.finalSurprise, media: mapMedia(exp.finalSurprise.media) }
        : null,
    };
  }

  async verifyPin(token: string, pin: string) {
    const exp = await prisma.experience.findUnique({ where: { publicToken: token } });
    if (!exp || exp.status !== 'PUBLISHED') {
      throw new AppError(404, 'NOT_FOUND', 'Experience not found');
    }
    if (!exp.pinEnabled || !exp.pinHash) {
      return { verified: true, pinToken: this.signPinToken(exp.id) };
    }
    const valid = await argon2.verify(exp.pinHash, pin);
    if (!valid) throw new AppError(401, 'INVALID_PIN', 'Incorrect PIN');
    return { verified: true, pinToken: this.signPinToken(exp.id) };
  }

  async openWhenMessage(token: string, messageId: string, pinToken?: string) {
    const exp = await this.requirePublished(token, pinToken);
    const msg = await prisma.openWhenMessage.findUnique({
      where: { id: messageId },
      include: { media: true },
    });

    if (!msg || msg.experienceId !== exp.id) {
      throw new AppError(404, 'NOT_FOUND', 'Message not found');
    }

    if (!isOpenWhenUnlocked(msg)) {
      throw new AppError(423, 'LOCKED', 'This message is not yet available');
    }

    if (msg.isOneTime && !msg.openedAt) {
      await prisma.openWhenMessage.update({
        where: { id: messageId },
        data: { openedAt: new Date() },
      });
    }

    return { ...msg, media: msg.media ? mediaService.withUrls(msg.media) : null };
  }

  async futureLetter(token: string, pinToken?: string) {
    const exp = await this.requirePublished(token, pinToken);
    const letter = await prisma.futureLetter.findUnique({
      where: { experienceId: exp.id },
      include: { media: true },
    });
    if (!letter) throw new AppError(404, 'NOT_FOUND', 'Future letter not found');
    if (!isFutureLetterUnlocked(letter.unlockDate)) {
      throw new AppError(423, 'LOCKED', 'Not yet. Come back when the time is right.');
    }
    if (!letter.unlockedAt) {
      await prisma.futureLetter.update({
        where: { id: letter.id },
        data: { unlockedAt: new Date() },
      });
    }
    return {
      ...letter,
      isUnlocked: true,
      media: letter.media ? mediaService.withUrls(letter.media) : null,
    };
  }

  async submitResponse(token: string, answer: string, pinToken?: string) {
    const exp = await this.requirePublished(token, pinToken);
    const response = await prisma.response.create({
      data: { experienceId: exp.id, answer },
    });
    await prisma.auditLog.create({
      data: { experienceId: exp.id, action: 'RESPONSE_RECEIVED' },
    });
    return response;
  }

  private async requirePublished(token: string, pinToken?: string) {
    const exp = await prisma.experience.findUnique({ where: { publicToken: token } });
    if (!exp || exp.status !== 'PUBLISHED') {
      throw new AppError(404, 'NOT_FOUND', 'Experience not found');
    }
    if (exp.pinEnabled && !this.verifyPinToken(pinToken, exp.id)) {
      throw new AppError(401, 'PIN_REQUIRED', 'PIN verification required');
    }
    return exp;
  }
}

export const publicService = new PublicService();
