# Database Design

PostgreSQL is the durable store.

Core entities:
users, roles, sessions, providers, conversations, messages, agent_runs, tool_definitions,
tool_calls, permissions, approval_requests, memories, documents, document_chunks, integrations,
integration_credentials, automations, automation_runs, audit_events, system_settings,
feature_flags.

Use UUIDs, timestamps, migrations, ownership indexes and repository abstractions.
