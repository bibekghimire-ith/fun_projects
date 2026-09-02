# Master Build Prompt

Act as the principal engineer building AETHER, a configurable Jarvis-style personal AI
assistant platform. Do not build a demo; build a maintainable product foundation.

## Required behavior
The system must support configurable naming, local/offline operation, multiple model providers,
text/voice/multimodal interaction, memory, RAG, safe browser/filesystem/developer/DevOps tools,
automation, multi-user operation, administration and extensible integrations.

## Architecture
Use a modular monolith:
FastAPI + React/TypeScript + PostgreSQL/pgvector + optional Redis + provider/tool adapters +
worker abstraction + Docker Compose.

## Agent loop
request -> context -> plan -> policy -> tool selection -> approval if required -> execution ->
result validation -> memory -> response -> audit.

The model is a planner, not the security authority.

## Initial integrations
GitHub, Google Calendar, Gmail, Discord, Telegram, Notion, VS Code, Docker, SSH, PostgreSQL,
browser and filesystem. Each must be independently enabled/disabled.

## Security
Use least privilege, explicit scopes, resource allowlists, confirmation gates, sandboxing where
possible, secret redaction, audit logs, cross-user isolation and prompt-injection defenses.

## Offline
Local chat, local memory, local RAG, local filesystem/developer tools, local automation and
local voice should continue to work when cloud services are unavailable.

## Implementation strategy
Build vertical slices: foundation -> identity -> chat/model gateway -> agent/policy/tools ->
local tools -> memory/RAG -> browser -> integrations -> automation -> voice -> admin -> hardening.
After every slice run tests, lint/type checks, security checks and update documentation.
