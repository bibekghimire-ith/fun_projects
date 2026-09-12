# Implementation Plan

## Phase 0 — Foundation
Implement:
- repository structure
- pyproject.toml
- Flask app factory
- configuration
- extensions
- Dockerfile
- docker-compose.yml
- PostgreSQL
- migrations
- .env.example
- health endpoints
- logging
- request IDs
- pytest foundation
- Ruff/Black
- CI

Exit:
- Docker builds
- app starts
- DB migration succeeds
- health endpoints pass

## Phase 1 — Authentication
Implement:
- admin user
- password hashing
- login/logout
- session security
- CSRF
- rate limiting
- authorization decorator/service
- bootstrap strategy
- tests

Exit:
- admin can login
- unauthenticated users cannot access admin

## Phase 2 — Portfolio content
Implement:
- profile
- social links
- experience
- education
- skills
- projects
- certifications
- achievements
- resume
- ordering
- visibility
- migrations
- services
- admin UI
- tests

Exit:
- admin can manage portfolio entirely through UI

## Phase 3 — Template engine
Implement:
- template model/registry
- five templates
- active template setting
- shared content rendering
- responsive styling
- dark/light mode
- tests

Exit:
- switching templates changes presentation without changing content

## Phase 4 — Public portfolio
Implement:
- all public pages
- navigation
- homepage sections
- project details
- resume
- responsive behavior
- accessibility
- SEO foundations

Exit:
- public site is polished and usable

## Phase 5 — Blog CMS
Implement:
- posts
- Markdown
- sanitization
- categories
- tags
- drafts
- preview
- publishing
- scheduling abstraction
- featured posts
- SEO
- admin UI
- tests

Exit:
- admin can publish and manage articles

## Phase 6 — Blog discovery/SEO
Implement:
- pagination
- search
- category/tag pages
- related posts
- RSS
- sitemap
- robots
- OpenGraph
- canonical URLs
- reading time

Exit:
- blog is search-engine friendly and discoverable

## Phase 7 — Contact and media
Implement:
- contact form
- validation
- rate limiting
- email adapter
- persisted messages
- storage abstraction
- optional image upload
- tests

Exit:
- contact flow works without exposing secrets

## Phase 8 — Production hardening
Implement/review:
- security headers
- dependency audit
- container hardening
- non-root
- Gunicorn
- Nginx
- logging
- backups documentation
- migration procedure
- CI/CD readiness

Exit:
- production checklist passes

## Phase 9 — Final verification
Run:
- full tests
- coverage
- Ruff
- Black
- mypy
- Docker build
- Docker Compose
- clean DB migration
- smoke tests
- security tests
- documentation review

Only then declare release candidate.
