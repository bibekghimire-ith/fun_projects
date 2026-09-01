import { nanoid } from 'nanoid';
import type {
  AnimationLevel as PrismaAnimationLevel,
  TransitionStyle as PrismaTransitionStyle,
} from '@prisma/client';
import type { CreateThemeInput, ForkThemeInput, UpdateThemeInput } from '@letter/validation';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';

/** A URL-safe stem from a theme name, with a short suffix so slugs never clash. */
function slugFromName(name: string): string {
  const stem =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'theme';
  return `${stem}-${nanoid(6).toLowerCase()}`;
}

export class ThemeService {
  /** Built-ins first, then whatever this creator has made. */
  async list(userId: string | null) {
    return prisma.theme.findMany({
      where: userId ? { OR: [{ isBuiltIn: true }, { userId }] } : { isBuiltIn: true },
      orderBy: [{ isBuiltIn: 'desc' }, { name: 'asc' }],
    });
  }

  async create(userId: string, input: CreateThemeInput) {
    const theme = await prisma.theme.create({
      data: {
        name: input.name,
        slug: slugFromName(input.name),
        description: input.description ?? null,
        isBuiltIn: false,
        userId,
        primaryColor: input.primaryColor,
        secondaryColor: input.secondaryColor,
        backgroundColor: input.backgroundColor,
        surfaceColor: input.surfaceColor,
        textColor: input.textColor,
        mutedColor: input.mutedColor,
        borderColor: input.borderColor,
        fontFamily: input.fontFamily,
        headingFontFamily: input.headingFontFamily,
        baseFontSize: input.baseFontSize,
        borderRadius: input.borderRadius,
        backgroundGradient: input.backgroundGradient ?? null,
        animationLevel: input.animationLevel as PrismaAnimationLevel,
        transitionStyle: input.transitionStyle as PrismaTransitionStyle,
        customCss: input.customCss ?? null,
      },
    });

    await auditService.log(userId, null, 'THEME_CREATED', { themeId: theme.id, slug: theme.slug });
    return theme;
  }

  /** Copy a built-in (or one of your own) into a new, editable theme. */
  async fork(userId: string, input: ForkThemeInput) {
    const source = await prisma.theme.findUnique({ where: { id: input.themeId } });
    if (!source) throw new AppError(404, 'THEME_NOT_FOUND', 'Theme not found');
    if (!source.isBuiltIn && source.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    const name = input.name ?? `${source.name} (copy)`;
    const theme = await prisma.theme.create({
      data: {
        name,
        slug: slugFromName(name),
        description: source.description,
        isBuiltIn: false,
        userId,
        primaryColor: source.primaryColor,
        secondaryColor: source.secondaryColor,
        backgroundColor: source.backgroundColor,
        surfaceColor: source.surfaceColor,
        textColor: source.textColor,
        mutedColor: source.mutedColor,
        borderColor: source.borderColor,
        fontFamily: source.fontFamily,
        headingFontFamily: source.headingFontFamily,
        baseFontSize: source.baseFontSize,
        borderRadius: source.borderRadius,
        backgroundGradient: source.backgroundGradient,
        animationLevel: source.animationLevel,
        transitionStyle: source.transitionStyle,
        customCss: source.customCss,
      },
    });

    await auditService.log(userId, null, 'THEME_CREATED', {
      themeId: theme.id,
      slug: theme.slug,
      forkedFrom: source.id,
    });
    return theme;
  }

  async update(id: string, userId: string, input: UpdateThemeInput) {
    await this.assertEditable(id, userId);

    const theme = await prisma.theme.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.primaryColor !== undefined ? { primaryColor: input.primaryColor } : {}),
        ...(input.secondaryColor !== undefined ? { secondaryColor: input.secondaryColor } : {}),
        ...(input.backgroundColor !== undefined ? { backgroundColor: input.backgroundColor } : {}),
        ...(input.surfaceColor !== undefined ? { surfaceColor: input.surfaceColor } : {}),
        ...(input.textColor !== undefined ? { textColor: input.textColor } : {}),
        ...(input.mutedColor !== undefined ? { mutedColor: input.mutedColor } : {}),
        ...(input.borderColor !== undefined ? { borderColor: input.borderColor } : {}),
        ...(input.fontFamily !== undefined ? { fontFamily: input.fontFamily } : {}),
        ...(input.headingFontFamily !== undefined
          ? { headingFontFamily: input.headingFontFamily }
          : {}),
        ...(input.baseFontSize !== undefined ? { baseFontSize: input.baseFontSize } : {}),
        ...(input.borderRadius !== undefined ? { borderRadius: input.borderRadius } : {}),
        ...(input.backgroundGradient !== undefined
          ? { backgroundGradient: input.backgroundGradient ?? null }
          : {}),
        ...(input.animationLevel !== undefined
          ? { animationLevel: input.animationLevel as PrismaAnimationLevel }
          : {}),
        ...(input.transitionStyle !== undefined
          ? { transitionStyle: input.transitionStyle as PrismaTransitionStyle }
          : {}),
        ...(input.customCss !== undefined ? { customCss: input.customCss ?? null } : {}),
      },
    });

    await auditService.log(userId, null, 'THEME_UPDATED', { themeId: id });
    return theme;
  }

  /**
   * Delete a custom theme. Any experience still wearing it falls back to no
   * theme at all, in the same transaction, so nothing is left pointing at a
   * row that has gone.
   */
  async remove(id: string, userId: string) {
    await this.assertEditable(id, userId);

    await prisma.$transaction([
      prisma.experience.updateMany({ where: { themeId: id }, data: { themeId: null } }),
      prisma.theme.delete({ where: { id } }),
    ]);

    await auditService.log(userId, null, 'THEME_DELETED', { themeId: id });
  }

  /** Owner-only, and built-ins are frozen for everyone. */
  private async assertEditable(id: string, userId: string) {
    const theme = await prisma.theme.findUnique({ where: { id } });
    if (!theme) throw new AppError(404, 'THEME_NOT_FOUND', 'Theme not found');
    if (theme.isBuiltIn) {
      throw new AppError(
        403,
        'THEME_IMMUTABLE',
        'Built-in themes cannot be changed. Fork it and edit your copy instead.',
      );
    }
    if (theme.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');
    return theme;
  }
}

export const themeService = new ThemeService();
