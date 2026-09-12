# Product Requirements — Portfolio Manager

## 1. Vision
Build a self-hostable portfolio management platform that lets users track investment portfolios, transactions, holdings, performance, allocation, and personal financial content. The application includes reusable portfolio templates and a small integrated blog/CMS.

## 2. Personas
### Individual investor
Tracks multiple portfolios and wants simple, accurate performance and allocation analytics.

### Advanced user
Imports transactions, manages multiple asset types, compares portfolios, and exports data.

### Administrator/author
Manages users, portfolio templates, blog posts, categories, tags, and system configuration.

## 3. Core modules
### Authentication
- registration
- login/logout
- password hashing
- password reset abstraction
- email verification abstraction
- session/JWT strategy chosen consistently
- account profile
- role-based authorization

### Portfolio
- create/edit/archive portfolio
- choose a template
- base currency
- benchmark label
- target allocations
- portfolio summary

### Transactions
Transaction types:
BUY, SELL, DIVIDEND, DEPOSIT, WITHDRAWAL, FEE, TAX, ADJUSTMENT.

Fields should support:
- portfolio
- instrument
- transaction type
- trade date
- settlement date
- quantity
- unit price
- gross amount
- fees
- taxes
- currency
- notes
- external reference
- import source

### Holdings
Calculated from immutable transaction history:
- quantity
- average cost
- invested cost
- current value
- unrealized P&L
- realized P&L
- allocation percentage

### Market data
Use a provider abstraction:
MarketDataProvider.get_quote()
MarketDataProvider.get_historical_prices()
MarketDataProvider.search_instruments()

Start with a mock/manual provider and CSV import. External providers must be optional.

### Analytics
- total portfolio value
- invested capital
- cash
- daily/period performance
- realized/unrealized P&L
- asset allocation
- sector/category allocation
- top gainers/losers
- portfolio value history
- transaction history

Do not claim benchmark-relative performance unless benchmark data is actually available.

### Templates
Built-in templates are seeded into the database:
- Conservative
- Balanced
- Growth
- Income
- Custom

Template structure:
- name
- description
- risk label
- target allocation JSON
- allowed asset classes
- default dashboard widgets
- version
- active flag

Users may clone a built-in template into a personal portfolio configuration. Built-in templates are immutable from the user UI.

### Import/export
CSV import:
- preview
- column mapping
- validation report
- duplicate detection
- atomic commit
- error rows downloadable
- idempotency key/import batch

CSV export:
- transactions
- holdings
- portfolio summary

### Blog
Public:
- /blog
- /blog/<slug>

Admin:
- post CRUD
- draft/published
- scheduled publish
- categories
- tags
- SEO metadata
- preview
- sanitized HTML/Markdown rendering
- cover image URL

### Dashboard
Cards:
- portfolio value
- invested capital
- P&L
- cash
- day/period change

Charts:
- portfolio value over time
- allocation donut
- P&L by holding
- contribution/cash flow
- optional performance comparison

## 4. Non-functional requirements
- secure by default
- portable
- observable
- testable
- accessible
- responsive
- migration-safe
- PostgreSQL-first
- container-first
- no vendor lock-in
- external integrations behind adapters

## 5. Acceptance criteria
A fresh developer must be able to:
1. copy .env.example to .env
2. run docker compose up --build
3. open the application
4. register a user
5. create a portfolio from a template
6. add transactions
7. see holdings and P&L
8. import/export CSV
9. view charts
10. publish a blog post as an admin
11. run pytest and lint checks successfully

## 6. Out of scope for initial release
- brokerage order execution
- payment processing
- automatic tax filing
- guaranteed financial advice
- real-time trading
- proprietary market-data dependency
- social network functionality
