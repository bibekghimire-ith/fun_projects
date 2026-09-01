# Architecture Skill

Build a modular monolith first.

Separate:
- API/control plane
- tunnel transport
- runtime connection registry
- public proxy
- CLI
- persistence
- security

Do not put socket state in PostgreSQL.

Do not assume multiple worker processes can share in-memory connections.

Document every material architecture decision.

Prefer explicit state machines over scattered boolean flags.
