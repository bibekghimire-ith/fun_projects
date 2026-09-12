# /verify

Run the project's full quality gate.

Backend:
- ruff
- mypy
- pytest

Frontend:
- lint
- typecheck
- Vitest

Integration:
- Playwright

Infrastructure:
- Docker build
- Docker Compose startup
- health checks

Report failures with exact commands and remediation.
