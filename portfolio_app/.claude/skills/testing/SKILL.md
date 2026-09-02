# Testing Skill

Write tests alongside implementation.

For each feature:
- unit test business rules
- integration test persistence
- security test authorization
- test important failures
- use deterministic fixtures

Do not use live external services in tests.

Before completion run:
pytest
coverage
ruff
black --check
mypy if configured
docker build

Never weaken a test to make it pass.
