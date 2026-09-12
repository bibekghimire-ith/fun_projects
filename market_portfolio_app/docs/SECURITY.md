# Security Requirements

## Authentication
- Argon2id or bcrypt password hashing.
- Secure session cookies if using server sessions.
- HttpOnly, Secure in production, SameSite=Lax/Strict as appropriate.
- CSRF protection for browser forms.
- Rate limit login and password-reset endpoints.
- Do not reveal whether an email exists during password reset.

## Authorization
Every resource query must be scoped to the authenticated user unless the resource is explicitly public or admin-only.

Test IDOR:
- User A cannot read/update/delete User B's portfolio.
- User A cannot access User B's transactions.
- Non-admin cannot publish blog posts.
- Built-in templates cannot be modified by normal users.

## Input/output
- Validate all boundary input.
- Escape output by default.
- Sanitize rich blog content with an allowlist.
- Never render unsanitized user HTML.
- Use parameterized ORM queries.
- Validate URLs where URLs are accepted.
- Avoid server-side fetching of arbitrary user URLs; prevent SSRF.

## Files
Prefer image URLs for initial blog covers. If uploads are implemented:
- allowlist MIME types/extensions
- inspect content
- size limits
- randomize filenames
- store outside executable paths
- never execute uploads
- optionally use object storage via an adapter

## Secrets
- .env is local only.
- .env.example contains placeholders.
- no secrets in git history.
- production secrets supplied by platform secret management.

## Audit
Record security-sensitive actions:
- login failures/successes
- password changes
- role changes
- portfolio creation/deletion
- transaction import
- blog publish/unpublish
- admin configuration changes

Do not log passwords, tokens, cookies, or financial secrets.

## Dependencies
Use pinned/locked dependency versions and automated vulnerability scanning in CI.
