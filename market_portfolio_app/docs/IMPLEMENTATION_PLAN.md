# Implementation Plan

## Phase 0 — Foundation
- repository structure
- pyproject.toml
- Flask app factory
- config
- Dockerfile
- compose
- PostgreSQL
- migrations
- health endpoints
- logging
- CI skeleton

Exit criteria: app boots and migration runs in Docker.

## Phase 1 — Identity and authorization
- user model
- registration/login/logout
- password hashing
- roles
- authorization helpers
- CSRF
- rate limiting
- tests

Exit criteria: authenticated user can securely access protected routes.

## Phase 2 — Portfolio domain
- instruments
- portfolios
- templates
- transactions
- cash movements
- validation
- migrations
- seed data

Exit criteria: user can create a portfolio and record transactions.

## Phase 3 — Financial engine
- holdings calculator
- cost basis
- realized/unrealized P&L
- allocation
- snapshots
- performance series
- exhaustive deterministic tests

Exit criteria: calculations pass hand-verifiable fixtures.

## Phase 4 — Dashboard/UI
- responsive layout
- navigation
- dashboard
- charts
- portfolio detail
- transaction UI
- empty/loading/error states
- dark/light mode

Exit criteria: complete primary user journey is usable.

## Phase 5 — Import/export
- CSV parser
- preview/mapping
- validation
- atomic import
- duplicate detection
- exports
- tests

## Phase 6 — Blog/CMS
- models
- admin UI
- editor
- preview
- sanitization
- publishing
- public pages
- SEO metadata
- tests

## Phase 7 — Production hardening
- security review
- dependency scan
- container hardening
- non-root
- production Gunicorn
- nginx
- backups documentation
- observability
- CI/CD
- deployment docs

## Phase 8 — Final verification
Run:
- full tests
- lint
- type checks
- docker compose build
- docker compose up
- migration from empty database
- smoke test
- security checklist
- documentation review

Never mark the project complete while any acceptance criterion is unverified.
