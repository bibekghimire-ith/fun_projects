# Implementation Plan

0 Foundation: repo, Docker, config, CI, FastAPI, React, DB, health checks.
1 Identity: users, auth, roles.
2 Chat: conversations, streaming, provider gateway, Ollama.
3 Agent: state machine, tools, policy, approval, audit.
4 Local tools: filesystem, safe shell, Git, Docker, PostgreSQL, SSH.
5 Memory/RAG: memory, ingestion, embeddings, pgvector, citations.
6 Browser: Playwright worker and policy.
7 Integrations: GitHub, Google Calendar, Gmail, Discord, Telegram, Notion, VS Code.
8 Automation: scheduler, workflow, execution, approvals.
9 Voice: local STT/TTS and adapters.
10 Admin: providers, tools, integrations, policies, audit, branding.
11 Hardening: security/performance/dependency/container tests.
12 Scale readiness: workers, object storage, external queue and selective extraction.
