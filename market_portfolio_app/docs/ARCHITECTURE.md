# Architecture

## Recommended stack

Browser
  |
  v
Nginx (optional in dev, recommended in production)
  |
  v
Flask application
  |-- Web UI: Jinja2 + HTMX + Bootstrap
  |-- REST/JSON endpoints where useful
  |-- Application services
  |-- Domain/calculation services
  |-- SQLAlchemy repositories/models
  |
  +--> PostgreSQL
  |
  +--> Optional background scheduler
  |
  +--> Optional market-data provider

## Layers
### Presentation
Routes, request parsing, forms/API schemas, templates.

### Application
Use cases/services:
- CreatePortfolio
- RecordTransaction
- ImportTransactions
- RecalculateHoldings
- CalculatePerformance
- PublishBlogPost

### Domain
Financial calculations and domain rules. Keep this layer framework-light and deterministic.

### Infrastructure
SQLAlchemy repositories, market-data adapters, email adapter, storage adapter, scheduler.

## Suggested package structure

app/
  __init__.py
  config.py
  extensions.py
  web/
  auth/
  portfolios/
  transactions/
  analytics/
  market_data/
  imports/
  blog/
  admin/
  common/
  templates/
  static/
  models/
  services/
  repositories/

migrations/
tests/
  unit/
  integration/
  security/
  e2e/

## Data model
User
  1--* Portfolio
Portfolio
  1--* Transaction
Transaction
  *--1 Instrument
Portfolio
  1--* PortfolioSnapshot
Instrument
  1--* PriceSnapshot
Portfolio
  0..1--1 PortfolioTemplateInstance
BlogPost
  *--* Tag
BlogPost
  *--1 Category
User
  1--* AuditLog

## Financial calculation rules
Use Decimal.
For a BUY:
  quantity += transaction.quantity
  cost += quantity * unit_price + fees + taxes

For a SELL:
  reduce quantity
  realized P&L = sale proceeds - allocated cost basis - selling fees/taxes

Define and test the exact cost-basis method. Default to weighted-average cost for the first release, but isolate it behind a CostBasisStrategy interface so FIFO can be added later.

Do not calculate portfolio performance solely from current holdings. Maintain cash flows and valuation snapshots so time-series performance can be calculated correctly.

## Configuration
All environment-specific values come from environment variables:
DATABASE_URL
SECRET_KEY
JWT_SECRET_KEY/session secret
APP_ENV
LOG_LEVEL
CORS_ORIGINS
MAIL settings
MARKET_DATA_PROVIDER
RATELIMIT settings
UPLOAD/storage settings

Never require an absolute host path.

## Deployment
Docker image should run as a non-root user.
Use Gunicorn for production.
Nginx is optional as a sidecar.
PostgreSQL is an external managed service or the compose database.
Expose health endpoints:
GET /health/live
GET /health/ready

The image must be portable across Linux hosts and CI systems.
