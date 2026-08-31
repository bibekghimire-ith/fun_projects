# A Letter From Me To You

A private, personalized digital letter — a birthday card, an anniversary
note, a thank-you, a goodbye — built for one specific person, sent as one
private link. A creator writes it in a purpose-built editor; the recipient's
side is a quiet, animated reading experience with no dashboard, no
navigation chrome, nothing but the letter itself.

> See [`Product_requirements.md`](./Product_requirements.md) and
> [`IMPLEMENTATION_PROMPT.md`](./IMPLEMENTATION_PROMPT.md) for the original
> product brief this was built against.

## What it does

- **A builder**, not a form: chapters made of blocks (text, photos, a
  gallery, video, a voice note or music, a memory timeline, a countdown, a
  grid of "open when…" messages, a letter that unlocks on a future date, a
  final surprise with a question, buttons, quotes, dividers), each
  reorderable by drag, each with its own content editor.
- **Ten packaged templates** (`packages/templates/templates/*.json`) —
  a birthday letter, an anniversary timeline, a valentine, a graduation
  letter, a farewell-to-a-colleague, a thank-you, a long-distance letter, and
  a blank canvas — plus **reusable presets** (`packages/templates/presets/`)
  for dropping a ready-made chunk (a chapter opener, a pull quote, a photo
  wall, a countdown, an "open when…" grid, …) into any letter, template or
  not. Both are just data — new ones are new JSON files, no code change.
- **Five built-in themes** (midnight, paper-love, minimal, sunset, memory)
  plus **custom themes**: fork a built-in, adjust its palette, typography and
  animation level, and it becomes reusable across the creator's own letters.
- **Per-experience customization**: every module of the recipient experience
  (the envelope, the welcome screen, chapters, the timeline, gallery, voice
  letter, music, open-when, future letter, final surprise, closing, replay,
  the scroll hint) can be switched off independently, and every piece of
  recipient-facing wording has an editable override with the default shown
  as a placeholder — see `packages/types/src/index.ts`'s `DEFAULT_COPY` and
  `COPY_GROUPS` for the full list.
- **A recipient side** with an optional 4-digit PIN gate (with lockout after
  repeated wrong attempts), an envelope-opening animation, one long scroll or
  one-chapter-at-a-time navigation, and a shareable link with a QR code.
- **Installable as a PWA** — a manifest, icons, and a service worker that
  precaches the app shell and never caches `/api/` responses (so a
  recipient's private letter data is never left sitting in a shared cache).

## Project structure

A pnpm workspace:

```
apps/api          Express + Prisma + PostgreSQL backend
apps/web           React + Vite frontend (creator builder + recipient experience)
packages/types      Shared TypeScript types, block/copy/feature definitions
packages/validation Zod schemas shared by the API and the web app
packages/templates  Packaged templates and presets (JSON, loaded at API startup)
tests/e2e           Playwright end-to-end specs (see tests/e2e/README.md)
prisma/             Prisma schema, migrations, and the seed script
```

## Getting started

Prerequisites: Node 20, pnpm 9, a PostgreSQL database.

```bash
pnpm install
cp .env.example apps/api/.env    # fill in DATABASE_URL and the three secrets
pnpm db:migrate
pnpm db:seed                     # optional — creates a demo creator account and sample letters
pnpm dev                         # API on :4000, web on :5173
```

`apps/api/.env` needs, at minimum, `DATABASE_URL` and three 32+ character
secrets (`JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `COOKIE_SECRET` — generate
each with `openssl rand -hex 32`). Everything else in `.env.example` has a
sensible default for local development.

## Testing

Three layers — see [`docs/testing.md`](./docs/testing.md) for the full
picture, and [`tests/e2e/README.md`](./tests/e2e/README.md) for the
end-to-end suite's own setup:

```bash
pnpm test          # API integration tests + web unit tests (needs Postgres)
pnpm test:e2e       # Playwright, against real running dev servers (needs Postgres)
pnpm lint
pnpm typecheck
```

## Architecture notes

- **Auth**: short-lived JWT access tokens (15m) plus an httpOnly refresh
  cookie (7d); the web client refreshes silently on a 401 rather than
  logging someone out mid-session.
- **Media**: uploaded files go through a `StorageProvider` abstraction
  (local disk in development, S3-compatible in production). A recipient's
  `<img>`/`<audio>`/`<video>` tags load a creator's still-private draft media
  via a short-lived, experience-scoped media token (`?mt=`) rather than an
  `Authorization` header, since plain HTML elements can't send one.
- **The public/recipient API** (`/api/public/e/:token`) is deliberately
  separate from the creator API: it never reveals whether a letter exists
  behind an unknown token, gates its response behind a PIN when one is set,
  and is the only part of the backend a recipient's browser ever talks to.
- **Config resolution**: an experience's feature toggles and copy overrides
  are sparse — only what a creator actually changed is stored — and merged
  over the defaults at read time (`resolveFeatures`/`resolveCopy` in
  `packages/types`), so a new default feature or copy key added later
  applies automatically to every existing letter that never overrode it.
