# Claude Code Usage

Start Claude Code in the repository:

```bash
claude
```

First prompt:

Read CLAUDE.md and docs/MASTER_PROMPT.md. Inspect the repository. Do not modify code yet.
Produce an implementation plan, identify security risks and identify the first vertical slice.

Recommended loop:
Plan -> implement one slice -> test -> fix -> security review -> document -> commit.

Do not ask Claude Code to implement the entire product in one giant turn.
Use `.claude/commands/` and `.claude/skills/` for repeatable workflows.
