# Implementation Plan

## Phase 0 — Repository/Foundation
- project layout
- pyproject
- config
- logging
- FastAPI app
- database
- migrations
- Docker
- health/readiness
- test foundation
- CI

Exit:
server and DB start.

## Phase 1 — Identity/Credentials
- user
- credential
- hashing
- authentication
- revocation
- authorization
- tests

Exit:
authenticated user can obtain/use a credential.

## Phase 2 — Protocol
- frame definitions
- serializer/framer
- validation
- versioning
- protocol tests

Exit:
client/server can exchange authenticated protocol frames in tests.

## Phase 3 — Runtime Tunnel
- WebSocket endpoint
- auth
- registration
- heartbeat
- registry
- lifecycle
- reconnect

Exit:
client appears ONLINE and survives transient disconnect.

## Phase 4 — HTTP Forwarding
- public hostname routing
- stream IDs
- request frames
- local forwarding
- response frames
- headers
- limits
- timeouts

Exit:
public HTTP request reaches localhost and response returns.

## Phase 5 — CLI
- login
- tunnel http
- list
- stop
- revoke
- local config/credential storage
- cross-platform behavior

Exit:
developer can run one command to expose a local HTTP app.

## Phase 6 — Dashboard
- admin UI
- tunnel list
- status
- revoke/stop
- audit
- authentication

Exit:
operator can manage tunnels safely.

## Phase 7 — Reliability
- backoff
- jitter
- draining
- bounded queues
- concurrency
- failure handling
- metrics

Exit:
failure scenarios are tested.

## Phase 8 — Security Hardening
- SSRF validation
- host validation
- rate limiting
- security headers
- request smuggling review
- secrets review
- audit
- dependency review
- Docker hardening

Exit:
security audit passes.

## Phase 9 — Production Deployment
- reverse proxy
- TLS
- wildcard DNS documentation
- Docker production compose
- backup docs
- operational runbook
- monitoring

Exit:
clean production deployment works.

## Phase 10 — Final Verification
Run all tests, lint, security checks and Docker smoke tests.

Do not declare release candidate until every acceptance criterion is verified.
