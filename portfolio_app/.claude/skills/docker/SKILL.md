# Docker Skill

Docker is the portability boundary.

Requirements:
- deterministic dependencies
- non-root runtime
- Gunicorn production command
- environment-driven configuration
- no secrets baked into image
- healthcheck
- PostgreSQL service in Compose for development
- production documentation for managed PostgreSQL
- graceful shutdown
- small/minimal runtime image where practical

Avoid host-specific absolute paths and Linux-only assumptions.

Validate:
docker build
docker compose config
docker compose up
health endpoints
migration
