# Implementation Plan

## Phase 0 — Foundation
- monorepo
- FastAPI
- React
- PostgreSQL
- Alembic
- Docker Compose
- health endpoints
- CI
- lint/typecheck/test

## Phase 1 — Identity + feature flags
- registration/login/logout
- sessions
- roles
- relationships
- feature flag service
- admin feature management
- audit log

## Phase 2 — Experience core
- experience CRUD
- sections/blocks
- themes/templates
- publish lifecycle
- private public token
- PIN
- recipient renderer

## Phase 3 — Photos + playlist
- media abstraction
- albums
- gallery
- playlists
- audio
- 5 templates

## Phase 4 — Countdown
- countdown
- question/response
- clues
- unlocks
- post-event state
- 5 templates

## Phase 5 — Game
- game domain
- common game engine interface
- 5 game templates
- final question
- response capture

## Phase 6 — Relationship map
- MapLibre
- location CRUD
- privacy controls
- memory overlays
- 5 templates

## Phase 7 — Two perspectives
- collaborative memories
- permissions
- two-side renderer
- 5 templates

## Phase 8 — Pickup lines
- bilingual seed data
- search/filter/random/daily
- favorites
- collections
- admin moderation
- 8 templates

## Phase 9 — Hardening
- security testing
- accessibility
- performance
- PWA
- media optimization
- backups
- deletion flows

## Phase 10 — Deployment
- production Docker Compose
- reverse proxy
- HTTPS documentation
- AWS migration documentation
- free-hosting compatibility notes

## Rule

Complete and verify each vertical slice before moving on.
