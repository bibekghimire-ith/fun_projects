# CLI Specification

Executable:
tunnelctl

## Commands

tunnelctl login
tunnelctl logout
tunnelctl status

tunnelctl tunnel http 3000
tunnelctl tunnel http --host 127.0.0.1 3000
tunnelctl tunnels
tunnelctl tunnel stop <id>
tunnelctl tunnel revoke <id>

## Login
Prompt for:
- server URL
- credentials/token as appropriate

Store credentials using platform-appropriate secure storage where feasible.

Fallback:
- OS config directory with restrictive permissions
- document limitations

## Tunnel command
Example:

tunnelctl tunnel http 3000

Output:

Public URL: https://abc.example.com
Local:      http://127.0.0.1:3000
Status:     CONNECTING

When online:

Public URL: https://abc.example.com
Local:      http://127.0.0.1:3000
Status:     ONLINE

## Errors
Provide actionable messages.

Examples:
- local port unavailable
- authentication failed
- server unreachable
- tunnel revoked
- target not allowed

Do not print secrets.

## Exit codes
Use stable non-zero exit codes for:
- configuration error
- auth error
- network error
- local target error
- server error
