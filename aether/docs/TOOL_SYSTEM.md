# Tool System

Every tool declares name, version, description, typed input/output schemas, permission scopes,
risk level, timeout, idempotency behavior and audit policy.

Initial families:
core, filesystem, safe shell, Git, Docker, PostgreSQL, SSH, web search/fetch, Playwright,
GitHub, Google Calendar, Gmail, Discord, Telegram, Notion and VS Code.

Risk levels: LOW, MEDIUM, HIGH, CRITICAL.
External communication, infrastructure changes and destructive actions require approval by
default.
