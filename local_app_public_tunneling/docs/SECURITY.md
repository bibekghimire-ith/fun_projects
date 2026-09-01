# Security and Threat Model

## Assets
- user credentials
- tunnel tokens
- public routing metadata
- local applications
- tunnel server
- database
- active connections

## Threats

### Unauthorized tunnel creation
Mitigation:
- authentication
- rate limiting
- authorization

### Tunnel takeover
Mitigation:
- cryptographically random IDs
- authenticated tunnel connection
- ownership checks

### Host header attack
Mitigation:
- strict configured base-domain parsing
- exact/controlled hostname matching

### SSRF
Mitigation:
- loopback-only target by default
- host/port rather than arbitrary URL
- no visitor-controlled destination

### Open proxy
Mitigation:
- explicit local target
- no arbitrary destination
- no SOCKS behavior

### Token theft
Mitigation:
- TLS
- hashed storage
- revocation
- no logs
- secure CLI storage

### Replay
Mitigation:
- TLS
- connection/session authentication
- nonce/session binding as appropriate

### DoS
Mitigation:
- request limits
- body limits
- concurrency limits
- timeouts
- rate limiting
- bounded queues

### Request smuggling
Mitigation:
- normalize HTTP framing
- carefully handle Content-Length/Transfer-Encoding
- strip hop-by-hop headers
- use well-tested HTTP libraries

### Local network exposure
Mitigation:
- loopback-only default
- explicit opt-in for any broader target support
- no LAN discovery

### Credential brute force
Mitigation:
- rate limiting
- lockout/backoff
- audit logging

### XSS in dashboard
Mitigation:
- template escaping
- CSP where practical
- input validation

## Secret policy
Never log:
- Authorization
- token
- cookie
- session
- full request bodies

## Security headers
Management UI:
- CSP
- HSTS when HTTPS
- Referrer-Policy
- X-Content-Type-Options
- frame-ancestors

Do not inject restrictive security headers into proxied application responses unless intentionally configurable.

## Abuse prevention
Provide:
- per-user tunnel limits
- expiration options
- per-tunnel request limits
- global server limits

## Audit
Audit:
- login
- credential creation/revocation
- tunnel creation
- tunnel revoke
- tunnel stop
- authentication failures
