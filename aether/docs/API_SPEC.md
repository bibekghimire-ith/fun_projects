# API

Prefix `/api/v1`.

Auth: /auth/login, /auth/logout, /auth/refresh, /auth/me
Conversations: /conversations, /conversations/{id}, /conversations/{id}/messages
Agent: /agent/runs, /agent/runs/{id}, /agent/runs/{id}/cancel
Tools: /tools, /tools/{id}, /tools/{id}/execute
Approvals: /approvals, /approvals/{id}/approve, /approvals/{id}/deny
RAG: /rag/documents, /rag/search
Memory: /memory, /memory/{id}
Admin: /admin/settings, /admin/providers, /admin/integrations, /admin/policies, /admin/audit

Keep OpenAPI and frontend types synchronized.
