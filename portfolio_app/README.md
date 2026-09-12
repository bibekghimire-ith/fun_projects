# Personal Portfolio + Blog

A self-hostable, production-quality personal portfolio website with an
integrated blog/CMS, built with Flask. Not a financial portfolio manager.

All nine implementation phases in docs/IMPLEMENTATION_PLAN.md are complete
— see docs/RELEASE_SUMMARY.md for the full release notes and
docs/IMPLEMENTATION_STATE.md for the phase-by-phase build history.

## Stack
- Python 3.12+, Flask, SQLAlchemy, Flask-Migrate/Alembic
- PostgreSQL (SQLite supported for local dev only)
- Jinja2 server-rendered templates, Bootstrap 5, vanilla JavaScript
- Gunicorn, Docker / Docker Compose, optional Nginx reverse proxy
- pytest (+ coverage), Ruff, Black, mypy

## Quickstart (Docker)
```
cp .env.example .env
# edit .env: set SECRET_KEY, ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_PASSWORD_HASH
docker compose up --build
```
The app runs its own `flask db upgrade && flask bootstrap-admin` on boot
(single-instance default — see docs/DEPLOYMENT.md for multi-instance
migration procedure). Visit `http://localhost:8000`, log in at
`/auth/login`, and manage content at `/admin/`.

## Quickstart (local, no Docker)
```
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
flask db upgrade
flask bootstrap-admin   # or: flask hash-password, then set ADMIN_BOOTSTRAP_PASSWORD_HASH
flask run
```
Falls back to a local SQLite file if `DATABASE_URL` is unset in
development. See docs/RELEASE_SUMMARY.md for the full environment
variable reference.

## Development
```
pytest --cov=app
ruff check .
black --check .
mypy app
```

## Documentation
- docs/RELEASE_SUMMARY.md — features, architecture, environment variables, verification results
- docs/IMPLEMENTATION_STATE.md — phase-by-phase build and verification history
- docs/DECISIONS.md — every ambiguous-requirement decision made during the build
- docs/DEPLOYMENT.md — production deployment, migrations, Nginx, HSTS
- docs/SECURITY.md — threat model
- docs/BACKUPS.md — PostgreSQL/media backup and restore procedure

## Working on this repo with Claude Code
The `.claude/` directory still carries the original build tooling
(CLAUDE.md project rules, and `/build-phase`, `/test`, `/security-audit`,
`/review`, `/deploy-check` slash commands) for anyone extending this
application with Claude Code going forward.
