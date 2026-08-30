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
