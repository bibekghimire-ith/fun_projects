# Product Requirements Document

## Product
Secure Local Application Tunneling Platform

## Problem
Developers frequently run web applications on localhost but need a temporary public HTTPS URL for:
- demos
- testing webhooks
- remote QA
- client previews
- mobile testing
- integration testing

## Primary user
Developer/engineer operating a local application.

## User journey
1. Deploy or start tunnel server.
2. Install CLI.
3. Authenticate CLI.
4. Run:
   tunnelctl tunnel http 3000
5. CLI creates/registers tunnel.
6. CLI prints public HTTPS URL.
7. User shares URL.
8. Traffic is forwarded to localhost.
9. User stops or revokes tunnel.

## Functional requirements

### FR1 Authentication
Users can authenticate CLI/dashboard.

### FR2 Tunnel creation
Authenticated user can create a tunnel targeting a loopback host/port.

### FR3 Public URL
Each active tunnel gets a unique HTTPS hostname.

### FR4 Persistent connection
Client maintains outbound persistent connection.

### FR5 HTTP forwarding
Support common HTTP methods and request/response headers/body.

### FR6 Multiplexing
Multiple public requests can use one tunnel connection.

### FR7 Lifecycle
Create, online, drain, offline, revoke.

### FR8 Reconnect
Client reconnects automatically.

### FR9 Limits
Configurable limits.

### FR10 Dashboard
Show active tunnel information and controls.

### FR11 CLI
Create/list/stop/revoke/login/logout.

### FR12 Audit
Record security-sensitive actions.

### FR13 Health
Health/readiness endpoints.

### FR14 Docker
Server can run using Docker Compose.

## V1 exclusions
- public user registration
- anonymous tunnels
- arbitrary remote TCP proxy
- UDP tunneling
- arbitrary LAN forwarding
- SSH server
- SOCKS proxy
- stealth operation
- persistence outside normal developer CLI behavior
- automatic port scanning
- third-party SaaS dependency
- WebSocket support unless implemented and tested explicitly

## Non-functional
- secure
- portable
- observable
- testable
- low operational complexity
- bounded memory usage
- documented
