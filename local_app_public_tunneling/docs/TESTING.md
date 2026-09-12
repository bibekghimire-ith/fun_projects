# Testing Strategy

## Unit
- frame encoding/decoding
- malformed frame rejection
- frame length limits
- stream ID allocation
- hostname validation
- target validation
- header normalization
- lifecycle state machine
- token hashing
- rate-limit logic
- reconnect backoff

## Integration
- API authentication
- credential lifecycle
- tunnel registration
- tunnel lookup
- public routing
- client forwarding
- PostgreSQL migrations
- dashboard authorization

## End-to-end
Use an in-process or local test HTTP server.

Scenario:
1. start tunnel server
2. bootstrap user/credential
3. start client
4. connect local HTTP test app on 127.0.0.1
5. create tunnel
6. obtain public URL
7. GET public URL
8. assert local app receives request
9. POST request
10. assert body
11. concurrent requests
12. disconnect client
13. reconnect
14. revoke tunnel
15. assert public access fails

## Security tests
- unauthenticated API
- unauthorized tunnel
- cross-user tunnel access
- invalid host
- host escape
- SSRF target rejection
- token replay
- revoked token
- CSRF dashboard
- XSS regression
- request size
- rate limiting
- malformed protocol frame
- oversized frame

## Performance
Add a small benchmark/smoke test for:
- concurrent streams
- bounded memory
- latency through tunnel

Do not use unrealistic performance claims.

## CI
- ruff
- black --check
- pytest
- coverage
- Docker build
