# Testing Strategy

## Unit
Test pure financial calculations with Decimal:
- buy
- sell
- fees
- taxes
- dividends
- deposits/withdrawals
- weighted-average cost
- realized P&L
- unrealized P&L
- allocation
- zero quantity
- partial sells
- multiple currencies (if enabled)

## Integration
- authentication
- authorization
- portfolio CRUD
- transaction CRUD
- import/export
- blog workflow
- migrations
- health endpoints

## Security
- IDOR
- CSRF
- XSS/blog sanitization
- SQL injection regression
- brute-force/rate-limit behavior
- unsafe file upload if implemented

## E2E/smoke
At minimum:
register -> create portfolio -> add instrument -> buy -> view holding -> verify P&L -> publish blog as admin.

## Test data
Use factories and deterministic fixtures. Never rely on external market APIs for tests.

## CI
Required gates:
ruff check
black --check
pytest
coverage threshold
docker build

Keep tests independent and parallel-safe where practical.
