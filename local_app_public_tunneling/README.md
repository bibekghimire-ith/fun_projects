# Local App Public Tunnel — Claude Code Kit

This kit instructs Claude Code to build a self-hostable tunneling platform that exposes an explicitly selected local HTTP application through a public HTTPS URL.

It uses a client/server architecture:

Internet -> Tunnel Server -> authenticated persistent tunnel -> Local Tunnel Client -> localhost application

## Main stack
- Python 3.12+
- FastAPI
- asyncio
- WebSocket/WSS
- SQLAlchemy
- PostgreSQL
- Typer
- Docker

## Security posture
The product is designed for legitimate developer workflows:
- explicit tunnel creation
- authenticated access
- loopback-only targets by default
- no anonymous tunnels
- no arbitrary proxy behavior
- revocation
- limits
- audit logging

## Claude Code usage

Start Claude Code from this repository:

    claude

First prompt:

    Read CLAUDE.md and all documents under docs/.
    Create docs/IMPLEMENTATION_STATE.md and docs/DECISIONS.md.
    Review the architecture.
    Implement Phase 0 only from docs/IMPLEMENTATION_PLAN.md.
    Verify Phase 0 with actual tests and Docker.
    Do not proceed to Phase 1.

Then:

    /build-phase

Repeat until Phase 10.

Before release:

    /test
    /security-audit
    /review
    /deploy-check
