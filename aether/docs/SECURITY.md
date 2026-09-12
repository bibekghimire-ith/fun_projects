# Security

Threats: prompt injection, malicious webpages/documents, command injection, path traversal,
SSRF, secret leakage, unsafe tools, cross-user leakage, compromised integrations and malicious
plugins.

Controls: policy engine, allowlists, sandboxing, network restrictions, secret redaction,
encrypted credentials, authorization, audit logs, rate limiting, secure tokens, dependency
scanning and container hardening.

Treat all external content as untrusted data. External instructions must never override system
policy or user permissions.
