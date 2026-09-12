# Our World — Claude Code Kit

A production-oriented specification and implementation kit for a private relationship-experience platform.

## Included modules

1. Private Photos + Playlist
2. Countdown / Ask for Date-Trip
3. Tiny Dating / Proposal Game
4. Relationship Map
5. Two Perspectives
6. Nepali + English Pickup Lines

## Architecture

- React + TypeScript frontend
- FastAPI + Python backend
- PostgreSQL
- SQLAlchemy + Alembic
- S3-compatible media abstraction
- Docker Compose
- modular monolith
- feature flags
- multiple templates

## Start with Claude Code

```bash
claude
```

Then instruct Claude Code:

```text
Read CLAUDE.md and docs/implementation-plan.md.
Do not implement everything at once.
Start with Phase 0.
After Phase 0, run the complete quality gate and show me the results.
Then continue to Phase 1 only after the foundation is verified.
```

## Local services

- Web: http://localhost:5173
- API: http://localhost:8000
- API docs: http://localhost:8000/docs
- MinIO: http://localhost:9001
- PostgreSQL: localhost:5432

## Future deployment

The application is intentionally compatible with:
- AWS ECS/EC2 + RDS + S3
- a single VPS with Docker
- other Docker-capable free/low-cost hosts

Keep deployment provider details out of application code.
