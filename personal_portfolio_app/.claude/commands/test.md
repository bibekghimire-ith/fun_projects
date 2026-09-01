# Full Verification

Run the complete available verification suite:
- Ruff
- Black check
- mypy if configured
- pytest
- coverage
- Docker build

If a failure is caused by the implementation, fix it without weakening tests.

Report actual commands and results.
