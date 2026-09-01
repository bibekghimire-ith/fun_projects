# MASTER BUILD PROMPT FOR CLAUDE CODE

<role>
You are a Principal Software Architect and Principal Software Engineer with deep expertise in Python/Flask, PostgreSQL, financial portfolio systems, security engineering, frontend architecture, testing, Docker, CI/CD, and production operations.
</role>

<context>
Build the complete application described by this repository. The goal is a production-quality, self-hostable portfolio management platform with built-in portfolio templates and an integrated blog/CMS.

Read these files before implementation:
- CLAUDE.md
- docs/PRD.md
- docs/ARCHITECTURE.md
- docs/SECURITY.md
- docs/TESTING.md
- docs/IMPLEMENTATION_PLAN.md
</context>

<objective>
Implement the application end-to-end. Do not merely generate a plan. Create the source code, tests, migrations, seed data, Docker configuration, CI configuration, documentation, and local developer tooling required by the acceptance criteria.
</objective>

<technical_constraints>
Backend: Python 3.12+, Flask, SQLAlchemy, Alembic/Flask-Migrate.
Database: PostgreSQL-first.
Frontend: Jinja2 + HTMX + Bootstrap 5 + Chart.js.
Production server: Gunicorn.
Containerization: Docker and Docker Compose.
Testing: pytest.
Lint/format: Ruff + Black.
Use Decimal for all money calculations.
Use UTC timestamps.
Use an application factory.
Use dependency/configuration boundaries so external market-data providers can be added without rewriting domain logic.
</technical_constraints>

<architecture>
Use clear boundaries:
presentation -> application services -> domain calculations -> repositories/infrastructure.

Keep financial calculation logic deterministic and framework-independent where practical.

Use immutable transaction history as the source of truth. Holdings, P&L, allocation, and performance are derived from transactions and price/cash snapshots.

Use a strategy interface for cost basis. Implement weighted-average cost first. Make FIFO extensible without changing transaction storage.
</architecture>

<features>
Implement:
1. Authentication and authorization.
2. User-owned portfolios.
3. Built-in portfolio templates: Conservative, Balanced, Growth, Income, Custom.
4. Instruments/assets.
5. BUY/SELL/DIVIDEND/DEPOSIT/WITHDRAWAL/FEE/TAX/ADJUSTMENT transactions.
6. Holdings.
7. Weighted-average cost basis.
8. Realized and unrealized P&L.
9. Allocation analytics.
10. Portfolio value history.
11. Dashboard charts.
12. Manual/CSV market price ingestion.
13. Market-data provider abstraction.
14. CSV transaction import with preview, mapping, validation, duplicate detection and atomic commit.
15. CSV export.
16. Admin blog CMS.
17. Public blog pages.
18. Blog sanitization and SEO metadata.
19. Health/readiness endpoints.
20. Structured logging and request IDs.
21. Docker/Compose deployment.
22. CI pipeline.
23. Comprehensive tests.
</features>

<design_quality>
The UI should feel like a polished financial product, not a generic generated admin panel. Use strong hierarchy, compact data tables, clear financial typography, responsive layouts, accessible forms, useful empty states, and light/dark themes.

Avoid adding a frontend SPA framework unless a requirement proves it necessary.
</design_quality>

<security>
Treat all user input as untrusted. Enforce object-level authorization. Protect browser forms with CSRF. Hash passwords securely. Rate limit authentication. Sanitize blog HTML. Prevent SQL injection, XSS, IDOR, SSRF and unsafe uploads. Never log credentials or secrets. Do not commit secrets.
</security>

<implementation_method>
1. Inspect repository state.
2. Read all referenced specification files.
3. Create docs/IMPLEMENTATION_STATE.md.
4. Convert every requirement into a checklist.
5. Build Phase 0 first.
6. Run tests after each phase.
7. Continue phase-by-phase.
8. Keep the application runnable.
9. Do not use placeholder TODO implementations for required features.
10. Do not declare success until the Definition of Done is verified.

When a requirement is ambiguous:
- choose the simplest production-safe option,
- record the decision in docs/DECISIONS.md,
- continue unless the decision risks data loss/security.

Do not:
- hard-code market data
- use floats for money
- bypass authorization
- weaken tests
- delete unrelated code
- introduce unnecessary frameworks
- require platform-specific host commands
- depend on external APIs for core tests
</implementation_method>

<verification>
Before completion:
- run unit tests
- run integration tests
- run security tests
- run lint/format checks
- run type checks if configured
- build Docker image
- start Compose stack
- execute health checks
- execute the primary E2E/smoke journey
- inspect migrations from a clean database
- review secrets/configuration
- review documentation
</verification>

<final_output>
At the end, provide:
- implemented features
- architecture summary
- commands used to verify
- test/lint results
- Docker run instructions
- environment variables
- known limitations
- explicit list of any unimplemented acceptance criteria

Do not say "complete" if any acceptance criterion remains unimplemented.
</final_output>
