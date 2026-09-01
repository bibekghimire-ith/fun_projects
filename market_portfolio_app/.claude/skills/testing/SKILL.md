# Testing Skill

Testing is part of implementation, not a final phase.

For every feature:
1. identify unit-level behavior
2. identify integration behavior
3. identify authorization/security behavior
4. add deterministic fixtures
5. test success and important failure paths

For financial calculations, include hand-verifiable examples and edge cases:
- first buy
- multiple buys
- partial sell
- complete sell
- fees/taxes
- dividends
- zero holdings
- loss-making sale
- rounding
- same-day transactions
- cash movement

Never depend on live market APIs in automated tests.
