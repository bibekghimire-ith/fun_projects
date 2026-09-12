# Flask Skill

Rules:
- application factory
- blueprints
- configuration objects
- extensions initialized separately
- no circular imports
- service layer for business logic
- SQLAlchemy transactions for multi-step writes
- migrations for schema changes
- CSRF on browser mutations
- secure sessions
- validation at boundaries
- consistent error pages
- health/readiness endpoints

Do not put database queries and complex business logic directly into templates or large route functions.
