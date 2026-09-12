# Testing Strategy

## Unit tests
Test:
- slug generation
- reading-time calculation
- publishing state
- template resolution
- ordering
- service validation
- SEO metadata
- contact validation
- Markdown sanitization

## Integration tests
Test:
- database migrations
- admin authentication
- portfolio CRUD
- project CRUD
- blog lifecycle
- category/tag behavior
- contact persistence
- settings
- template switching

## Security tests
Test:
- admin access without login
- user role enforcement
- IDOR
- CSRF
- stored XSS
- SQL injection regression
- rate limiting
- unsafe URLs
- upload restrictions if implemented

## E2E smoke journey
1. bootstrap admin
2. login
3. update profile
4. create experience
5. create project
6. create blog post
7. preview
8. publish
9. switch theme
10. visit public homepage
11. visit project
12. visit blog
13. submit contact form
14. verify message handling

## Test principles
- deterministic
- isolated
- no production credentials
- no dependency on external APIs
- factory fixtures
- database reset per test/session as appropriate

## CI gates
- ruff
- black --check
- pytest
- coverage
- Docker build
