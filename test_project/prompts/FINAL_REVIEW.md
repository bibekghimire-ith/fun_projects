# Claude Prompt — Final Staff-Level Review

Review the entire Our World application.

Act as:
- Principal Architect
- Security Engineer
- Senior UX Engineer
- Senior QA Engineer
- SRE/DevOps Engineer

Check:

Architecture:
- module boundaries
- coupling
- extensibility
- database integrity

Security:
- auth
- IDOR
- public tokens
- PIN
- uploads
- XSS
- CSRF
- SSRF
- rate limits
- media access

UX:
- mobile
- accessibility
- reduced motion
- loading/error/empty states
- emotional coherence
- template consistency

Performance:
- image lazy loading
- bundle splitting
- API latency
- media streaming
- layout shift

Testing:
- unit
- integration
- E2E
- security regression

Deployment:
- Docker
- env configuration
- persistence
- health checks
- backup/restore documentation

Return a prioritized report:
CRITICAL
HIGH
MEDIUM
LOW

Fix CRITICAL and HIGH issues before declaring production readiness.
