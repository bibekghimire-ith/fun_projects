# Deployment

## Local development

Copy:
.env.example -> .env

Then:

docker compose up --build

Application should be reachable on the configured port.

## Production
Recommended:

Internet
  |
  v
Load Balancer / VPS
  |
  v
Nginx
  |
  v
Gunicorn
  |
  v
Flask
  |
  v
PostgreSQL

PostgreSQL may be:
- Compose service for small deployments
- managed database for production

## Environment variables
Document every variable in .env.example.

Required categories:
- application
- database
- authentication
- base URL
- email
- storage
- rate limits
- logging

## Container requirements
- multi-stage build where useful
- non-root runtime
- deterministic dependencies
- no secrets baked into image
- healthcheck
- minimal OS packages

## Database
Production startup must NOT blindly destroy or recreate the database.

Use:
flask db upgrade

Backups should be documented.

## Static assets
For V1, static assets may be served by Nginx or Flask depending on deployment.
The design should allow external object storage/CDN later.

## Deployment portability
Do not depend on:
- systemd
- Linux-only shell scripts
- local absolute directories
- local database paths

Docker is the portability boundary.

## HTTPS
Terminate TLS at a reverse proxy/load balancer.
Enable secure cookies in production.
Document HSTS deployment considerations.
