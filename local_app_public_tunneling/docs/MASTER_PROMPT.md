# MASTER PROMPT — Secure Local Application Tunneling Platform

You are responsible for implementing this repository as a production-quality self-hostable tunneling system.

Read:
- CLAUDE.md
- docs/PRD.md
- docs/ARCHITECTURE.md
- docs/PROTOCOL.md
- docs/SECURITY.md
- docs/DATABASE_DESIGN.md
- docs/API_SPEC.md
- docs/CLI_SPEC.md
- docs/TESTING.md
- docs/DEPLOYMENT.md
- docs/IMPLEMENTATION_PLAN.md

## Objective

Build a system that exposes an explicitly selected local HTTP application through a public HTTPS URL.

The user runs:
    tunnelctl tunnel http 3000

The system establishes an authenticated outbound persistent connection to the tunnel server.

A visitor accesses:
    https://<subdomain>.<base-domain>

The tunnel server forwards the HTTP request over the persistent tunnel.

The local client forwards it to:
    127.0.0.1:3000

The response travels back through the tunnel server.

## Architecture requirements

Components:
1. Tunnel Server
2. Tunnel Client
3. CLI
4. Persistent datastore
5. Optional dashboard
6. Optional reverse proxy/TLS termination

Core path:

Browser
 -> HTTPS
 -> Tunnel Server public listener
 -> tunnel registry lookup
 -> authenticated multiplexed tunnel
 -> Tunnel Client
 -> loopback local application

## Critical constraints

### No inbound local firewall configuration
The local agent initiates the connection.

### No open proxy
The local client may only connect to an explicitly configured local target.

### No anonymous tunnels
Tunnel creation requires authentication.

### No plaintext credentials
Hash long-lived credentials/tokens where feasible and provide revocation.

### No unsafe routing
Public hostnames map to registered tunnel IDs owned by the authenticated user.

## Protocol

Implement a versioned framed protocol.

Frame types:
HELLO
AUTH
REGISTER
REGISTER_OK
REQUEST_START
REQUEST_HEADERS
REQUEST_DATA
REQUEST_END
RESPONSE_START
RESPONSE_HEADERS
RESPONSE_DATA
RESPONSE_END
ERROR
PING
PONG
CLOSE

Every logical stream has:
- stream_id
- tunnel_id
- frame sequence where useful
- protocol version

Use length-prefixed or another robust binary framing strategy.

Do not parse arbitrary network data with naive delimiter splitting.

## Public proxy

When a request arrives:
1. parse and validate Host
2. map hostname to active tunnel
3. confirm tunnel is online
4. create stream ID
5. send request metadata/body frames
6. await response
7. stream response to visitor
8. enforce timeout/limits
9. close stream cleanly

Handle tunnel disappearance while requests are active.

Return suitable HTTP errors without exposing internal state.

## Client

CLI should:
- authenticate
- create tunnel
- connect
- maintain heartbeat
- reconnect
- accept multiplexed requests
- forward to loopback target
- stream response
- stop cleanly

On Ctrl+C:
- stop accepting new streams
- drain existing streams for a bounded period
- close tunnel
- revoke/stop registration if required

## Reconnection

Use:
initial delay
exponential backoff
maximum delay
random jitter

After reconnect:
- re-authenticate
- re-register tunnel
- restore online status

Do not duplicate tunnel records on reconnect.

## Hostnames

Default:
<random>.<BASE_DOMAIN>

Optional:
<custom>.<BASE_DOMAIN>

Validate labels.
Prevent:
- path traversal
- host injection
- unicode confusion where unsafe
- collisions
- domain escape

## Authentication model

Use an authenticated user and a tunnel/client token.

Possible flow:
1. administrator/user creates credential
2. CLI receives token
3. CLI stores token securely
4. CLI connects to control/tunnel endpoint
5. server validates token
6. server issues/registers a tunnel session

Do not send reusable credentials unnecessarily in every application request.

## Database

Store durable metadata:
- users
- credential/token hashes
- tunnels
- tunnel events
- audit logs
- optional sessions

Do not store active socket objects in PostgreSQL.

Runtime connections belong in an in-memory registry.

## In-memory tunnel registry

Example conceptual object:

TunnelConnection:
- tunnel_id
- user_id
- client_connection_id
- status
- connected_at
- last_heartbeat
- active_stream_count
- protocol_version
- capabilities

Protect registry with asyncio-safe synchronization.

## Public request concurrency

Each incoming public request gets its own stream ID.

Do not block the whole tunnel while one local request is slow.

Implement bounded concurrency.

## Backpressure

Do not buffer unlimited request/response bodies in memory.

Use streaming and bounded queues.

If V1 implementation requires buffering, impose strict configurable limits and document the tradeoff.

## Errors

Define errors for:
- invalid token
- tunnel offline
- tunnel revoked
- protocol mismatch
- stream timeout
- request too large
- response too large
- local connection refused
- local timeout
- internal failure

Do not expose stack traces publicly.

## Admin/dashboard

Dashboard:
- active tunnels
- status
- public URL
- target host/port
- connected duration
- request count
- last heartbeat
- revoke
- disconnect

Credentials are never displayed after creation.

## Security hardening

Implement:
- secure password hashing
- secure session management
- CSRF for dashboard forms
- rate limiting
- authorization
- security headers
- request size limits
- timeout limits
- audit events
- token revocation
- safe logging
- dependency pinning
- container non-root

## SSRF/local-target validation

Default accepted targets:
localhost
127.0.0.1
::1

Explicitly reject target hosts in the general case unless a future opt-in feature is enabled.

Do not resolve arbitrary URLs from the public request path.

The public visitor controls HTTP request data, not the local destination.

## HTTP header handling

Normalize and remove hop-by-hop headers.

Never forward the visitor's Host header directly as the local target Host unless explicitly configured.

By default set local request Host to the configured local host/port.

Preserve useful forwarding information only through controlled headers, for example:
X-Forwarded-For
X-Forwarded-Proto
X-Forwarded-Host

Document trust assumptions.

## API

Build a clean API with:
- versioned routes
- Pydantic models
- consistent error responses
- OpenAPI docs
- authentication
- authorization

## CLI UX

Examples:

    tunnelctl server login
    tunnelctl tunnel http 3000
    tunnelctl tunnel http --host 127.0.0.1 3000
    tunnelctl tunnels
    tunnelctl tunnel stop <id>
    tunnelctl tunnel revoke <id>
    tunnelctl logout

Output should clearly show:
    Public URL: https://abc.example.com
    Local:      http://127.0.0.1:3000
    Status:     ONLINE

Never print tokens unless an explicit command asks to reveal a newly created secret.

## Documentation

Generate:
- quickstart
- architecture
- protocol
- security model
- local development
- Docker deployment
- production deployment
- reverse proxy/TLS setup
- troubleshooting
- CLI reference
- API reference
- threat model

## Implementation phases

Follow docs/IMPLEMENTATION_PLAN.md exactly.

After each phase:
- run tests
- run lint
- verify Docker if relevant
- update implementation state

## Final verification

Prove:
1. server starts
2. DB migration works
3. CLI authenticates
4. client connects
5. tunnel becomes ONLINE
6. public URL resolves
7. GET reaches local app
8. POST body reaches local app
9. response headers/status return
10. multiple concurrent requests work
11. client reconnects
12. revoked tunnel stops serving
13. oversized request is rejected
14. unauthorized tunnel cannot be accessed
15. Docker deployment works

Only then provide a release summary.
