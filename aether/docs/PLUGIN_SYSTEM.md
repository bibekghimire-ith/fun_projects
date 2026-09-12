# Plugin System

Future extension types:
- tool plugin
- integration
- model provider
- voice provider
- RAG source
- UI extension
- automation trigger/action

Lifecycle: install -> validate -> review permissions -> enable -> health-check -> use ->
disable -> uninstall.

Future MCP compatibility may be added, but MCP must not bypass the platform's own permissions
and audit controls.
