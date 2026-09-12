# Backend Skill

Use for Flask, SQLAlchemy, services, APIs, validation, and database changes.

## Rules
- Application factory.
- Blueprints/modules by domain.
- Service layer for business use cases.
- Repositories only where they improve testability/boundaries.
- SQLAlchemy ORM with explicit relationships and constraints.
- Alembic migrations for schema changes.
- Decimal for money.
- UTC-aware timestamps.
- Validate at the boundary.
- Enforce authorization in the service/query path, not only in templates.
- Use transactions for multi-step writes.
- Never silently swallow database exceptions.

## API/UI
Use JSON endpoints where useful, but do not create an API layer merely for ceremony. Jinja + HTMX is the default UI interaction model.
