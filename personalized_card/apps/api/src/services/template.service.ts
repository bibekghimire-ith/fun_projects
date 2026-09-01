import fs from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import type {
  BlockType as PrismaBlockType,
  ResponseType as PrismaResponseType,
  UnlockType as PrismaUnlockType,
  NavigationMode as PrismaNavigationMode,
} from '@prisma/client';
import {
  assertTemplate,
  getPreset as getPresetFromRegistry,
  getTemplate,
  listPresets as listPresetsFromRegistry,
  listTemplateSummaries,
  registerTemplate,
} from '@letter/templates';
import type { BlockPreset, TemplateBlock, TemplateDefinition, TemplateSummary } from '@letter/types';
import { parseBlockContent, type ApplyTemplateInput } from '@letter/validation';
import { prisma } from '../config/prisma';
import { config } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { auditService } from './audit.service';
import { experienceService } from './experience.service';
import { mergeCopyOverrides, mergeFeatureOverrides } from './config.helpers';
import { dateFromDaysAhead, memoryDate, openWhenUnlockDate, resolveCountdownContent } from './template.helpers';

/** A section's worth of blocks, already validated and ready to persist. */
interface PreparedSection {
  title: string;
  order: number;
  enabled: boolean;
  blocks: {
    type: PrismaBlockType;
    order: number;
    enabled: boolean;
    content: Prisma.InputJsonValue;
  }[];
}

export class TemplateService {
  // ─── Registry reads ────────────────────────────────────────────────────────

  list(): TemplateSummary[] {
    return listTemplateSummaries();
  }

  get(slug: string): TemplateDefinition {
    const template = getTemplate(slug);
    if (!template) {
      throw new AppError(404, 'TEMPLATE_NOT_FOUND', `There is no template called "${slug}"`);
    }
    return template;
  }

  listPresets(): BlockPreset[] {
    return listPresetsFromRegistry();
  }

  getPreset(slug: string): BlockPreset {
    const preset = getPresetFromRegistry(slug);
    if (!preset) {
      throw new AppError(404, 'PRESET_NOT_FOUND', `There is no preset called "${slug}"`);
    }
    return preset;
  }

  /**
   * Register any JSON templates sitting in TEMPLATES_EXTRA_DIR. Called once at
   * startup. A broken file is logged and skipped — one bad template must never
   * stop the API from booting.
   */
  loadExtraTemplates(): number {
    const dir = config.TEMPLATES_EXTRA_DIR;
    if (!dir) return 0;

    let loaded = 0;
    try {
      const files = fs.readdirSync(dir).filter((file) => file.toLowerCase().endsWith('.json'));

      for (const file of files) {
        const fullPath = path.join(dir, file);
        try {
          const parsed: unknown = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          assertTemplate(parsed);
          registerTemplate(parsed);
          loaded += 1;
        } catch (err) {
          logger.warn('Skipped an invalid extra template', {
            file: fullPath,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      logger.info(`📦 Loaded ${loaded} extra template(s) from ${dir}`);
    } catch (err) {
      logger.error('Could not read TEMPLATES_EXTRA_DIR', {
        dir,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return loaded;
  }

  // ─── Applying a template ───────────────────────────────────────────────────

  /**
   * Stamp a template onto an existing experience: sections and blocks always,
   * plus its extras, theme and config when asked for.
   */
  async apply(experienceId: string, userId: string, input: ApplyTemplateInput) {
    const experience = await experienceService.assertOwnership(experienceId, userId);
    const template = this.get(input.slug);
    const now = new Date();

    // Validate every block before touching the database, so an invalid template
    // can never leave an experience half-rewritten.
    const sections: PreparedSection[] = template.sections.map((section, sectionOrder) => ({
      title: section.title,
      order: sectionOrder,
      enabled: section.enabled ?? true,
      blocks: section.blocks.map((block, blockOrder) => ({
        type: block.type as PrismaBlockType,
        order: blockOrder,
        enabled: block.enabled ?? true,
        content: this.prepareBlockContent(block, experience.eventDate, now),
      })),
    }));

    // Look the theme up outside the transaction; a template naming a theme that
    // was never seeded simply leaves the experience's theme alone.
    let themeId: string | undefined;
    if (input.includeTheme) {
      const theme = await prisma.theme.findUnique({ where: { slug: template.themeSlug } });
      if (theme) themeId = theme.id;
      else logger.warn('Template names a theme that is not seeded', { slug: template.themeSlug });
    }

    await prisma.$transaction(async (tx) => {
      if (input.mode === 'REPLACE') {
        // Blocks go with them: ContentBlock cascades on section delete.
        await tx.experienceSection.deleteMany({ where: { experienceId } });
      }

      const baseOrder =
        input.mode === 'REPLACE'
          ? 0
          : await tx.experienceSection.count({ where: { experienceId } });

      for (const section of sections) {
        await tx.experienceSection.create({
          data: {
            experienceId,
            title: section.title,
            order: baseOrder + section.order,
            enabled: section.enabled,
            blocks: {
              create: section.blocks.map((block) => ({
                type: block.type,
                order: block.order,
                enabled: block.enabled,
                content: block.content,
              })),
            },
          },
        });
      }

      if (input.includeExtras) {
        await this.createExtras(tx, experienceId, template, now);
      }

      if (input.includeConfig && template.config) {
        await this.applyConfig(tx, experienceId, template);
      }

      await tx.experience.update({
        where: { id: experienceId },
        data: {
          templateSlug: template.slug,
          ...(themeId ? { themeId } : {}),
        },
      });
    });

    await auditService.log(userId, experienceId, 'TEMPLATE_APPLIED', {
      slug: template.slug,
      mode: input.mode,
    });

    return prisma.experience.findUnique({
      where: { id: experienceId },
      include: {
        theme: true,
        sections: {
          include: { blocks: { include: { media: true }, orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
        memories: { orderBy: { order: 'asc' } },
        openWhenMessages: { orderBy: { order: 'asc' } },
        futureLetter: true,
        finalSurprise: true,
        config: true,
      },
    });
  }

  /** Append a preset's blocks to the end of a section the caller owns. */
  async applyPreset(sectionId: string, userId: string, slug: string) {
    const section = await prisma.experienceSection.findUnique({ where: { id: sectionId } });
    if (!section) throw new AppError(404, 'SECTION_NOT_FOUND', 'Section not found');

    const experience = await experienceService.assertOwnership(section.experienceId, userId);
    const preset = this.getPreset(slug);
    const now = new Date();

    const existing = await prisma.contentBlock.count({ where: { sectionId } });
    const prepared = preset.blocks.map((block, index) => ({
      sectionId,
      type: block.type as PrismaBlockType,
      order: existing + index,
      enabled: block.enabled ?? true,
      content: this.prepareBlockContent(block, experience.eventDate, now),
    }));

    return prisma.$transaction(
      prepared.map((data) => prisma.contentBlock.create({ data, include: { media: true } })),
    );
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  /**
   * Validate a template block's content for its type, after resolving the
   * countdown `targetDateFrom` marker against the experience.
   */
  private prepareBlockContent(
    block: TemplateBlock,
    eventDate: Date | null,
    now: Date,
  ): Prisma.InputJsonValue {
    const raw =
      block.type === 'COUNTDOWN'
        ? resolveCountdownContent(block.content, eventDate, now)
        : block.content;

    try {
      return parseBlockContent(block.type, raw) as Prisma.InputJsonValue;
    } catch (err) {
      logger.warn('Template block failed validation', {
        type: block.type,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new AppError(
        422,
        'TEMPLATE_BLOCK_INVALID',
        `This template has a ${block.type} block that could not be read.`,
      );
    }
  }

  /** Timeline moments, sealed notes, the future letter and the final surprise. */
  private async createExtras(
    tx: Prisma.TransactionClient,
    experienceId: string,
    template: TemplateDefinition,
    now: Date,
  ) {
    if (template.memories?.length) {
      await tx.memory.createMany({
        data: template.memories.map((memory, index) => ({
          experienceId,
          date: memoryDate(memory, now),
          title: memory.title,
          description: memory.description ?? null,
          location: memory.location ?? null,
          order: index,
        })),
      });
    }

    if (template.openWhen?.length) {
      await tx.openWhenMessage.createMany({
        data: template.openWhen.map((note, index) => ({
          experienceId,
          label: note.label,
          emoji: note.emoji ?? null,
          content: note.content,
          unlockType: (note.unlockType ?? 'IMMEDIATE') as PrismaUnlockType,
          unlockDate: openWhenUnlockDate(note, now),
          isOneTime: note.isOneTime ?? false,
          order: index,
        })),
      });
    }

    if (template.futureLetter) {
      const letter = {
        title: template.futureLetter.title,
        content: template.futureLetter.content,
        unlockDate: dateFromDaysAhead(template.futureLetter.unlockInDays, now),
      };
      await tx.futureLetter.upsert({
        where: { experienceId },
        create: { experienceId, ...letter },
        update: letter,
      });
    }

    if (template.finalSurprise) {
      const surprise = template.finalSurprise;
      const data = {
        question: surprise.question,
        buttonText: surprise.buttonText ?? 'Reveal',
        successMessage: surprise.successMessage,
        responseType: (surprise.responseType ?? 'YES_NO') as PrismaResponseType,
        ctaText: surprise.ctaText ?? null,
        ctaUrl: surprise.ctaUrl ?? null,
        ...(surprise.options ? { options: surprise.options as Prisma.InputJsonValue } : {}),
      };
      await tx.finalSurprise.upsert({
        where: { experienceId },
        create: { experienceId, ...data },
        update: data,
      });
    }
  }

  /** Merge the template's navigation, confetti, microcopy and toggles in. */
  private async applyConfig(
    tx: Prisma.TransactionClient,
    experienceId: string,
    template: TemplateDefinition,
  ) {
    const templateConfig = template.config;
    if (!templateConfig) return;

    const existing = await tx.experienceConfig.findUnique({ where: { experienceId } });

    const copy = mergeCopyOverrides(
      existing?.copy,
      templateConfig.copy as Record<string, string> | undefined,
    );
    const features = mergeFeatureOverrides(
      existing?.features,
      templateConfig.features as Record<string, boolean> | undefined,
    );

    const scalars = {
      ...(templateConfig.navigationMode
        ? { navigationMode: templateConfig.navigationMode as PrismaNavigationMode }
        : {}),
      ...(templateConfig.enableConfetti !== undefined
        ? { enableConfetti: templateConfig.enableConfetti }
        : {}),
    };

    await tx.experienceConfig.upsert({
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
  }
}

export const templateService = new TemplateService();
