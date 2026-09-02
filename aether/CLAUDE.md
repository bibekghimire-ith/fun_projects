# AETHER — Claude Code Project Instructions

AETHER is the default codename for a configurable, Dockerized, platform-independent personal AI
assistant. The production display name must be configurable and must not be hard-coded.

## Mission
Build a production-grade Jarvis-style assistant that supports:
- text, voice and multimodal interaction
- local/offline operation
- configurable local and cloud AI providers
- memory and RAG
- safe computer, filesystem, browser, developer and DevOps tools
- automation and scheduled tasks
- GitHub, Google Calendar, Gmail, Discord, Telegram, Notion, VS Code, Docker, SSH and PostgreSQL
- future integrations/plugins
- multi-user operation
- administration, permissions, approvals and audit logs

## Engineering rules
1. Docker-first and platform-independent.
2. Local-first and offline-capable.
3. Provider-neutral interfaces for LLM, STT, TTS, embeddings and vector stores.
4. Least privilege and deny-by-default for privileged tools.
5. Explicit approval for destructive, external, privileged or irreversible actions.
6. Every privileged action is auditable.
7. Never expose secrets to the frontend or logs.
8. Never allow LLM output to bypass server-side policy.
9. Modular monolith first; preserve clean extraction boundaries.
10. Tests, security checks and documentation are part of every feature.

## Default stack
- Backend: Python + FastAPI
- Frontend: React + TypeScript + Vite
- Database: PostgreSQL + pgvector
- Cache/queues: Redis where useful
- Local model: Ollama-compatible adapter
- Browser: Playwright
- Deployment: Docker Compose first
- Realtime: WebSocket/SSE
- Migrations: Alembic

## Agent safety
Before any tool execution:
1. validate input
2. determine permissions
3. determine risk
4. apply policy
5. request confirmation if required
6. execute with timeout
7. validate/sanitize result
8. audit the action

Never provide unrestricted shell, Docker, SSH, filesystem or database access by default.

## Definition of done
Implementation + tests + API/UI contract + security review + observability + documentation +
working Docker deployment.
