# Deployment

## Local development

Start PostgreSQL:

docker compose up -d postgres

Run migrations:
alembic upgrade head

Start server:
uvicorn app.main:app --host 0.0.0.0 --port 8000

## Docker

docker compose up --build

Components:
- tunnel-server
- postgres
- optional reverse proxy

## Production

Recommended:

Internet
  |
  v
TLS reverse proxy
  |
  +-- public tunnel hostname
  |
  +-- management hostname
  |
  v
Tunnel Server
  |
  v
PostgreSQL

## DNS
If BASE_DOMAIN is:
example.com

Configure wildcard DNS:
*.example.com -> server IP

TLS:
Use a certificate covering:
*.example.com

Management UI/API may use a separate hostname.

## Reverse proxy
Provide an example configuration for:
- Nginx
- WebSocket upgrade
- HTTPS
- forwarding Host
- timeouts appropriate for long-lived tunnel connections

## Important
The reverse proxy must support long-lived WebSocket connections.

## Environment
Document:
- DATABASE_URL
- SECRET_KEY
- BASE_DOMAIN
- PUBLIC_BASE_URL
- COOKIE_SECURE
- LOG_LEVEL
- limits
- TLS/reverse proxy settings

## Database
Run:
alembic upgrade head

Do not drop database on startup.

Backups must be documented.

## Scaling
V1 is single tunnel-server process.

For horizontal scaling:
- shared tunnel registry/control plane
- routing to connection-owning node
- broker/pubsub if needed
- distributed state
- load-balancer strategy

Do not claim horizontal tunnel scaling without implementing these pieces.
