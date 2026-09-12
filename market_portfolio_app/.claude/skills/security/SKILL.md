# Security Skill

Run this mental checklist for every feature:
- authentication
- authorization/IDOR
- CSRF
- XSS
- SQL injection
- SSRF
- unsafe redirects
- mass assignment
- file upload
- secrets
- logging/PII
- rate limiting
- dependency risk
- secure headers
- session security

For every user-owned resource, prove that another user's identifier cannot retrieve or mutate it.
For rich content, sanitize with an explicit allowlist.
Do not introduce security through obscurity.
