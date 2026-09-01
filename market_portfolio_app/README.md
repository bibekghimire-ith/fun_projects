# Portfolio Manager — Claude Code Build Kit

This bundle contains the project specification, Claude Code project memory, skills, commands, architecture, security, testing, and implementation plan.

## Recommended usage
1. Create a new git repository.
2. Copy the contents of this kit into the repository.
3. Start Claude Code from the repository root.
4. Read CLAUDE.md and docs/MASTER_PROMPT.md.
5. Ask Claude Code to implement Phase 0.
6. Continue phase-by-phase using `/build-phase`.
7. Use `/test-all`, `/review`, and `/security-audit` before release.

The kit deliberately uses a Flask + Jinja2 + HTMX + Bootstrap architecture instead of a SPA to maximize portability and reduce operational complexity.
