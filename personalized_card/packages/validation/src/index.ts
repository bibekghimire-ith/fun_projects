import { z } from 'zod';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ─── Experience ───────────────────────────────────────────────────────────────

export const EventTypeSchema = z.enum(['BIRTHDAY', 'ANNIVERSARY', 'VALENTINES', 'CUSTOM']);

export const CreateExperienceSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  recipientName: z.string().min(1, 'Recipient name is required').max(100, 'Name too long'),
  eventType: EventTypeSchema,
  eventDate: z.string().datetime().optional().nullable(),
  openingMessage: z.string().max(2000, 'Message too long').optional().nullable(),
  closingMessage: z.string().max(2000, 'Message too long').optional().nullable(),
});

export const UpdateExperienceSchema = CreateExperienceSchema.partial().extend({
  coverMediaId: z.string().uuid().optional().nullable(),
  musicMediaId: z.string().uuid().optional().nullable(),
});

export const PinSchema = z.object({
  pin: z
    .string()
    .length(4, 'PIN must be exactly 4 digits')
    .regex(/^\d+$/, 'PIN must be numeric'),
});

// ─── Sections ─────────────────────────────────────────────────────────────────

export const CreateSectionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  order: z.number().int().min(0).optional(),
});

export const UpdateSectionSchema = CreateSectionSchema.partial().extend({
  enabled: z.boolean().optional(),
});

export const ReorderSchema = z.object({
  ids: z.array(z.string().uuid()),
});

// ─── Blocks ───────────────────────────────────────────────────────────────────

export const BlockTypeSchema = z.enum([
  'TEXT',
  'HEADING',
  'IMAGE',
  'GALLERY',
  'VIDEO',
  'AUDIO',
  'TIMELINE',
  'QUOTE',
  'DIVIDER',
  'COUNTDOWN',
  'OPEN_WHEN',
  'FUTURE_LETTER',
  'FINAL_QUESTION',
  'BUTTON',
]);

export const CreateBlockSchema = z.object({
  type: BlockTypeSchema,
  order: z.number().int().min(0).optional(),
  content: z.record(z.unknown()).default({}),
  mediaId: z.string().uuid().optional().nullable(),
});

export const UpdateBlockSchema = CreateBlockSchema.partial().extend({
  enabled: z.boolean().optional(),
});

// ─── Memory ───────────────────────────────────────────────────────────────────

export const CreateMemorySchema = z.object({
  date: z.string().datetime(),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(2000, 'Description too long').optional().nullable(),
  location: z.string().max(200, 'Location too long').optional().nullable(),
  mediaId: z.string().uuid().optional().nullable(),
  order: z.number().int().min(0).optional(),
});

export const UpdateMemorySchema = CreateMemorySchema.partial();

// ─── Open When ────────────────────────────────────────────────────────────────

export const UnlockTypeSchema = z.enum(['IMMEDIATE', 'DATE_LOCKED', 'MANUAL']);

export const CreateOpenWhenSchema = z.object({
  label: z.string().min(1, 'Label is required').max(200, 'Label too long'),
  emoji: z.string().max(10, 'Emoji too long').optional().nullable(),
  content: z.string().min(1, 'Content is required').max(5000, 'Content too long'),
  mediaId: z.string().uuid().optional().nullable(),
  unlockType: UnlockTypeSchema.default('IMMEDIATE'),
  unlockDate: z.string().datetime().optional().nullable(),
  isOneTime: z.boolean().default(false),
  order: z.number().int().min(0).optional(),
});

export const UpdateOpenWhenSchema = CreateOpenWhenSchema.partial();

// ─── Future Letter ────────────────────────────────────────────────────────────

export const FutureLetterSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  content: z.string().min(1, 'Content is required').max(10000, 'Content too long'),
  unlockDate: z.string().datetime(),
  mediaId: z.string().uuid().optional().nullable(),
});

// ─── Final Surprise ───────────────────────────────────────────────────────────

export const ResponseTypeSchema = z.enum([
  'YES_NO',
  'SINGLE_BUTTON',
  'MULTIPLE_CHOICE',
  'TEXT_INPUT',
]);

export const FinalSurpriseSchema = z.object({
  question: z.string().min(1, 'Question is required').max(500, 'Question too long'),
  buttonText: z.string().min(1).max(100).default('Reveal'),
  successMessage: z.string().min(1, 'Success message is required').max(2000, 'Message too long'),
  responseType: ResponseTypeSchema.default('YES_NO'),
  options: z.array(z.string().max(200)).min(2).max(8).optional().nullable(),
  mediaId: z.string().uuid().optional().nullable(),
  ctaText: z.string().max(200).optional().nullable(),
  ctaUrl: z.string().url().optional().nullable(),
});

// ─── Public / Recipient ───────────────────────────────────────────────────────

export const VerifyPinSchema = z.object({
  pin: z.string().length(4).regex(/^\d+$/),
});

export const SubmitResponseSchema = z.object({
  answer: z.string().min(1, 'Answer is required').max(1000, 'Answer too long'),
});

// ─── Theme ────────────────────────────────────────────────────────────────────

export const SetThemeSchema = z.object({
  themeId: z.string().uuid(),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateExperienceInput = z.infer<typeof CreateExperienceSchema>;
export type UpdateExperienceInput = z.infer<typeof UpdateExperienceSchema>;
export type CreateSectionInput = z.infer<typeof CreateSectionSchema>;
export type UpdateSectionInput = z.infer<typeof UpdateSectionSchema>;
export type CreateBlockInput = z.infer<typeof CreateBlockSchema>;
export type UpdateBlockInput = z.infer<typeof UpdateBlockSchema>;
export type CreateMemoryInput = z.infer<typeof CreateMemorySchema>;
export type UpdateMemoryInput = z.infer<typeof UpdateMemorySchema>;
export type CreateOpenWhenInput = z.infer<typeof CreateOpenWhenSchema>;
export type UpdateOpenWhenInput = z.infer<typeof UpdateOpenWhenSchema>;
export type FutureLetterInput = z.infer<typeof FutureLetterSchema>;
export type FinalSurpriseInput = z.infer<typeof FinalSurpriseSchema>;
export type SubmitResponseInput = z.infer<typeof SubmitResponseSchema>;

// ─── Themes (custom, per-user) ────────────────────────────────────────────────

const HexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Must be a hex colour like #1a1a1a');

const CssLength = z
  .string()
  .max(24)
  .regex(/^[0-9.]+(px|rem|em|%)$/, 'Must be a CSS length like 0.75rem');

const SafeFontStack = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[\w\s,'"()\-.]+$/, 'Font stack contains unsupported characters');

export const AnimationLevelSchema = z.enum(['NONE', 'MINIMAL', 'NORMAL', 'RICH']);
export const TransitionStyleSchema = z.enum(['FADE', 'SLIDE', 'ZOOM', 'NONE']);
export const NavigationModeSchema = z.enum(['SCROLL', 'CHAPTERS']);

/**
 * Custom CSS is allowed but deliberately narrow: no @import, no url(), no
 * expression() and no closing style tags. It is injected into a scoped
 * <style> element, never into markup.
 */
const CustomCss = z
  .string()
  .max(8000, 'Custom CSS is limited to 8000 characters')
  .refine((css) => !/@import|url\s*\(|expression\s*\(|<\/?\s*style|javascript:/i.test(css), {
    message: 'Custom CSS may not use @import, url(), expression() or <style> tags',
  });

export const CreateThemeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(60, 'Name too long'),
  description: z.string().max(200).optional().nullable(),
  primaryColor: HexColor,
  secondaryColor: HexColor,
  backgroundColor: HexColor,
  surfaceColor: HexColor,
  textColor: HexColor,
  mutedColor: HexColor.default('#6b7280'),
  borderColor: HexColor.default('#e5e7eb'),
  fontFamily: SafeFontStack.default("'Inter', system-ui, sans-serif"),
  headingFontFamily: SafeFontStack.default("'Lora', Georgia, serif"),
  baseFontSize: CssLength.default('16px'),
  borderRadius: CssLength.default('0.75rem'),
  backgroundGradient: z.string().max(300).optional().nullable(),
  animationLevel: AnimationLevelSchema.default('NORMAL'),
  transitionStyle: TransitionStyleSchema.default('FADE'),
  customCss: CustomCss.optional().nullable(),
});

export const UpdateThemeSchema = CreateThemeSchema.partial();

/** Duplicate a built-in theme as a starting point for a custom one. */
export const ForkThemeSchema = z.object({
  themeId: z.string().uuid(),
  name: z.string().min(1).max(60).optional(),
});

// ─── Experience configuration (microcopy + toggles) ───────────────────────────

export const ExperienceConfigSchema = z.object({
  navigationMode: NavigationModeSchema.optional(),
  showProgressBar: z.boolean().optional(),
  enableConfetti: z.boolean().optional(),
  musicAutoplay: z.boolean().optional(),
  musicVolume: z.number().int().min(0).max(100).optional(),
  locale: z.string().min(2).max(10).optional(),
  dateFormat: z.string().min(1).max(40).optional(),
  /** Sparse map of copy key -> override. Empty string resets to the default. */
  copy: z.record(z.string().max(600)).optional(),
  features: z.record(z.boolean()).optional(),
});

// ─── Templates ────────────────────────────────────────────────────────────────

export const ApplyTemplateSchema = z.object({
  slug: z.string().min(1).max(60),
  /** REPLACE wipes existing sections; APPEND keeps them. */
  mode: z.enum(['REPLACE', 'APPEND']).default('APPEND'),
  /** Also apply the template's theme, copy and feature toggles. */
  includeTheme: z.boolean().default(true),
  includeConfig: z.boolean().default(true),
  includeExtras: z.boolean().default(true),
});

export const CreateFromTemplateSchema = CreateExperienceSchema.extend({
  templateSlug: z.string().min(1).max(60).optional().nullable(),
});

export const ApplyPresetSchema = z.object({
  slug: z.string().min(1).max(60),
});

// ─── Block content, validated per block type ──────────────────────────────────

const AlignSchema = z.enum(['left', 'center', 'right']);

export const BlockContentSchemas = {
  TEXT: z.object({
    doc: z.unknown().optional(),
    text: z.string().max(20000).optional(),
    align: AlignSchema.optional(),
  }),
  HEADING: z.object({
    text: z.string().min(1).max(200),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    align: AlignSchema.optional(),
    eyebrow: z.string().max(100).optional(),
  }),
  IMAGE: z.object({
    caption: z.string().max(500).optional(),
    alt: z.string().max(300).optional(),
    fit: z.enum(['cover', 'contain']).optional(),
    rounded: z.boolean().optional(),
  }),
  GALLERY: z.object({
    mediaIds: z.array(z.string().uuid()).max(60).default([]),
    layout: z.enum(['grid', 'masonry', 'carousel']).optional(),
    caption: z.string().max(500).optional(),
  }),
  VIDEO: z.object({
    caption: z.string().max(500).optional(),
    autoplay: z.boolean().optional(),
    loop: z.boolean().optional(),
  }),
  AUDIO: z.object({
    title: z.string().max(200).optional(),
    description: z.string().max(500).optional(),
    isVoiceLetter: z.boolean().optional(),
  }),
  TIMELINE: z.object({
    title: z.string().max(200).optional(),
    memoryIds: z.array(z.string().uuid()).max(200).optional(),
    layout: z.enum(['vertical', 'alternating']).optional(),
  }),
  QUOTE: z.object({
    text: z.string().min(1).max(1000),
    attribution: z.string().max(200).optional(),
  }),
  DIVIDER: z.object({
    style: z.enum(['line', 'dots', 'hearts', 'space']).optional(),
  }),
  COUNTDOWN: z.object({
    targetDate: z.string().datetime(),
    label: z.string().max(200).optional(),
    completedText: z.string().max(200).optional(),
  }),
  OPEN_WHEN: z.object({
    title: z.string().max(200).optional(),
    messageIds: z.array(z.string().uuid()).max(60).optional(),
  }),
  FUTURE_LETTER: z.object({
    showCountdown: z.boolean().optional(),
  }),
  FINAL_QUESTION: z.object({
    showIntro: z.boolean().optional(),
  }),
  BUTTON: z.object({
    text: z.string().min(1).max(100),
    url: z.string().url().max(2000).optional(),
    style: z.enum(['primary', 'secondary', 'ghost']).optional(),
  }),
} as const;

export type BlockTypeName = keyof typeof BlockContentSchemas;

/**
 * Validate a block's `content` against the schema for its type. Unknown types
 * are rejected rather than passed through, so a malformed block can never be
 * persisted and crash the renderer later.
 */
export function parseBlockContent(type: string, content: unknown): Record<string, unknown> {
  const schema = BlockContentSchemas[type as BlockTypeName];
  if (!schema) {
    throw new z.ZodError([
      { code: 'custom', path: ['type'], message: `Unknown block type: ${type}` },
    ]);
  }
  return schema.parse(content ?? {}) as Record<string, unknown>;
}

// ─── Publish / share ──────────────────────────────────────────────────────────

export const PublishOptionsSchema = z.object({
  /** Skip the cover-image requirement — useful for text-only letters. */
  allowWithoutCover: z.boolean().default(false),
});

// ─── Inferred types (new) ─────────────────────────────────────────────────────

export type CreateThemeInput = z.infer<typeof CreateThemeSchema>;
export type UpdateThemeInput = z.infer<typeof UpdateThemeSchema>;
export type ForkThemeInput = z.infer<typeof ForkThemeSchema>;
export type ExperienceConfigInput = z.infer<typeof ExperienceConfigSchema>;
export type ApplyTemplateInput = z.infer<typeof ApplyTemplateSchema>;
export type CreateFromTemplateInput = z.infer<typeof CreateFromTemplateSchema>;
export type ApplyPresetInput = z.infer<typeof ApplyPresetSchema>;
export type PublishOptionsInput = z.infer<typeof PublishOptionsSchema>;
