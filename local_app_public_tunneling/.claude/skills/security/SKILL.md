# Security Skill

For every feature ask:
- Can an unauthenticated user reach it?
- Can one user access another user's tunnel?
- Can visitor input alter routing?
- Can local target be changed remotely?
- Can a token be replayed?
- Can memory grow without bound?
- Can a request smuggle headers?
- Can logs leak credentials?
- Can the system become an open proxy?

Default local target is loopback-only.

Do not implement broad network access unless explicitly specified and security-reviewed.
