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
  | 'RESPONSE_RECEIVED';

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

export interface Theme {
  id: string;
  name: string;
  slug: string;
  isBuiltIn: boolean;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  fontFamily: string;
  borderRadius: string;
  animationLevel: AnimationLevel;
}

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
  coverMedia: Media | null;
  musicMedia: Media | null;
  sections: ExperienceSection[];
  memories: Memory[];
  openWhenMessages: PublicOpenWhenMessage[];
  futureLetter: PublicFutureLetter | null;
  finalSurprise: FinalSurprise | null;
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
