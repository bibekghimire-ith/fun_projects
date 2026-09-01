# Architecture Skill

Use this skill when making architectural decisions or cross-cutting changes.

## Rules
- Preserve layered architecture.
- Prefer boring, explicit designs.
- Keep domain calculations independent of Flask.
- Introduce abstractions only at genuine boundaries: market data, storage, email, scheduling, cost-basis strategy.
- Record significant architecture decisions in docs/DECISIONS.md.
- Consider migration compatibility and backward compatibility.
- Evaluate security, operability, and testability for every cross-cutting change.

## Required output for major changes
Explain:
- problem
- constraints
- chosen design
- rejected alternatives
- migration impact
- testing strategy
