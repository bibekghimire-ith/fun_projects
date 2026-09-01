// ─── Enums ────────────────────────────────────────────────────────────────────

export type EventType = 'BIRTHDAY' | 'ANNIVERSARY' | 'VALENTINES' | 'CUSTOM';

export type ExperienceStatus = 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'REVOKED';

export type BlockType =
  | 'TEXT'
  | 'HEADING'
  | 'IMAGE'
  | 'GALLERY'
  | 'VIDEO'
  | 'AUDIO'
  | 'TIMELINE'
  | 'QUOTE'
  | 'DIVIDER'
  | 'COUNTDOWN'
  | 'OPEN_WHEN'
  | 'FUTURE_LETTER'
  | 'FINAL_QUESTION'
  | 'BUTTON';

export type MediaType = 'IMAGE' | 'VIDEO' | 'AUDIO';

export type UnlockType = 'IMMEDIATE' | 'DATE_LOCKED' | 'MANUAL';

export type ResponseType = 'YES_NO' | 'SINGLE_BUTTON' | 'MULTIPLE_CHOICE' | 'TEXT_INPUT';

export type AnimationLevel = 'NONE' | 'MINIMAL' | 'NORMAL' | 'RICH';

export type AuditAction =
  | 'EXPERIENCE_CREATED'
  | 'EXPERIENCE_UPDATED'
  | 'EXPERIENCE_PUBLISHED'
  | 'EXPERIENCE_UNPUBLISHED'
  | 'EXPERIENCE_REVOKED'
  | 'MEDIA_UPLOADED'
  | 'MEDIA_DELETED'
  | 'PIN_ENABLED'
  | 'PIN_DISABLED'
  | 'RESPONSE_RECEIVED'
  | 'TEMPLATE_APPLIED'
  | 'THEME_CREATED'
  | 'THEME_UPDATED'
  | 'THEME_DELETED'
  | 'CONFIG_UPDATED'
  | 'SECTION_CREATED'
  | 'SECTION_DELETED';

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Experience {
  id: string;
  userId: string;
  title: string;
  recipientName: string;
  eventType: EventType;
  eventDate: string | null;
  openingMessage: string | null;
  closingMessage: string | null;
  status: ExperienceStatus;
  publicToken: string;
  pinEnabled: boolean;
  themeId: string | null;
  theme: Theme | null;
  coverMediaId: string | null;
  musicMediaId: string | null;
  templateSlug: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExperienceSection {
  id: string;
  experienceId: string;
  title: string;
  order: number;
  enabled: boolean;
  blocks: ContentBlock[];
  createdAt: string;
  updatedAt: string;
}

export interface ContentBlock {
  id: string;
  sectionId: string;
  type: BlockType;
  order: number;
  enabled: boolean;
  content: Record<string, unknown>;
  mediaId: string | null;
  media: Media | null;
  createdAt: string;
  updatedAt: string;
}

export interface Media {
  id: string;
  experienceId: string;
  type: MediaType;
  originalName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  url: string;
  thumbnailUrl: string | null;
  createdAt: string;
}

export interface Memory {
  id: string;
  experienceId: string;
  date: string;
  title: string;
  description: string | null;
  location: string | null;
  order: number;
  mediaId: string | null;
  media: Media | null;
  createdAt: string;
  updatedAt: string;
}

export interface OpenWhenMessage {
  id: string;
  experienceId: string;
  label: string;
  emoji: string | null;
  content: string;
  mediaId: string | null;
  media: Media | null;
  unlockType: UnlockType;
  unlockDate: string | null;
  isOneTime: boolean;
  openedAt: string | null;
  order: number;
  isUnlocked: boolean; // computed
  createdAt: string;
}

export interface FutureLetter {
  id: string;
  experienceId: string;
  title: string;
  content: string;
  unlockDate: string;
  mediaId: string | null;
  media: Media | null;
  unlockedAt: string | null;
  isUnlocked: boolean; // computed server-side
  createdAt: string;
  updatedAt: string;
}

export interface FinalSurprise {
  id: string;
  experienceId: string;
  question: string;
  buttonText: string;
  successMessage: string;
  responseType: ResponseType;
  options: string[] | null;
  mediaId: string | null;
  media: Media | null;
  ctaText: string | null;
  ctaUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Alias kept for readability — the full shape lives in ThemeRecord below. */
export type Theme = ThemeRecord;

export interface Response {
  id: string;
  experienceId: string;
  answer: string;
  respondedAt: string;
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Public Experience (Recipient View) ──────────────────────────────────────

export interface PublicExperience {
  id: string;
  title: string;
  recipientName: string;
  eventType: EventType;
  eventDate: string | null;
  openingMessage: string | null;
  closingMessage: string | null;
  theme: Theme | null;
  /** Fully resolved microcopy + feature toggles — defaults already merged in. */
  config: ResolvedConfig;
  coverMedia: Media | null;
  musicMedia: Media | null;
  /** Every media item on the experience, so id-only references resolve. */
  media: Media[];
  sections: ExperienceSection[];
  memories: Memory[];
  openWhenMessages: PublicOpenWhenMessage[];
  futureLetter: PublicFutureLetter | null;
  finalSurprise: FinalSurprise | null;
}

/** Config with every default merged in, so the client never falls back itself. */
export interface ResolvedConfig {
  navigationMode: NavigationMode;
  showProgressBar: boolean;
  enableConfetti: boolean;
  musicAutoplay: boolean;
  musicVolume: number;
  locale: string;
  dateFormat: string;
  copy: Record<CopyKey, string>;
  features: Record<FeatureKey, boolean>;
}

export interface PublicOpenWhenMessage {
  id: string;
  label: string;
  emoji: string | null;
  isUnlocked: boolean;
  isOneTime: boolean;
  unlockType: UnlockType;
  unlockDate: string | null;
  // content only present if unlocked:
  content?: string;
  media?: Media | null;
}

export interface PublicFutureLetter {
  id: string;
  title: string;
  unlockDate: string;
  isUnlocked: boolean;
  // content only if unlocked:
  content?: string;
  media?: Media | null;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

// ─── Customization: Themes ────────────────────────────────────────────────────

export type TransitionStyle = 'FADE' | 'SLIDE' | 'ZOOM' | 'NONE';

export type NavigationMode = 'SCROLL' | 'CHAPTERS';

/** Everything a theme controls. Rendered as CSS custom properties at runtime. */
export interface ThemeTokens {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  fontFamily: string;
  headingFontFamily: string;
  baseFontSize: string;
  borderRadius: string;
  backgroundGradient: string | null;
  animationLevel: AnimationLevel;
  transitionStyle: TransitionStyle;
  customCss: string | null;
}

export interface ThemeRecord extends ThemeTokens {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isBuiltIn: boolean;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Customization: Microcopy ─────────────────────────────────────────────────

/**
 * Every recipient-facing string lives here so a creator can rewrite the whole
 * voice of an experience without touching code. Values support the tokens
 * {recipient}, {sender}, {title} and {eventDate}.
 */
export const DEFAULT_COPY = {
  'envelope.title': 'A letter for you.',
  'envelope.subtitle': "Take your time. There's no rush.",
  'envelope.button': 'Open it',
  'envelope.hint': 'Tap the envelope',

  'pin.title': "This one's private.",
  'pin.subtitle': 'Enter the 4-digit code they gave you.',
  'pin.button': 'Unlock',
  'pin.error': "That's not it. Try again.",
  'pin.locked': 'Too many attempts. Come back in a little while.',

  'welcome.greeting': 'Hi {recipient}.',
  'welcome.subtitle': 'I made this for you.',
  'welcome.button': 'Begin',

  'nav.next': 'Next',
  'nav.previous': 'Back',
  'nav.progress': '{current} of {total}',
  'nav.skip': 'Skip to the end',

  'timeline.title': 'How we got here',
  'timeline.subtitle': 'Some memories deserve another look.',

  'gallery.title': 'Us, in pictures',
  'gallery.close': 'Close',
  'gallery.next': 'Next photo',
  'gallery.previous': 'Previous photo',

  'voice.title': "Don't read this. Press play instead.",
  'voice.play': 'Play',
  'voice.pause': 'Pause',

  'music.label': 'Music',
  'music.play': 'Play music',
  'music.pause': 'Pause music',

  'openWhen.title': 'Open when…',
  'openWhen.subtitle': 'For the days that need it.',
  'openWhen.locked': 'Not yet. Come back when the time is right.',
  'openWhen.oneTime': 'This one can only be opened once.',
  'openWhen.opened': 'Already opened',
  'openWhen.close': 'Close',

  'futureLetter.title': 'One more thing…',
  'futureLetter.locked': 'Not yet. Come back when the time is right.',
  'futureLetter.countdown': 'Unlocks in',
  'futureLetter.open': 'Read it',

  'surprise.intro': "That's everything. Well… almost.",
  'surprise.reveal': 'Reveal',
  'surprise.yes': 'Yes',
  'surprise.no': 'No',
  'surprise.submit': 'Send',
  'surprise.placeholder': 'Type your answer…',
  'surprise.thanks': 'Thank you. That means everything.',

  'closing.title': 'There will always be more memories to make.',
  'closing.replay': 'Read it again',

  'error.notFound': "This letter doesn't exist, or the link has changed.",
  'error.unavailable': 'This letter is not available right now.',
  'error.generic': 'Something went wrong. Please try again.',
  'error.retry': 'Try again',
} as const;

export type CopyKey = keyof typeof DEFAULT_COPY;
export const COPY_KEYS = Object.keys(DEFAULT_COPY) as CopyKey[];

/** Grouping used by the microcopy editor UI. */
export const COPY_GROUPS: { label: string; prefix: string }[] = [
  { label: 'Envelope', prefix: 'envelope.' },
  { label: 'PIN gate', prefix: 'pin.' },
  { label: 'Welcome', prefix: 'welcome.' },
  { label: 'Navigation', prefix: 'nav.' },
  { label: 'Timeline', prefix: 'timeline.' },
  { label: 'Gallery', prefix: 'gallery.' },
  { label: 'Voice letter', prefix: 'voice.' },
  { label: 'Music', prefix: 'music.' },
  { label: 'Open when', prefix: 'openWhen.' },
  { label: 'Future letter', prefix: 'futureLetter.' },
  { label: 'Final surprise', prefix: 'surprise.' },
  { label: 'Closing', prefix: 'closing.' },
  { label: 'Errors', prefix: 'error.' },
];

// ─── Customization: Feature toggles ───────────────────────────────────────────

/** Each module of the recipient experience can be switched off per experience. */
export const DEFAULT_FEATURES = {
  envelope: true,
  welcome: true,
  chapters: true,
  timeline: true,
  gallery: true,
  voiceLetter: true,
  music: true,
  openWhen: true,
  futureLetter: true,
  finalSurprise: true,
  closing: true,
  replay: true,
  scrollHint: true,
} as const;

export type FeatureKey = keyof typeof DEFAULT_FEATURES;
export const FEATURE_KEYS = Object.keys(DEFAULT_FEATURES) as FeatureKey[];

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  envelope: 'Envelope opening screen',
  welcome: 'Personal welcome',
  chapters: 'Story chapters',
  timeline: 'Memory timeline',
  gallery: 'Photo gallery',
  voiceLetter: 'Voice letter',
  music: 'Background music player',
  openWhen: '“Open when…” messages',
  futureLetter: 'Future letter',
  finalSurprise: 'Final surprise',
  closing: 'Closing screen',
  replay: 'Allow replay from the closing screen',
  scrollHint: 'Show scroll hints',
};

export interface ExperienceConfig {
  id: string;
  experienceId: string;
  navigationMode: NavigationMode;
  showProgressBar: boolean;
  enableConfetti: boolean;
  musicAutoplay: boolean;
  musicVolume: number;
  locale: string;
  dateFormat: string;
  copy: Partial<Record<CopyKey, string>>;
  features: Partial<Record<FeatureKey, boolean>>;
  createdAt: string;
  updatedAt: string;
}

// ─── Templates ────────────────────────────────────────────────────────────────

/** A block inside a template — same shape as ContentBlock but without ids. */
export interface TemplateBlock {
  type: BlockType;
  content: Record<string, unknown>;
  enabled?: boolean;
}

export interface TemplateSection {
  title: string;
  enabled?: boolean;
  blocks: TemplateBlock[];
}

export interface TemplateMemory {
  title: string;
  description?: string;
  location?: string;
  /** Days before today, so seeded timelines always look plausible. */
  daysAgo: number;
}

export interface TemplateOpenWhen {
  label: string;
  emoji?: string;
  content: string;
  unlockType?: UnlockType;
  /** Days from today; only used when unlockType is DATE_LOCKED. */
  unlockInDays?: number;
  isOneTime?: boolean;
}

export interface TemplateFutureLetter {
  title: string;
  content: string;
  /** Days from the moment the template is applied. */
  unlockInDays: number;
}

export interface TemplateFinalSurprise {
  question: string;
  buttonText?: string;
  successMessage: string;
  responseType?: ResponseType;
  options?: string[];
  ctaText?: string;
  ctaUrl?: string;
}

/** A complete, one-click starting point for an experience. */
export interface TemplateDefinition {
  slug: string;
  name: string;
  description: string;
  /** Short blurb shown on the template card. */
  tagline: string;
  eventType: EventType;
  /** Slug of a built-in theme to apply. */
  themeSlug: string;
  emoji: string;
  tags: string[];
  /** Rough time to fill it in, shown on the card. */
  estimatedMinutes: number;
  defaults: {
    title: string;
    openingMessage: string;
    closingMessage: string;
  };
  config?: {
    navigationMode?: NavigationMode;
    enableConfetti?: boolean;
    copy?: Partial<Record<CopyKey, string>>;
    features?: Partial<Record<FeatureKey, boolean>>;
  };
  sections: TemplateSection[];
  memories?: TemplateMemory[];
  openWhen?: TemplateOpenWhen[];
  futureLetter?: TemplateFutureLetter;
  finalSurprise?: TemplateFinalSurprise;
}

/** Card-sized view of a template, returned by GET /api/templates. */
export interface TemplateSummary {
  slug: string;
  name: string;
  description: string;
  tagline: string;
  eventType: EventType;
  themeSlug: string;
  emoji: string;
  tags: string[];
  estimatedMinutes: number;
  sectionCount: number;
  blockCount: number;
  includes: string[];
}

/** A single drop-in block (or small group) for the builder's preset picker. */
export interface BlockPreset {
  slug: string;
  name: string;
  description: string;
  emoji: string;
  category: 'Writing' | 'Media' | 'Moments' | 'Interactive' | 'Layout';
  blocks: TemplateBlock[];
}

// ─── Block content shapes ─────────────────────────────────────────────────────

export interface TextBlockContent {
  /** TipTap/ProseMirror JSON document. */
  doc?: unknown;
  /** Plain-text fallback, always kept in sync for search + templates. */
  text?: string;
  align?: 'left' | 'center' | 'right';
}

export interface HeadingBlockContent {
  text: string;
  level?: 1 | 2 | 3;
  align?: 'left' | 'center' | 'right';
  eyebrow?: string;
}

export interface ImageBlockContent {
  caption?: string;
  alt?: string;
  fit?: 'cover' | 'contain';
  rounded?: boolean;
}

export interface GalleryBlockContent {
  mediaIds: string[];
  layout?: 'grid' | 'masonry' | 'carousel';
  caption?: string;
}

export interface VideoBlockContent {
  caption?: string;
  autoplay?: boolean;
  loop?: boolean;
}

export interface AudioBlockContent {
  title?: string;
  description?: string;
  /** Renders as the full-screen "voice letter" section rather than an inline player. */
  isVoiceLetter?: boolean;
}

export interface QuoteBlockContent {
  text: string;
  attribution?: string;
}

export interface TimelineBlockContent {
  title?: string;
  /** Empty = every memory on the experience. */
  memoryIds?: string[];
  layout?: 'vertical' | 'alternating';
}

export interface CountdownBlockContent {
  targetDate: string;
  label?: string;
  completedText?: string;
}

export interface ButtonBlockContent {
  text: string;
  url?: string;
  style?: 'primary' | 'secondary' | 'ghost';
}

export interface DividerBlockContent {
  style?: 'line' | 'dots' | 'hearts' | 'space';
}

export interface OpenWhenBlockContent {
  title?: string;
  /** Empty = every "open when" message on the experience. */
  messageIds?: string[];
}

export interface FutureLetterBlockContent {
  showCountdown?: boolean;
}

export interface FinalQuestionBlockContent {
  /** Rendered from the experience's FinalSurprise record. */
  showIntro?: boolean;
}

export type BlockContentMap = {
  TEXT: TextBlockContent;
  HEADING: HeadingBlockContent;
  IMAGE: ImageBlockContent;
  GALLERY: GalleryBlockContent;
  VIDEO: VideoBlockContent;
  AUDIO: AudioBlockContent;
  TIMELINE: TimelineBlockContent;
  QUOTE: QuoteBlockContent;
  DIVIDER: DividerBlockContent;
  COUNTDOWN: CountdownBlockContent;
  OPEN_WHEN: OpenWhenBlockContent;
  FUTURE_LETTER: FutureLetterBlockContent;
  FINAL_QUESTION: FinalQuestionBlockContent;
  BUTTON: ButtonBlockContent;
};

/** Human labels + descriptions for the builder's "add block" menu. */
export const BLOCK_META: Record<
  BlockType,
  { label: string; description: string; emoji: string; needsMedia?: MediaType }
> = {
  HEADING: { label: 'Heading', description: 'A chapter title or section break', emoji: '🔤' },
  TEXT: { label: 'Text', description: 'Rich text — the words themselves', emoji: '📝' },
  QUOTE: { label: 'Quote', description: 'Something worth setting apart', emoji: '❝' },
  IMAGE: { label: 'Photo', description: 'A single image with an optional caption', emoji: '🖼️', needsMedia: 'IMAGE' },
  GALLERY: { label: 'Gallery', description: 'A grid of photos with a lightbox', emoji: '🎞️' },
  VIDEO: { label: 'Video', description: 'A short clip', emoji: '🎬', needsMedia: 'VIDEO' },
  AUDIO: { label: 'Audio', description: 'A voice note or a song', emoji: '🎧', needsMedia: 'AUDIO' },
  TIMELINE: { label: 'Timeline', description: 'Memories laid out in order', emoji: '🕰️' },
  COUNTDOWN: { label: 'Countdown', description: 'Ticking down to a date', emoji: '⏳' },
  OPEN_WHEN: { label: 'Open when…', description: 'A grid of sealed messages', emoji: '✉️' },
  FUTURE_LETTER: { label: 'Future letter', description: 'A letter that unlocks later', emoji: '🔒' },
  FINAL_QUESTION: { label: 'Final surprise', description: 'The reveal and the question', emoji: '🎁' },
  BUTTON: { label: 'Button', description: 'A link out to somewhere', emoji: '🔘' },
  DIVIDER: { label: 'Divider', description: 'A breath between ideas', emoji: '➖' },
};

// ─── Share ────────────────────────────────────────────────────────────────────

export interface ShareInfo {
  publicToken: string;
  url: string;
  qrDataUrl: string;
  status: ExperienceStatus;
  pinEnabled: boolean;
}

export interface PublishCheck {
  ok: boolean;
  issues: { code: string; message: string; fixPath?: string }[];
}

// ─── Helpers (shared by API and web) ──────────────────────────────────────────

/** Merge stored overrides over the defaults, ignoring unknown/blank keys. */
export function resolveCopy(overrides?: Partial<Record<string, unknown>> | null): Record<CopyKey, string> {
  const out = { ...DEFAULT_COPY } as Record<CopyKey, string>;
  if (overrides && typeof overrides === 'object') {
    for (const key of COPY_KEYS) {
      const value = (overrides as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim().length > 0) out[key] = value;
    }
  }
  return out;
}

export function resolveFeatures(
  overrides?: Partial<Record<string, unknown>> | null,
): Record<FeatureKey, boolean> {
  const out = { ...DEFAULT_FEATURES } as Record<FeatureKey, boolean>;
  if (overrides && typeof overrides === 'object') {
    for (const key of FEATURE_KEYS) {
      const value = (overrides as Record<string, unknown>)[key];
      if (typeof value === 'boolean') out[key] = value;
    }
  }
  return out;
}

/** Replace {recipient}, {sender}, {title} and {eventDate} tokens in a string. */
export function interpolate(template: string, tokens: Record<string, string | null | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = tokens[key];
    return value === undefined || value === null || value === '' ? match : value;
  });
}

/** CSS custom properties for a theme — the single source of truth for styling. */
export function themeToCssVars(theme: ThemeTokens | null | undefined): Record<string, string> {
  const t: ThemeTokens = theme ?? {
    primaryColor: '#1a1a1a',
    secondaryColor: '#6b7280',
    backgroundColor: '#fafafa',
    surfaceColor: '#ffffff',
    textColor: '#111111',
    mutedColor: '#6b7280',
    borderColor: '#e5e7eb',
    fontFamily: "'Inter', system-ui, sans-serif",
    headingFontFamily: "'Lora', Georgia, serif",
    baseFontSize: '16px',
    borderRadius: '0.75rem',
    backgroundGradient: null,
    animationLevel: 'NORMAL',
    transitionStyle: 'FADE',
    customCss: null,
  };

  const durations: Record<AnimationLevel, string> = {
    NONE: '0ms',
    MINIMAL: '120ms',
    NORMAL: '320ms',
    RICH: '600ms',
  };

  return {
    '--color-primary': t.primaryColor,
    '--color-secondary': t.secondaryColor,
    '--color-background': t.backgroundColor,
    '--color-surface': t.surfaceColor,
    '--color-text': t.textColor,
    '--color-muted': t.mutedColor,
    '--color-border': t.borderColor,
    '--font-body': t.fontFamily,
    '--font-heading': t.headingFontFamily,
    '--font-size-base': t.baseFontSize,
    '--radius': t.borderRadius,
    '--background-image': t.backgroundGradient ?? 'none',
    '--duration': durations[t.animationLevel],
    '--duration-slow': durations[t.animationLevel] === '0ms' ? '0ms' : `${parseInt(durations[t.animationLevel], 10) * 2}ms`,
  };
}

/** Whether motion should be rendered at all for this theme. */
export function prefersStillness(level: AnimationLevel | undefined): boolean {
  return level === 'NONE';
}
