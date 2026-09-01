# Database Design

## User
- id UUID
- email unique
- password_hash
- is_active
- created_at
- updated_at
- last_login_at

## Credential
- id UUID
- user_id
- name
- token_hash
- token_prefix
- created_at
- last_used_at
- revoked_at

Never store raw long-lived tokens.

## Tunnel
- id UUID
- user_id
- public_subdomain unique
- target_host
- target_port
- status
- created_at
- updated_at
- expires_at nullable
- revoked_at nullable
- last_seen_at nullable
- client_version nullable

## AuditLog
- id UUID
- user_id nullable
- action
- entity_type
- entity_id
- request_id
- metadata_json
- created_at

## Optional TunnelMetricSnapshot
Only add if metrics need persistence.
Do not store high-cardinality raw request telemetry in PostgreSQL in V1.

## Indexes
- user.email
- credential.token_hash
- tunnel.public_subdomain
- tunnel.user_id
- tunnel.status
- tunnel.last_seen_at
- audit.created_at

## Constraints
- target_port valid range
- unique subdomain
- valid status values
- credential belongs to user
- tunnel belongs to user
