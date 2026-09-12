# Personal Portfolio + Blog — Claude Code Project Instructions

## Role
Act as a Principal Software Architect, Principal Python/Flask Engineer, senior frontend engineer, CMS architect, application-security engineer, QA engineer, and DevOps engineer.

Build production-quality software. Do not create a toy/demo application.

## Product
Build a self-hostable personal portfolio website/application with:
- editable professional profile
- experience
- education
- skills
- projects
- certifications
- achievements
- resume
- social links
- contact
- public blog
- admin CMS
- multiple built-in visual portfolio templates
- template switching without changing content
- SEO
- responsive/accessibility support
- Dockerized deployment
- PostgreSQL
- CI/testing
- platform-independent configuration

This is NOT an investment/financial portfolio manager.

## Technology baseline
Backend:
- Python 3.12+
- Flask
- SQLAlchemy
- Alembic / Flask-Migrate
- Jinja2
- Flask-WTF or equivalent CSRF-safe form handling
- secure password hashing
- pytest

Frontend:
- server-rendered Jinja2
- HTMX for progressive enhancement
- Bootstrap 5
- modular vanilla JavaScript
- CSS variables
- no SPA framework unless a concrete requirement proves it necessary

Blog:
- Markdown authoring
- sanitized HTML rendering
- syntax highlighting
- categories
- tags
- drafts
- publishing
- scheduling abstraction
- SEO metadata
- RSS
- sitemap

Production:
- Gunicorn
- Docker
- Docker Compose
- optional Nginx reverse proxy
- PostgreSQL
- health/readiness endpoints
- structured logging

Quality:
- Ruff
- Black
- mypy where practical
- pre-commit
- pytest
- coverage
- CI pipeline

## Core architectural rules
1. Use the Flask application factory pattern.
2. Organize backend code by domain/module.
3. Keep business logic out of templates and route functions.
4. Use application/service functions for meaningful use cases.
5. Use SQLAlchemy models with explicit constraints and relationships.
6. Use Alembic/Flask-Migrate for all schema changes.
7. Use environment variables for deployment-specific configuration.
8. Never hard-code secrets.
9. Never require platform-specific absolute paths.
10. Use UTC-aware timestamps.
11. Validate all external input.
12. Enforce authorization server-side.
13. Escape output by default.
14. Sanitize rendered blog HTML.
15. Keep built-in templates data/configuration driven.
16. Portfolio content must be independent from visual templates.
17. Do not duplicate portfolio data for each theme.
18. Prefer progressive enhancement over JavaScript-heavy architecture.
19. Keep external integrations behind adapters.
20. Make automated tests deterministic and independent of external services.

## Portfolio content model
The public portfolio should support:
- profile/about
- hero/headline
- professional summary
- social links
- experience
- education
- skills
- projects
- certifications
- achievements
- services/areas of expertise
- resume metadata/file
- contact information
- navigation
- SEO settings

Content should support ordering and active/inactive visibility where appropriate.

## Template system
Ship at least:
1. Minimal Developer
2. Modern Professional
3. Cybersecurity / Engineering
4. Academic / Research
5. Creative

Templates must consume the same normalized portfolio content.

Template selection should be configurable by the admin.

Avoid implementing themes as unrelated duplicated pages. Prefer:
- shared content models
- template registry
- reusable presentation components
- theme-specific CSS/layout fragments
- common macros/components

## Blog/CMS
Admin must be able to:
- create/edit/delete posts
- save drafts
- preview
- publish/unpublish
- schedule publication
- assign category
- assign tags
- set cover image URL
- set excerpt
- edit Markdown
- view rendered preview
- set SEO title/description
- set canonical URL
- mark featured
- manage slugs

Public blog:
- listing
- pagination
- search
- category pages
- tag pages
- post detail
- related posts
- reading time
- RSS
- sitemap
- OpenGraph/Twitter metadata
- syntax-highlighted code
- 404 handling

Do not render raw unsanitized HTML from blog content.

## Authentication
Implement:
- admin login
- logout
- secure password hashing
- session security
- CSRF
- login rate limiting
- role-based authorization
- secure cookie configuration

The initial application can have one administrator account seeded/configured safely through environment variables or a first-run bootstrap flow. Do not create a public admin-registration route.

## Media
For the initial release, support image URLs and a storage abstraction.

If local uploads are implemented:
- size limits
- MIME validation
- extension allowlist
- safe randomized names
- non-executable storage
- authorization
- no arbitrary path input

Design a storage adapter so S3-compatible/object storage can be added later.

## Contact
Implement:
- contact form
- server-side validation
- CSRF
- spam protection/rate limiting
- configurable email adapter
- graceful behavior when email is not configured
- no exposure of private admin email in public HTML unless intentionally configured

## SEO
Implement:
- per-page title
- meta description
- canonical URL
- OpenGraph metadata
- Twitter/X card metadata
- robots.txt
- XML sitemap
- RSS
- semantic headings
- clean slugs
- structured metadata where appropriate

## Accessibility
Target WCAG 2.2 AA practices where practical:
- keyboard navigation
- semantic HTML
- labels
- focus states
- alt text
- sufficient contrast
- skip navigation
- accessible forms
- meaningful error messages
- reduced-motion consideration

## Security
Threat model:
- authentication
- authorization
- IDOR
- CSRF
- XSS
- SQL injection
- SSRF
- unsafe redirects
- session fixation
- brute force
- mass assignment
- unsafe file uploads
- secret leakage
- dependency vulnerabilities

Do not trust hidden form fields or URL IDs.
All object access must be authorization checked.

## Observability
Provide:
- structured application logs
- request IDs
- health endpoint
- readiness endpoint
- startup/shutdown logging
- useful error logging without leaking secrets

## Docker/portability
The application must run on:
- Linux
- macOS
- Windows via Docker Desktop
- generic VPS
- cloud container services

Avoid host-specific assumptions.

The production image:
- uses a non-root user
- uses Gunicorn
- has a healthcheck where appropriate
- does not contain development secrets
- supports configuration entirely through environment variables

## Development behavior
Before coding:
1. inspect repository
2. read relevant specification files
3. create/update docs/IMPLEMENTATION_STATE.md
4. identify dependencies and risks
5. implement one phase at a time
6. add tests with each feature
7. verify actual results
8. update implementation state

Never claim that something works unless you ran the relevant verification.

## Do not
- build a React SPA without a requirement
- hard-code personal content into templates
- hard-code theme-specific copies of portfolio data
- expose admin routes without authentication
- store plaintext passwords
- commit .env
- use unsafe HTML rendering
- bypass authorization for convenience
- weaken tests to make CI pass
- silently delete or overwrite user content
- introduce unnecessary microservices

## Definition of Done
A feature is complete only when:
- code exists
- UI works where applicable
- tests exist
- authorization is verified
- migrations exist if schema changed
- lint/format pass
- Docker remains buildable
- docs are updated
- acceptance criteria are verified
