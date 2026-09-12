# Deployment

Docker Compose is the primary local deployment.

Production evolution:
managed PostgreSQL, Redis, object storage, reverse proxy/TLS, secrets manager, horizontally
scaled API, dedicated workers and observability.

Do not put infrastructure-specific logic into business domains. Keep AWS/GCP/Azure adapters
replaceable.
