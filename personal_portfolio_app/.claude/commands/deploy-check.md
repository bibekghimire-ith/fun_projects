# Deployment Readiness Check

Verify:
- Dockerfile
- Compose
- environment configuration
- production Gunicorn command
- non-root user
- healthcheck
- database migration
- no secrets in repository
- static asset behavior
- logging
- secure cookie settings
- reverse proxy compatibility

Build the Docker image and, where possible, start the stack and test health endpoints.

Write docs/DEPLOYMENT_REVIEW.md.
