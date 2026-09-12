# Local App Public Tunnel — Claude Code Project Instructions

## Role
Act as a Principal Software Architect, senior Python/networking engineer, security engineer, CLI engineer, distributed-systems engineer, QA engineer and DevOps engineer.

Build a production-quality self-hostable tunneling system. Do not create a toy HTTP proxy.

## Product
Build a secure developer-oriented tunneling application that allows a web application running on a user's local device to be accessed through a public HTTPS URL on the Internet.

Example:
Local application:
http://127.0.0.1:3000

Tunnel:
https://random-subdomain.example.com

Internet traffic:
Browser -> public tunnel endpoint -> encrypted persistent tunnel -> local tunnel client -> 127.0.0.1:3000

The product must support a client/server architecture.

## Security boundary
This is a legitimate developer tunneling/reverse-proxy product.

The system MUST:
- require explicit local user opt-in
- make tunnel creation authenticated
- use TLS for public traffic
- authenticate client-to-server tunnels
- prevent arbitrary open proxy behavior
- validate tunnel ownership
- restrict management endpoints
- provide revocation
- avoid exposing local network discovery
- prevent SSRF through the control plane
- rate-limit abuse
- provide audit logs

Do NOT implement:
- stealth persistence
- credential theft
- malware delivery
- bypassing organizational controls
- hidden remote access
- arbitrary LAN scanning
- automatic exposure of all local ports

## Recommended technology

### Tunnel server
- Python 3.12+
- FastAPI
- Uvicorn
- asyncio
- httpx or standard async HTTP primitives where appropriate
- PostgreSQL for durable metadata
- Redis optional only if required for distributed coordination
- SQLAlchemy 2.x
- Alembic

### Tunnel client
Prefer Python initially for a single-language codebase:
- Python 3.12+
- asyncio
- httpx / websockets or a well-justified streaming protocol

If a later implementation benefits strongly from Go/Rust for a standalone client, document the tradeoff before changing languages.

### Reverse proxy
For V1, implement the tunnel server's HTTP reverse proxy directly in the application where practical.

Production deployment may put:
Internet -> Nginx/Traefik/Caddy -> Tunnel Server

Do not rely on a third-party SaaS tunnel.

### CLI
Use Typer.

Example:
tunnelctl login
tunnelctl tunnel http 3000
tunnelctl tunnels
tunnelctl stop <id>

### UI
Use server-rendered administrative UI or a lightweight frontend. Do not create a heavy SPA unless justified.

### Deployment
- Docker
- Docker Compose
- PostgreSQL
- optional Redis
- Nginx reverse proxy example
- Gunicorn is not required for FastAPI; use Uvicorn workers or an appropriate production ASGI server.

## Core architecture

                        INTERNET
                           |
                           v
                    HTTPS Public URL
                           |
                           v
                 +---------------------+
                 | Tunnel Server       |
                 |                     |
                 | Public HTTP Proxy   |
                 | Control API         |
                 | Tunnel Registry     |
                 +----------+----------+
                            |
                     Persistent secure
                        tunnel
                            |
                            v
                 +---------------------+
                 | Local Tunnel Client |
                 |                     |
                 | CLI / agent         |
                 | local proxy         |
                 +----------+----------+
                            |
                            v
                    127.0.0.1:PORT
                            |
                            v
                    User Application

## Key design decision
A local client must initiate the outbound persistent connection to the tunnel server.

Do NOT require inbound connections to the user's local machine.

This makes the design compatible with common NAT/firewall environments.

## Tunnel protocol
Design an explicit framed protocol.

A tunnel connection should carry:
- authentication
- tunnel registration
- request metadata
- request body/data frames
- response metadata
- response body/data frames
- stream close
- errors
- ping/pong
- protocol version

Do not invent ad-hoc unframed JSON mixed with arbitrary bytes.

A reasonable V1 design:
- HTTPS control/API
- WSS persistent tunnel
- multiplex logical HTTP requests over the authenticated tunnel

If using a different protocol, document why.

## Multiplexing
A single client connection should support multiple simultaneous public HTTP requests.

Each request receives a stream/request ID.

Example:
Public request A -> stream 101
Public request B -> stream 102

Client forwards:
101 -> localhost application
102 -> localhost application

Responses return using the same IDs.

Avoid head-of-line blocking where practical.

## Tunnel lifecycle
States:
CREATING
CONNECTING
ONLINE
DRAINING
OFFLINE
REVOKED
EXPIRED

Implement explicit lifecycle transitions.

## Public URLs
Support:
- random subdomains by default
- configurable base domain
- optional custom subdomain
- collision-safe allocation
- ownership checks
- revocation

Do not allow users to select arbitrary hostnames outside configured domains.

## Authentication
Implement:
- user accounts
- API tokens or client credentials
- hashed token storage
- token revocation
- tunnel ownership
- scoped credentials where possible

Never store plaintext long-lived secrets.

The CLI should have secure local credential storage where practical.
Do not print secrets by default.

## Public endpoint security
The public endpoint must:
- route only to an active tunnel
- validate host/subdomain
- reject unknown tunnels
- reject revoked tunnels
- apply request limits
- apply body-size limits
- support timeouts
- prevent request smuggling where applicable
- avoid trusting client-supplied routing headers

## Management API
Provide endpoints for:
- login/auth
- current user
- create tunnel
- list tunnels
- get tunnel
- revoke tunnel
- stop tunnel
- client registration/token
- health
- readiness

## Admin/dashboard
Provide:
- tunnel list
- status
- public URL
- local target
- created time
- last heartbeat
- revoke/stop
- connection information
- audit events

Never expose tunnel credentials in the UI after creation.

## Local target restrictions
V1 should support explicit targets such as:
127.0.0.1:3000
localhost:8080

Avoid accepting arbitrary remote targets such as:
http://10.0.0.1
http://169.254.169.254
file://
ftp://
or arbitrary internet destinations.

The tunnel client should default to loopback-only.

If non-loopback binding is later supported, make it an explicit, separately configured capability with strong warnings and validation.

## SSRF
Treat SSRF as a first-class threat.

The local agent is intentionally allowed to access the specified local target, but it must not become an arbitrary proxy.

Validate:
- scheme
- host
- port
- IP range
- DNS behavior
- redirects
- URL parsing

Prefer direct host/port configuration over arbitrary URLs.

## HTTP behavior
Support V1:
- GET
- POST
- PUT
- PATCH
- DELETE
- HEAD
- OPTIONS

Handle:
- headers
- query strings
- content types
- body streaming
- chunked data where supported
- response status
- response headers

Strip or normalize hop-by-hop headers.

Do not blindly forward:
Connection
Proxy-Connection
Keep-Alive
Transfer-Encoding
TE
Trailer
Upgrade

unless explicitly handled by the protocol.

## WebSockets
Treat WebSocket proxying as a separate capability.

If implementing it in V1:
- explicit upgrade detection
- protocol support in tunnel framing
- authentication and tunnel ownership
- limits/timeouts

If not implementing it in V1, expose a clear capability error rather than pretending support.

## Limits
Make configurable:
- maximum tunnels per user
- maximum concurrent requests
- request body size
- response body size
- idle tunnel timeout
- request timeout
- heartbeat interval
- heartbeat timeout
- rate limits

## Reliability
Implement:
- heartbeat
- reconnect with exponential backoff
- jitter
- graceful shutdown
- tunnel draining
- request timeout
- stale connection detection
- idempotent registration where possible

Do not create reconnect storms.

## Multi-server readiness
V1 may use one tunnel server instance.

Design metadata so horizontal scaling is possible later.

For multiple server nodes, document the requirement for:
- shared registry
- routing strategy
- Redis/pubsub or broker if required
- sticky tunnel ownership or stream routing

Do not claim multi-node support unless implemented and tested.

## Observability
Implement:
- structured logs
- request IDs
- tunnel IDs
- connection IDs
- metrics
- health endpoint
- readiness endpoint
- useful error reporting

Never log:
- API tokens
- private credentials
- full Authorization headers
- sensitive request bodies

## Security headers
For management/public UI use appropriate:
- HSTS in HTTPS
- X-Content-Type-Options
- Referrer-Policy
- CSP where compatible
- frame-ancestors

Do not break legitimate proxied application behavior by applying inappropriate headers to tunnel traffic.

## Configuration
Use environment variables for server deployment:
APP_ENV
SECRET_KEY
DATABASE_URL
BASE_DOMAIN
PUBLIC_BASE_URL
CONTROL_HOST
CONTROL_PORT
TLS configuration
RATE_LIMIT settings
TUNNEL limits
LOG_LEVEL

Use CLI flags for client-specific:
local host
local port
server URL
token
subdomain

Never hard-code production domains or secrets.

## Docker
Provide:
- server Dockerfile
- client Dockerfile if useful
- docker-compose.yml
- PostgreSQL
- optional Redis
- reverse proxy example
- healthchecks

Images should run as non-root where possible.

## Platform independence
Client must work on:
- Linux
- macOS
- Windows

Do not assume:
- systemd
- Bash
- Unix-only paths
- Linux-specific networking commands

Use Python stdlib/pathlib/platform APIs.

## Testing
Unit:
- protocol frames
- routing
- authentication
- host allocation
- lifecycle
- limits
- target validation
- header normalization

Integration:
- client/server handshake
- tunnel creation
- public request -> local server
- multiple simultaneous requests
- reconnect
- revoke
- timeout
- oversized request
- unknown subdomain

Security:
- token leakage
- unauthorized tunnel access
- IDOR
- SSRF
- host-header attacks
- request smuggling regression
- rate limiting
- replayed credentials
- revoked token behavior

E2E:
Start local test HTTP server.
Start tunnel server.
Start client.
Create tunnel.
Issue public HTTP request.
Assert local app receives it.
Test concurrent requests.
Stop/revoke tunnel.
Assert public endpoint becomes unavailable.

## Development process
Before implementation:
1. inspect repository
2. read docs
3. create docs/IMPLEMENTATION_STATE.md
4. create docs/DECISIONS.md
5. implement phase-by-phase
6. test every phase
7. update state
8. verify actual commands

Never claim functionality that was not executed and verified.

## Definition of Done
A feature is done only if:
- implementation exists
- tests exist
- security implications are reviewed
- configuration is documented
- Docker remains functional
- logs/metrics are appropriate
- docs are updated
- acceptance criteria pass
