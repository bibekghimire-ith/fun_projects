# CLI Skill

Use Typer.

CLI must work on Linux, macOS and Windows.

Avoid shell-specific commands.

Use pathlib and platform-aware APIs.

Credential storage:
- prefer OS secure storage if practical
- otherwise restrictive config directory with documented limitations

UX:
- clear output
- actionable errors
- stable exit codes
- no accidental secret printing
- Ctrl+C handled gracefully
