# ADR-001: Modular Monolith

## Status
Accepted

## Context
The six requested products share identity, private media, relationships, templates, responses, and administration.

## Decision
Use a modular monolith initially.

## Consequences
Positive:
- simple local deployment
- one database
- low operational overhead
- shared domain primitives
- easy Docker deployment

Negative:
- requires discipline around module boundaries

Extraction into services remains possible later.
