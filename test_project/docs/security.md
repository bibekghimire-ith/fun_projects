# Security Specification

## Threat model

Protect:
- private photos
- audio/video
- relationship locations
- personal messages
- responses
- account credentials

Attackers may:
- guess public URLs
- enumerate IDs
- brute-force PINs
- upload malicious files
- inject HTML/JS
- manipulate dates
- attempt unauthorized relationship access

## Required controls

### Authentication
- Argon2id
- HTTP-only Secure SameSite cookies
- session rotation
- logout invalidation
- rate limiting

### Authorization
Every relationship-scoped query must enforce ownership/membership.
Never fetch by ID alone.

### Public tokens
Use at least 128 bits of cryptographic entropy.
Store a hash of the token if practical.
Rate limit attempts.

### PIN
- Argon2id/bcrypt hash
- rate limit
- lockout/backoff
- never return hash
- never log PIN

### XSS
- render structured content
- sanitize rich text
- no `dangerouslySetInnerHTML` for untrusted content

### Uploads
- max file size
- allowlist MIME types
- verify content signatures where practical
- randomized object keys
- no executable serving
- image re-encoding
- quarantine/process before public access

### URLs
- block private IP ranges for user-supplied fetch URLs
- only support allowlisted external providers when necessary

### Headers
Use:
- Content-Security-Policy
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- frame-ancestors restriction

### Privacy
- no search engine indexing
- `noindex`
- no public sitemap for private experiences
- minimal analytics
- retention/deletion support

## Security tests

At minimum:
- IDOR
- unauthorized relationship access
- invalid/revoked token
- PIN brute force
- XSS
- upload bypass
- path traversal
- SSRF
- CSRF
- privilege escalation
