# API Specification

Base:
 /api/v1

## Authentication

POST /auth/login
POST /auth/logout
GET /auth/me

## Credentials

POST /credentials
GET /credentials
POST /credentials/{id}/revoke

Raw token is returned only at credential creation if necessary.

## Tunnels

POST /tunnels
GET /tunnels
GET /tunnels/{id}
POST /tunnels/{id}/stop
POST /tunnels/{id}/revoke

## Health

GET /health
GET /ready

## Tunnel transport

GET /tunnel/ws

Authenticated persistent WebSocket endpoint.

## Admin/dashboard

GET /admin
GET /admin/tunnels
GET /admin/audit

## Error format

{
  "error": {
    "code": "TUNNEL_OFFLINE",
    "message": "The requested tunnel is currently offline.",
    "request_id": "..."
  }
}

Never return stack traces.
