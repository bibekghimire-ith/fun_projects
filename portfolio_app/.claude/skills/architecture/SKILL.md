# Architecture Skill

Use this skill for architecture and cross-cutting decisions.

Rules:
- favor simple modular monolith architecture
- avoid microservices
- use Flask application factory
- isolate domains
- keep presentation thin
- keep business rules in services/domain code
- make theme rendering independent from content storage
- external integrations require adapters
- record material decisions in docs/DECISIONS.md

For major changes document:
- problem
- constraints
- selected design
- alternatives
- migration impact
- security impact
- testing approach
