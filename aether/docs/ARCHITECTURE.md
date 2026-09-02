# Architecture

```text
React/TS UI
     |
 REST + WebSocket/SSE
     |
FastAPI API
 |       |        |
Agent  Policy   Memory/RAG
 |       |        |
Model   Tools   PostgreSQL/pgvector
 |       |
Local/Cloud  FS | Shell | Browser | Docker | SSH | DB | Integrations
```

Use a modular monolith first. Preserve interfaces so high-load areas can later become workers or
services. Keep business logic independent from HTTP and infrastructure vendors.

Suggested backend domains:
identity, conversations, agent, models, tools, policies, memory, rag, browser, automation,
integrations, voice, audit, admin.
