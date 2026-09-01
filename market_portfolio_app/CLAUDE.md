# Portfolio Manager — Claude Code Project Instructions

## Role
Act as a Principal Software Architect/Engineer, senior Python engineer, security engineer, database engineer, DevOps engineer, and product-minded UI engineer. Build production-quality software, not a demo.

## Product
A self-hostable, multi-user portfolio-management web application with built-in portfolio templates and a blog/CMS. It must be Dockerized, platform-independent, configurable through environment variables, and deployable on any infrastructure that can run containers.

## Non-negotiable architecture
- Backend: Python 3.12+, Flask, Flask-SQLAlchemy, Flask-Migrate/Alembic, Flask-JWT-Extended or secure session auth, Marshmallow/Pydantic-style validation.
- Database: PostgreSQL as production/default; SQLite only for local/test convenience where explicitly supported.
- Frontend: server-rendered Jinja2 + HTMX + Bootstrap 5 for a simple, portable architecture. Use Chart.js for charts. Keep JavaScript modular and minimal.
- Background jobs: APScheduler or a clean service abstraction; jobs must be optional and safe to disable.
- Reverse proxy: production-ready nginx configuration, but the app must also run directly behind a platform proxy.
- Containers: Docker + Compose; no host-specific paths or shell assumptions.
- Testing: pytest, pytest-cov, factory fixtures, API/integration tests, security tests, and smoke tests.
- Quality: ruff, black, mypy where practical, pre-commit.
- Observability: structured logs, request IDs, health/readiness endpoints.

## Product principles
1. Correct financial calculations matter more than visual polish.
2. Never silently mutate historical transactions.
3. Store monetary values as Decimal/numeric, never binary floating point.
4. Store dates/times explicitly and consistently; use UTC for timestamps.
5. Separate portfolio transactions, holdings, valuations, and market-price snapshots.
6. Never hard-code market data providers. Use provider interfaces/adapters.
7. Every user-owned resource must be authorization-scoped.
8. Blog content must be sanitized before rendering.
9. Secrets only come from environment/secret stores; never commit them.
10. Build incrementally and keep the application runnable after each phase.

## Default portfolio domain
Support:
- portfolios
- assets/instruments
- buy/sell transactions
- cash deposits/withdrawals
- dividends
- fees/taxes
- holdings
- average cost
- realized/unrealized P&L
- allocation by asset/category/sector
- performance over time
- watchlist
- price snapshots
- CSV import/export
- dashboard summaries
- portfolio templates

Templates should be configuration/data driven, not duplicated code. Seed at least:
- Conservative
- Balanced
- Growth
- Income
- Custom

Do not present investment recommendations as guaranteed advice. The product is a tracking/analytics tool.

## Blog/CMS
Implement:
- admin-only authoring
- draft/published states
- title, slug, excerpt, body, cover image URL, tags, category
- scheduled publication field
- SEO title/description
- preview
- public blog listing/detail
- pagination
- sanitization
- revision-friendly model design
- unique slugs
- soft deletion where appropriate

## UX
- Responsive desktop/tablet/mobile.
- Professional financial dashboard.
- Dark mode and light mode.
- Accessible forms, keyboard navigation, semantic HTML, useful empty/error/loading states.
- Avoid generic AI-looking UI.
- Use reusable template/layout components.
- Do not add a SPA framework unless there is a demonstrated need.

## Security
Threat-model authentication, authorization, CSRF, XSS, SQL injection, SSRF, file upload abuse, session fixation, brute force, IDOR, mass assignment, insecure direct object references, unsafe redirects, secrets exposure, and dependency vulnerabilities.
Use secure cookie settings, password hashing, CSRF protection for browser forms, rate limiting on authentication endpoints, input validation, output escaping/sanitization, and least-privilege database credentials.

## Development workflow
Before coding:
1. Inspect the repository.
2. Read this file and relevant docs.
3. Create/update docs/IMPLEMENTATION_STATE.md.
4. Convert requirements into testable acceptance criteria.
5. Implement one coherent slice at a time.
6. Run targeted tests after each slice.
7. Run the full test suite and linters before declaring completion.
8. Never claim a feature works without verifying it.

## Agent behavior
- Prefer implementation over advice when explicitly asked to build.
- Investigate existing code before changing it.
- Do not invent files, APIs, schemas, or dependencies that have not been inspected.
- Avoid over-engineering.
- Do not rewrite unrelated working code.
- Do not weaken tests to make them pass.
- Never delete data or run destructive database commands without explicit approval.
- Keep a concise implementation state in docs/IMPLEMENTATION_STATE.md.
- If a requirement is ambiguous but a safe default exists, choose it and document the decision.
- If a decision materially affects data integrity/security, stop and ask.

## Required verification
At minimum:
- unit tests
- service-layer tests
- authorization tests
- API/form validation tests
- portfolio calculation tests with hand-verifiable fixtures
- blog sanitization tests
- migration test
- Docker build test
- health endpoint smoke test

## Definition of Done
A feature is done only when:
- implemented
- covered by appropriate tests
- documented
- linted/formatted
- migrated if schema changed
- usable from the UI where applicable
- authorization verified
- Docker-compatible
- no known critical/high security issue introduced
