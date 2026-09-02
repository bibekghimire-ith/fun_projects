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

### Migration procedure
`flask db upgrade` and `flask bootstrap-admin` are both idempotent (safe
to run repeatedly; each is a no-op if already applied/already exists).

**Single-instance deployment (the default `docker-compose.yml` `app`
service)**: running both as part of the container's own startup command
(`flask db upgrade && flask bootstrap-admin && exec gunicorn ...`) is
correct and is what ships by default - there is only one instance, so
there is nothing for the migration to race against. See
docs/DECISIONS.md #54.

**Multi-instance / scaled deployment (more than one `app` replica)**: do
NOT let every replica run `flask db upgrade` on boot - two replicas
starting at once can run conflicting DDL concurrently, and a replica
running old code against a not-yet-migrated schema (or vice versa) during
a rolling deploy can serve broken requests. Instead:

1. Run the migration once, before starting/scaling `app`:
   ```
   docker compose run --rm migrate
   ```
   (the `migrate` service in docker-compose.yml runs exactly
   `flask db upgrade && flask bootstrap-admin` and exits; it is
   profile-gated so a plain `docker compose up` never starts it
   automatically.)
2. Remove `flask db upgrade && flask bootstrap-admin &&` from the `app`
   service's `command` (leave it as
   `exec gunicorn -c gunicorn.conf.py wsgi:app` only) so replicas never
   attempt migrations themselves.
3. Scale `app` (`docker compose up --scale app=N` or your orchestrator's
   equivalent) only after step 1 succeeds.
4. Repeat step 1 (rerun `migrate`) before every deploy that includes a new
   migration, before rolling `app` to the new image.

A managed-database deployment (PostgreSQL outside Compose) follows the
same procedure - `migrate`'s `DATABASE_URL` just points at that database
instead of the `db` Compose service.

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

### Nginx reverse proxy
An example config is at `deploy/nginx/portfolio.conf` (terminates TLS,
redirects :80 -> :443, proxies to Gunicorn, forwards
`X-Forwarded-Proto`/`X-Forwarded-For`/`X-Forwarded-Host`, caps request
body size). Run it as a Docker Compose service via the `proxy` profile
(not started by a plain `docker compose up`):

```
docker compose --profile proxy up --build
```

You must supply your own TLS certificate (e.g. via certbot) and mount it
where `deploy/nginx/portfolio.conf`'s `ssl_certificate`/
`ssl_certificate_key` point, or adapt the config for your certificate
management approach. If you run Nginx (or another reverse proxy) outside
Compose entirely, the same config file works as a standalone
`sites-available` entry - just change the `upstream` block's `server
app:8000` to wherever Gunicorn is actually bound (e.g. `127.0.0.1:8000`).

### Reverse proxy trust (`TRUST_PROXY_HEADERS`)
Once a reverse proxy is actually the sole entry point (Nginx per the
config above, or an equivalent that overwrites rather than passes through
client-supplied `X-Forwarded-*` headers), set:

```
TRUST_PROXY_HEADERS=true
PROXY_COUNT=1
```

This applies Werkzeug's `ProxyFix` (see `app/__init__.py`), so the app
sees the real client IP/scheme instead of the proxy's - which is what
makes `SESSION_PROTECTION="strong"` (Flask-Login), the login/contact rate
limiters, and `ENABLE_HSTS`'s HTTPS check all work correctly behind a
proxy. Leave it `false` (the default) if the app is reachable directly
with no proxy in front - see docs/DECISIONS.md #52 for why this is opt-in
rather than always-on.

### HSTS
Set `ENABLE_HSTS=true` (the default in `APP_ENV=production`) once the
deployment is actually served over HTTPS end-to-end and
`TRUST_PROXY_HEADERS`/`PROXY_COUNT` are configured correctly (HSTS is only
sent on requests the app can confirm were HTTPS - see
`app/common/security_headers.py`). `HSTS_MAX_AGE` defaults to two years
(`63072000` seconds); lower it (e.g. to a few minutes) while first
validating a new production HTTPS setup, since a too-long `max-age` sent
prematurely will make browsers refuse plain-HTTP fallback for that
duration.

## Backups
See docs/BACKUPS.md for the PostgreSQL and media-storage backup/restore
procedure.
