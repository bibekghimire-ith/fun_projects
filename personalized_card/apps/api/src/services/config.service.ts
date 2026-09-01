import { Prisma } from '@prisma/client';
import type { NavigationMode as PrismaNavigationMode } from '@prisma/client';
import type { ResolvedConfig } from '@letter/types';
import type { ExperienceConfigInput } from '@letter/validation';
import { prisma } from '../config/prisma';
import { auditService } from './audit.service';
import { experienceService } from './experience.service';
import { mergeCopyOverrides, mergeFeatureOverrides, toResolvedConfig } from './config.helpers';

export class ConfigService {
  /** The creator's view. The row is created lazily the first time it is asked for. */
  async get(experienceId: string, userId: string) {
    await experienceService.assertOwnership(experienceId, userId);

    const existing = await prisma.experienceConfig.findUnique({ where: { experienceId } });
    if (existing) return existing;

    return prisma.experienceConfig.create({ data: { experienceId } });
  }

  /**
   * The recipient's view: every default merged in, so the client never has to
   * fall back to anything itself. Internal — no ownership check, because the
   * public route has already proved the experience is published.
   */
  async getResolved(experienceId: string): Promise<ResolvedConfig> {
    const row = await prisma.experienceConfig.findUnique({ where: { experienceId } });
    return toResolvedConfig(row);
  }

  /**
   * Upsert the config. Copy and feature maps are merged rather than replaced,
   * and an empty copy value removes the override so the default comes back.
   */
  async update(experienceId: string, userId: string, input: ExperienceConfigInput) {
    await experienceService.assertOwnership(experienceId, userId);

    const existing = await prisma.experienceConfig.findUnique({ where: { experienceId } });

    const copy = mergeCopyOverrides(existing?.copy, input.copy);
    const features = mergeFeatureOverrides(existing?.features, input.features);

    const scalars = {
      ...(input.navigationMode !== undefined
        ? { navigationMode: input.navigationMode as PrismaNavigationMode }
        : {}),
      ...(input.showProgressBar !== undefined ? { showProgressBar: input.showProgressBar } : {}),
      ...(input.enableConfetti !== undefined ? { enableConfetti: input.enableConfetti } : {}),
      ...(input.musicAutoplay !== undefined ? { musicAutoplay: input.musicAutoplay } : {}),
      ...(input.musicVolume !== undefined ? { musicVolume: input.musicVolume } : {}),
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
      ...(input.dateFormat !== undefined ? { dateFormat: input.dateFormat } : {}),
    };

    const updated = await prisma.experienceConfig.upsert({
      where: { experienceId },
      create: {
        experienceId,
        ...scalars,
        copy: copy as Prisma.InputJsonValue,
        features: features as Prisma.InputJsonValue,
      },
      update: {
        ...scalars,
        copy: copy as Prisma.InputJsonValue,
        features: features as Prisma.InputJsonValue,
      },
    });

    await auditService.log(userId, experienceId, 'CONFIG_UPDATED');
    return updated;
  }
}

export const configService = new ConfigService();
