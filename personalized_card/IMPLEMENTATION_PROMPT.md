# "A Letter From Me To You" — Senior Engineer Implementation Prompt

> Derived from Product_requirements.md. Improvements & clarifications noted inline.

---

## PRD Analysis & Key Improvements

### Ambiguities Resolved

1. **State Management**: PRD lists TanStack Query but no global store. Use Zustand for UI state (theme, music player, open-when state) + TanStack Query for server state.
2. **"Choose Your Adventure" (§4.10)**: Defer to V2 — implementing a full directed-graph editor significantly increases MVP complexity. Architecture supports it via nullable `nextSectionId` FK on sections.
3. **PIN storage**: Store bcrypt hash of PIN in DB (not raw). Rate-limit at 5 attempts / 15-min window via Redis or in-memory map.
4. **Drag-and-drop**: Use `@dnd-kit/core` — lighter than react-beautiful-dnd, maintained, accessible.
5. **QR code**: Include in MVP using `qrcode` npm package — it's trivial and high-value.
6. **PWA**: Include manifest + service worker for static assets only. Do NOT cache media blobs (privacy).
7. **Scheduler**: Use `node-cron` for checking future-letter unlocks hourly. Backend enforces date, not frontend.
8. **Monorepo tool**: Use pnpm workspaces. No Turborepo (unnecessary for MVP).
9. **Auth**: Use short-lived JWT (15min) + httpOnly refresh token cookie (7 days). Argon2id for passwords.
10. **Rich text in chapters**: Use `TipTap` (headless, accessible) — not arbitrary HTML, outputs structured JSON stored as `content` JSONB.

### Added Clarifications Not In Original PRD

- **Music player persistence**: Floating player persists across recipient sections; does NOT restart on section change.
- **Open When unlock types**: `IMMEDIATE`, `DATE_LOCKED`, `MANUAL` (creator unlocks from dashboard). `ONE_TIME` flag is orthogonal.
- **Cover image**: Required for published experience. Enforce at publish time, not at creation.
- **Closing screen**: Always shown after Final Surprise. Creator can customize text + optional image.
- **Seed user**: `creator@example.com` / `Password123!` with full sample experience for "Alex".

---

## Technology Stack (Confirmed)

### Frontend (`apps/web`)
- React 18 + TypeScript 5 (strict)
- Vite 5
- React Router v6
- CSS Modules (semantic, no Tailwind)
- Framer Motion (animations)
- React Hook Form + Zod (forms)
- TanStack Query v5 (server state)
- Zustand (UI state: music, theme preview)
- TipTap (rich text editor)
- @dnd-kit/core (drag-and-drop reordering)
- qrcode (QR generation)

### Backend (`apps/api`)
- Node.js 20 LTS + TypeScript 5 (strict)
- Express 4
- Prisma 5 + PostgreSQL 16
- Argon2 (password hashing)
- jsonwebtoken (JWT)
- multer + sharp (image upload + resize)
- fluent-ffmpeg (audio/video validation - optional)
- node-cron (scheduled unlock checks)
- express-rate-limit
- helmet
- zod (validation)
- winston (structured logging)

### Infrastructure
- Docker + docker-compose
- MinIO (local S3-compatible storage)
- GitHub Actions CI

---

## Database Schema (Prisma)

```prisma
model User {
  id           String       @id @default(uuid())
  email        String       @unique
  passwordHash String
  name         String
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  experiences  Experience[]
  auditLogs    AuditLog[]
}

model Experience {
  id              String              @id @default(uuid())
  userId          String
  user            User                @relation(fields: [userId], references: [id])
  title           String
  recipientName   String
  eventType       EventType
  eventDate       DateTime?
  openingMessage  String?             // configurable greeting text
  closingMessage  String?
  status          ExperienceStatus    @default(DRAFT)
  publicToken     String              @unique
  pinHash         String?
  pinEnabled      Boolean             @default(false)
  themeId         String?
  theme           Theme?              @relation(fields: [themeId], references: [id])
  coverMediaId    String?
  musicMediaId    String?
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt
  sections        ExperienceSection[]
  media           Media[]
  memories        Memory[]
  openWhenMessages OpenWhenMessage[]
  futureLetter    FutureLetter?
  finalSurprise   FinalSurprise?
  responses       Response[]
  accessLogs      ExperienceAccess[]
  auditLogs       AuditLog[]

  @@index([userId])
  @@index([publicToken])
  @@index([status])
}

enum EventType {
  BIRTHDAY
  ANNIVERSARY
  VALENTINES
  CUSTOM
}

enum ExperienceStatus {
  DRAFT
  PUBLISHED
  UNPUBLISHED
  REVOKED
}

model ExperienceSection {
  id           String         @id @default(uuid())
  experienceId String
  experience   Experience     @relation(fields: [experienceId], references: [id], onDelete: Cascade)
  title        String
  order        Int
  enabled      Boolean        @default(true)
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  blocks       ContentBlock[]

  @@index([experienceId])
}

model ContentBlock {
  id        String       @id @default(uuid())
  sectionId String
  section   ExperienceSection @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  type      BlockType
  order     Int
  enabled   Boolean      @default(true)
  content   Json         // flexible JSONB per block type
  mediaId   String?
  media     Media?       @relation(fields: [mediaId], references: [id])
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  @@index([sectionId])
}

enum BlockType {
  TEXT
  HEADING
  IMAGE
  GALLERY
  VIDEO
  AUDIO
  TIMELINE
  QUOTE
  DIVIDER
  COUNTDOWN
  OPEN_WHEN
  FUTURE_LETTER
  FINAL_QUESTION
  BUTTON
}

model Media {
  id           String         @id @default(uuid())
  experienceId String
  experience   Experience     @relation(fields: [experienceId], references: [id], onDelete: Cascade)
  type         MediaType
  originalName String
  storagePath  String
  thumbnailPath String?
  mimeType     String
  size         Int
  width        Int?
  height       Int?
  duration     Int?           // seconds for audio/video
  createdAt    DateTime       @default(now())
  contentBlocks ContentBlock[]

  @@index([experienceId])
}

enum MediaType {
  IMAGE
  VIDEO
  AUDIO
}

model Memory {
  id           String     @id @default(uuid())
  experienceId String
  experience   Experience @relation(fields: [experienceId], references: [id], onDelete: Cascade)
  date         DateTime
  title        String
  description  String?
  location     String?
  order        Int
  mediaId      String?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@index([experienceId])
}

model OpenWhenMessage {
  id           String          @id @default(uuid())
  experienceId String
  experience   Experience      @relation(fields: [experienceId], references: [id], onDelete: Cascade)
  label        String          // "you miss me"
  emoji        String?
  content      String
  mediaId      String?
  unlockType   UnlockType      @default(IMMEDIATE)
  unlockDate   DateTime?
  isOneTime    Boolean         @default(false)
  openedAt     DateTime?
  order        Int
  createdAt    DateTime        @default(now())

  @@index([experienceId])
}

enum UnlockType {
  IMMEDIATE
  DATE_LOCKED
  MANUAL
}

model FutureLetter {
  id           String     @id @default(uuid())
  experienceId String     @unique
  experience   Experience @relation(fields: [experienceId], references: [id], onDelete: Cascade)
  title        String
  content      String
  unlockDate   DateTime
  mediaId      String?
  unlockedAt   DateTime?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@index([unlockDate])
}

model FinalSurprise {
  id              String       @id @default(uuid())
  experienceId    String       @unique
  experience      Experience   @relation(fields: [experienceId], references: [id], onDelete: Cascade)
  question        String
  buttonText      String       @default("Reveal")
  successMessage  String
  responseType    ResponseType @default(YES_NO)
  options         Json?        // for MULTIPLE_CHOICE
  mediaId         String?
  ctaText         String?
  ctaUrl          String?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}

enum ResponseType {
  YES_NO
  SINGLE_BUTTON
  MULTIPLE_CHOICE
  TEXT_INPUT
}

model Theme {
  id              String       @id @default(uuid())
  name            String
  slug            String       @unique
  isBuiltIn       Boolean      @default(false)
  primaryColor    String
  secondaryColor  String
  backgroundColor String
  surfaceColor    String
  textColor       String
  fontFamily      String
  borderRadius    String
  animationLevel  AnimationLevel @default(NORMAL)
  experiences     Experience[]
}

enum AnimationLevel {
  NONE
  MINIMAL
  NORMAL
  RICH
}

model Response {
  id           String     @id @default(uuid())
  experienceId String
  experience   Experience @relation(fields: [experienceId], references: [id], onDelete: Cascade)
  answer       String
  respondedAt  DateTime   @default(now())

  @@index([experienceId])
}

model ExperienceAccess {
  id           String     @id @default(uuid())
  experienceId String
  experience   Experience @relation(fields: [experienceId], references: [id], onDelete: Cascade)
  ipHash       String?    // hashed, not raw IP
  userAgent    String?
  accessedAt   DateTime   @default(now())

  @@index([experienceId])
}

model AuditLog {
  id           String     @id @default(uuid())
  userId       String?
  user         User?      @relation(fields: [userId], references: [id])
  experienceId String?
  experience   Experience? @relation(fields: [experienceId], references: [id])
  action       AuditAction
  metadata     Json?
  createdAt    DateTime   @default(now())

  @@index([userId])
  @@index([experienceId])
}

enum AuditAction {
  EXPERIENCE_CREATED
  EXPERIENCE_UPDATED
  EXPERIENCE_PUBLISHED
  EXPERIENCE_UNPUBLISHED
  EXPERIENCE_REVOKED
  MEDIA_UPLOADED
  MEDIA_DELETED
  PIN_ENABLED
  PIN_DISABLED
  RESPONSE_RECEIVED
}
```

---

## API Routes (Complete)

### Auth
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/me
```

### Experiences (Creator, authenticated)
```
GET    /api/experiences
POST   /api/experiences
GET    /api/experiences/:id
PATCH  /api/experiences/:id
DELETE /api/experiences/:id
POST   /api/experiences/:id/publish
POST   /api/experiences/:id/unpublish
POST   /api/experiences/:id/revoke
GET    /api/experiences/:id/share        -- returns token + QR URL
```

### Sections
```
GET    /api/experiences/:id/sections
POST   /api/experiences/:id/sections
PATCH  /api/sections/:id
DELETE /api/sections/:id
POST   /api/sections/:id/reorder
```

### Blocks
```
GET    /api/sections/:id/blocks
POST   /api/sections/:id/blocks
PATCH  /api/blocks/:id
DELETE /api/blocks/:id
POST   /api/sections/:id/blocks/reorder
```

### Media
```
POST   /api/media/upload          -- multipart
GET    /api/media/:id
DELETE /api/media/:id
GET    /api/media/:id/stream      -- streaming endpoint
```

### Memories
```
GET    /api/experiences/:id/memories
POST   /api/experiences/:id/memories
PATCH  /api/memories/:id
DELETE /api/memories/:id
POST   /api/experiences/:id/memories/reorder
```

### Open When
```
GET    /api/experiences/:id/open-when
POST   /api/experiences/:id/open-when
PATCH  /api/open-when/:id
DELETE /api/open-when/:id
POST   /api/open-when/:id/manual-unlock  -- creator unlocks manually
```

### Future Letter
```
GET    /api/experiences/:id/future-letter
PUT    /api/experiences/:id/future-letter
DELETE /api/experiences/:id/future-letter
```

### Final Surprise
```
GET    /api/experiences/:id/final-surprise
PUT    /api/experiences/:id/final-surprise
DELETE /api/experiences/:id/final-surprise
```

### Theme
```
GET    /api/themes               -- built-in themes
POST   /api/experiences/:id/theme -- set theme for experience
```

### Public (Recipient, no auth)
```
GET    /api/public/e/:token           -- get experience (checks published + PIN)
POST   /api/public/e/:token/verify    -- verify PIN
GET    /api/public/e/:token/open-when/:msgId  -- open a message (checks unlock)
GET    /api/public/e/:token/future-letter     -- checks server-side date
POST   /api/public/e/:token/respond   -- save final surprise response
```

---

## Frontend Routes

```
/login
/register

/dashboard
/experiences
/experiences/new
/experiences/:id/edit          -- experience builder (sections, blocks)
/experiences/:id/memories      -- timeline editor
/experiences/:id/open-when     -- open when editor
/experiences/:id/future-letter -- future letter editor
/experiences/:id/surprise      -- final surprise editor
/experiences/:id/theme         -- theme picker
/experiences/:id/preview       -- full-screen preview (recipient view)
/experiences/:id/share         -- publish + share page

/e/:token                      -- recipient: envelope/landing
/e/:token/pin                  -- recipient: PIN gate
/e/:token/open                 -- recipient: full experience viewer
```

---

## Five Built-In Themes

| Slug | Name | Palette | Vibe |
|---|---|---|---|
| `midnight` | Midnight | `#0a0a0f` bg, `#c084fc` accent | Dark, cinematic |
| `paper-love` | Paper Love | `#fdf6e3` bg, `#8b5e3c` accent | Warm, handwritten |
| `minimal` | Minimal | `#fafafa` bg, `#1a1a1a` accent | Clean, typographic |
| `sunset` | Sunset | `#fff1e6` bg, `#e85d04` accent | Warm gradient |
| `memory` | Memory | `#f5f0eb` bg, `#5c7a6c` accent | Scrapbook modern |

---

## Recipient Experience Flow (Detailed)

1. **Landing** (`/e/:token`) — Full-screen envelope. Subtle pulse animation. "A letter for you." Open button.
2. **PIN Gate** (`/e/:token/pin`) — If enabled. 4-digit keypad. Rate limited.
3. **Welcome** — Fade in. Recipient name. Opening message. Soft music starts (after interaction).
4. **Sections** — Scroll or paginated chapters. Each section animates in as user reaches it.
5. **Timeline** — Vertical scroll timeline with year markers.
6. **Gallery** — Lightbox grid. Swipeable on mobile.
7. **Voice Letter** — Dedicated full-screen player section.
8. **Open When** — Grid of sealed envelopes. Tap to reveal (if unlocked).
9. **Future Letter** — Countdown or reveal if date passed.
10. **Final Surprise** — Dramatic reveal button.
11. **Response** — Answer recorded.
12. **Closing** — Final message + optional confetti (subtle).

---

## Build Phases (Strict)

### Phase 1 — Foundation
- [ ] Monorepo setup (pnpm workspaces)
- [ ] `apps/api`: Express + TypeScript + Prisma + PostgreSQL
- [ ] `apps/web`: Vite + React + TypeScript
- [ ] `packages/types`: Shared TypeScript types
- [ ] `packages/validation`: Shared Zod schemas
- [ ] Docker + docker-compose (postgres + minio + api + web)
- [ ] `.env.example`
- [ ] ESLint + Prettier
- [ ] Basic CI (lint + typecheck)

### Phase 2 — Auth & Experience CRUD
- [ ] User registration + login (Argon2 + JWT + refresh cookie)
- [ ] Auth middleware
- [ ] Experience CRUD API (full ownership checks)
- [ ] Audit logging
- [ ] Creator dashboard UI (basic)
- [ ] Experience list + create form

### Phase 3 — Builder & Themes
- [ ] Section CRUD API + reorder
- [ ] Block CRUD API + reorder
- [ ] Experience builder UI (drag-and-drop sections/blocks)
- [ ] Theme system (5 built-in themes)
- [ ] Theme picker UI
- [ ] Design tokens / CSS variables per theme

### Phase 4 — Media
- [ ] Media upload API (multer + sharp for images)
- [ ] Local storage provider (filesystem)
- [ ] MinIO/S3 storage provider
- [ ] Streaming endpoints (audio/video)
- [ ] Image thumbnails + optimized versions
- [ ] Media library UI
- [ ] Upload component with progress

### Phase 5 — Recipient Experience
- [ ] Public API endpoints
- [ ] Envelope page + animation
- [ ] PIN page + verification
- [ ] Welcome section
- [ ] Story/chapter sections
- [ ] Photo gallery + lightbox
- [ ] Timeline view
- [ ] Music player (floating, persistent)
- [ ] Voice letter player
- [ ] Full mobile responsiveness

### Phase 6 — Special Content
- [ ] Open When system (API + UI)
- [ ] Future Letter (API + countdown + server-side unlock)
- [ ] Final Surprise (API + reveal animation)
- [ ] Response recording
- [ ] Closing screen
- [ ] Creator response dashboard

### Phase 7 — Security & Quality
- [ ] PIN rate limiting + lockout
- [ ] API rate limiting (express-rate-limit)
- [ ] Helmet (security headers)
- [ ] Input sanitization
- [ ] IDOR prevention audit
- [ ] Publish flow + share page
- [ ] QR code generation
- [ ] Preview mode

### Phase 8 — Polish & Production
- [ ] PWA manifest + service worker
- [ ] Performance optimization (lazy loading, code splitting)
- [ ] Accessibility audit
- [ ] Error states (all variants)
- [ ] Seed data (Alex's birthday experience)
- [ ] Unit tests (Vitest)
- [ ] Integration tests
- [ ] E2E tests (Playwright)
- [ ] Security tests
- [ ] Documentation (README + docs/)
- [ ] Docker build validation

---

## Key Architectural Decisions

1. **PostgreSQL + Prisma**: Relational data with type-safe ORM. Migrations as first-class citizens.
2. **REST over GraphQL**: Simpler for this use case. Fewer attack surfaces. Easier to rate-limit per route.
3. **JWT + httpOnly refresh cookie**: Stateless access token, cookie-based refresh prevents XSS token theft.
4. **Media abstraction**: `StorageProvider` interface with `LocalStorageProvider` and `S3StorageProvider`. Never import aws-sdk directly in business logic.
5. **Server-enforced future unlock**: Frontend shows countdown for UX, but `/api/public/e/:token/future-letter` returns 423 with `unlockDate` until server date passes.
6. **TipTap for rich text**: Outputs structured ProseMirror JSON (stored as JSONB). Frontend renders without `dangerouslySetInnerHTML`.
7. **Zustand for UI state**: Music player state (playing/paused/currentTime) and theme preview live in Zustand, not in server state.
8. **pnpm workspaces**: Shared `packages/types` eliminates type drift between frontend and backend.

---

## Microcopy Reference

Use these phrases throughout the recipient experience:

- "Take your time. There's no rush."
- "I made this for you."
- "Some memories deserve another look."
- "Not yet. Come back when the time is right."
- "One more thing..."
- "That's everything. Well... almost."
- "There will always be more memories to make."
- "Don't read this. Press play instead."

---

## Anti-Checklist (Never Do)

- [ ] Never use `dangerouslySetInnerHTML` with unsanitized user content
- [ ] Never return raw DB errors to client
- [ ] Never log PINs, passwords, or tokens
- [ ] Never expose creator email/ID in public API
- [ ] Never use sequential numeric IDs for public URLs
- [ ] Never autoplay audio before user interaction
- [ ] Never cache media in service worker without expiry
- [ ] Never put business logic in route handlers
- [ ] Never trust client-supplied file extensions
- [ ] Never trust `new Date() > unlockDate` on frontend as security gate
