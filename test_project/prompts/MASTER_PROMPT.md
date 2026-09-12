# Claude Code Master Prompt — Our World

Act as a Principal Software Architect/Engineer with extensive experience in FAANG-scale product engineering, privacy/security, distributed systems, UX architecture, frontend architecture, Python, React, media systems, games, maps, testing, and DevOps.

Build the **Our World** platform according to:
- CLAUDE.md
- docs/PRD.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/template-system.md
- docs/api.md
- docs/implementation-plan.md
- docs/claude/skills/*
- docs/claude/agents/*
- docs/claude/commands/*

## Product

Build one unified private relationship platform with independently configurable modules:

1. Private Photos + Playlist
2. Countdown / Ask for Date-Trip
3. Tiny Dating / Proposal Game
4. Relationship Map
5. Two Perspectives
6. Pickup Lines in Nepali + English

The administrator can enable/disable each module independently. The architecture must also support a future SaaS mode with multiple accounts/relationships.

## Technical direction

Python-first backend:
- FastAPI
- SQLAlchemy
- Alembic
- PostgreSQL
- Pydantic

Frontend:
- React
- TypeScript
- Vite
- TanStack Query
- React Hook Form
- Framer Motion
- MapLibre
- Phaser where appropriate

Infrastructure:
- Docker
- Docker Compose
- MinIO/local storage abstraction
- later AWS S3-compatible deployment

## UX direction

Default design language:
**Premium minimal foundation + selectable personalities.**

Available personalities:
Minimal, Romantic, Cinematic, Playful, Nostalgic, Modern Gen-Z, Scrapbook, Elegant Dark.

Build multiple polished templates for each module. Templates must share domain models and design tokens.

## Critical product behavior

A recipient can open a private experience without creating an account.

Optional PIN.

The recipient flow should be cinematic and mobile-first.

No public search engine indexing.

No invasive tracking.

No autoplay audio before interaction.

Future letters and locked content must be enforced by the backend.

## Build order

Start with Phase 0 and Phase 1 from docs/implementation-plan.md.

Do not jump to all six modules immediately.

For every phase:
- inspect
- plan
- implement
- test
- review
- document
- only then continue

## Output expectations

Create actual runnable source code, migrations, seed data, tests, Docker configuration, CI, documentation, and example content.

Do not substitute placeholders for core functionality.

If a requirement is ambiguous, choose the simplest secure production-grade solution and record an ADR.

Before declaring completion, run the full verification suite.
