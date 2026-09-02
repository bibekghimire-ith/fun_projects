# Integrations

Adapters are independently enabled/disabled and must declare capabilities, permissions,
credential requirements, health checks, rate-limit behavior and offline behavior.

Required: GitHub, Google Calendar, Gmail, Discord, Telegram, Notion, VS Code, Docker, SSH,
PostgreSQL, browser and filesystem.

Credentials must use an encryption/secrets abstraction and never be exposed to the frontend.
