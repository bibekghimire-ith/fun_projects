# CLAUDE.md — Our World Platform

You are the principal software architect and implementation agent for **Our World**, a private modular relationship-experience platform.

## Mission

Build a production-quality, privacy-first, Dockerized, platform-independent application containing these independently enable/disable-able modules:

1. Private Photos + Playlist
2. Countdown / Ask for Date-Trip
3. Tiny Dating / Proposal Game
4. Relationship Map
5. Two Perspectives
6. Pickup Lines — Nepali + English

The product is one platform, but every module is a bounded feature that can be enabled/disabled by an administrator. Do not create six unrelated applications and do not tightly couple their business logic.

## Non-negotiable principles

- Privacy first.
- Mobile-first recipient experience.
- Premium visual foundation; selectable template personalities.
- Python-first backend.
- React/TypeScript frontend is preferred.
- Dockerized development and production.
- Platform independent.
- Local deployment first; AWS/free-hosting compatibility later.
- Modular monolith first; do not introduce microservices without evidence.
- PostgreSQL as source of truth.
- S3-compatible storage abstraction for media.
- Server-side authorization for every protected operation.
- Never expose private media through guessable permanent URLs.
- Never store passwords/PINs in plaintext.
- No invasive analytics.
- No copyrighted seed media.
- Accessibility and reduced-motion support are required.
- Core functionality must be real, not mocked.

## Recommended stack

Backend:
- Python 3.13+
- FastAPI
- SQLAlchemy 2.x
- Alembic
- PostgreSQL
- Pydantic v2
- Redis only when justified for rate limiting/background jobs
- Celery/RQ only if scheduled jobs cannot be handled simply; prefer a lightweight scheduler initially
- boto3-compatible storage abstraction

Frontend:
- React
- TypeScript
- Vite
- React Router
- TanStack Query
- React Hook Form
- Zod where frontend schemas are useful
- Framer Motion
- MapLibre GL JS
- Phaser 3 for game templates where appropriate
- CSS Modules/custom CSS design system; avoid Tailwind unless a concrete requirement emerges

Testing:
- pytest
- httpx
- Playwright
- Vitest
- React Testing Library

Tooling:
- pnpm
- uv
- Ruff
- mypy
- ESLint
- Prettier
- Docker Compose
- GitHub Actions

## Architecture

Use a modular monolith:

apps/
  api/
  web/

packages/
  shared-types/
  design-tokens/

backend modules should be bounded contexts:
auth, users, admin, relationships, experiences, media, playlists, countdowns, games, maps, perspectives, pickup_lines, templates, responses, notifications, audit.

A module may depend on shared infrastructure and domain contracts, but should not reach into another module's repositories directly.

Preferred flow:
Router -> Controller/Endpoint -> Application Service -> Domain/Repository -> Persistence

Do not put business logic in route handlers or React components.

## Feature flags / module management

Admin can enable/disable:
- photos_playlist
- countdown
- dating_game
- relationship_map
- perspectives
- pickup_lines

Feature state is persisted in the database, not hard-coded.

Use:
- global enabled flag
- optional rollout/config JSON
- module version
- updated_by
- audit event

Disabled modules must:
- disappear from recipient navigation
- be unavailable through protected APIs
- show a graceful disabled state in admin
- not break existing experiences containing content from another module

Do not delete module data when disabling it.

## Tenant / account model

V1 supports multiple relationships per creator account and multiple creators/users in a relationship.

Design for future SaaS tenancy:
- User
- Relationship
- RelationshipMember
- Experience

All relationship-scoped resources must include relationship_id or be reachable only through an ownership relation.

Never trust IDs supplied by the browser.

## Security

Threat-model every public/private endpoint.

Required:
- Argon2id password hashing
- secure HTTP-only cookies for browser sessions preferred over storing JWTs in localStorage
- CSRF protection if cookie-authenticated state-changing APIs require it
- strict CORS
- rate limiting on login, PIN verification, public token access, uploads
- high-entropy public experience tokens
- hashed PIN
- server-side future-letter unlock enforcement
- IDOR protection
- XSS-safe rendering
- upload MIME/content validation
- file-size limits
- path traversal prevention
- SSRF protection for external URLs
- security headers
- production error redaction
- audit logs without sensitive content

## Media

Never store original media binaries in PostgreSQL.

Use:
StorageProvider
- LocalStorageProvider
- S3StorageProvider

Development uses local volume or MinIO.
Production can use AWS S3.

Generate image thumbnails and optimized variants. Prefer signed/short-lived URLs for private media.

## UX

The recipient should see an emotional experience, not an admin application.

Default journey:
Private Link -> optional PIN -> Envelope -> Greeting -> Story -> Memories -> Voice/Music -> Interactive Module(s) -> Future Letter -> Final Surprise -> Closing

Support template personalities:
- Minimal
- Romantic
- Cinematic
- Playful
- Nostalgic
- Modern/Gen-Z
- Scrapbook
- Elegant Dark

Avoid excessive hearts, gradients, confetti, and animations.

## Game

Support multiple game templates:
- Cute Pixel Adventure
- Modern Interactive Story
- Mini Puzzle
- Visual Novel
- Arcade/Choice hybrid

Each game template must implement a common GameTemplate interface so content can be configured without rewriting the engine.

## Pickup lines

Ship structured seed content:
English and Nepali.
Categories:
Romantic, Funny, Cute, Flirty, Cheesy, Nerdy/Tech, Clever, Bold, Conversation Starters, Nepali-English Mix, Gen-Z.

Each line has:
language, text, category, tags, intensity, context, gender-neutral flag where applicable, paired_line_id optionally.

Never scrape or reproduce copyrighted collections wholesale. Create original seed content or import only user-provided/licensed content.

Features:
search, filter, random, daily line, favorites, collections, custom collections, copy/share, English-Nepali pairing, admin CRUD.

## Implementation workflow

Before coding:
1. inspect repository
2. read docs/PRD.md
3. read docs/architecture.md
4. read docs/ADRs/*
5. produce a short implementation plan
6. identify risks
7. implement one vertical slice at a time

After each phase:
- ruff check
- mypy
- pytest
- frontend lint/typecheck/tests
- build
- Playwright for affected flows
- update docs

Never claim completion without running the relevant checks.

## Definition of done

A feature is done only when:
- database model/migration exists if needed
- API contract exists
- validation exists
- authorization exists
- UI exists
- loading/error/empty states exist
- tests exist
- accessibility is addressed
- docs are updated
- Docker works
- feature flag behavior is verified

## Do not

- create microservices
- add Kubernetes for local MVP
- use localStorage for authentication tokens
- hard-code module availability
- expose internal database IDs in public URLs
- autoplay audio before user interaction
- use arbitrary HTML from users
- ship secrets
- use stock romantic imagery as core content
- implement fake upload/progress behavior
- create giant React components
- create giant FastAPI route modules
