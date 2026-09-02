# Security Requirements

## Authentication
- strong password hashing (Argon2id preferred; bcrypt acceptable)
- secure session cookies
- HttpOnly
- Secure in production
- SameSite appropriate to deployment
- session rotation after login
- logout invalidation
- rate limiting

## Authorization
Every admin route requires authenticated admin role.

Never trust:
- URL IDs
- hidden form fields
- client-side permissions
- JavaScript restrictions

## CSRF
All browser mutations must use CSRF protection.

## XSS
- Jinja autoescaping
- sanitize Markdown-rendered HTML
- never mark user content safe without sanitization
- sanitize/validate URLs

## SQL injection
Use SQLAlchemy parameterization.
Never concatenate user input into SQL.

## SSRF
Do not server-side fetch arbitrary user-provided URLs.
If remote image validation/fetch is ever added, implement strict allowlists and network protections.

## Upload security
If uploads are implemented:
- maximum size
- MIME validation
- extension allowlist
- content inspection
- randomized filename
- non-executable directory
- no path traversal
- authorization
- storage adapter

## Rate limiting
At minimum:
- admin login
- contact form

## Headers
Consider:
- Content-Security-Policy
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- frame-ancestors
- HSTS in HTTPS deployment

Do not configure CSP in a way that breaks the application without testing it.

## Secrets
Never:
- commit .env
- log passwords
- log session cookies
- log secret keys
- place credentials in templates

## Audit
Log:
- successful/failed admin login
- content publication
- template changes
- settings changes
- destructive admin actions

Avoid storing unnecessary sensitive information.

## Security testing
Include regression tests for:
- unauthenticated admin access
- IDOR
- CSRF
- stored XSS
- SQL injection
- unsafe upload
- brute-force/rate limit
- authorization bypass
