# Agent Architecture

Components: Context Builder, Planner, Policy Guard, Tool Selector, Tool Executor, Result
Validator, Memory Manager, Response Composer and Run Manager.

Runs are bounded by max iterations, tool calls, runtime, token budget and per-tool timeout.

The server remains authoritative for permissions, credentials, network access, filesystem roots
and external side effects. Future specialized agents must use the same policy/audit boundary.
