# Architecture

## Components

### Tunnel Server
Responsibilities:
- authentication
- API
- tunnel registry
- public HTTP routing
- protocol endpoint
- stream multiplexing
- limits
- audit
- metrics

### Tunnel Client
Responsibilities:
- CLI
- local target validation
- outbound persistent connection
- protocol framing
- local HTTP forwarding
- reconnect
- heartbeat
- graceful shutdown

### Database
Durable metadata only.

### Runtime registry
Active tunnel sockets and stream state.

## Logical architecture

                 +----------------------+
                 |      Internet        |
                 +----------+-----------+
                            |
                         HTTPS
                            |
                 +----------v-----------+
                 |    Reverse Proxy     |
                 | Nginx/Traefik/Caddy  |
                 +----------+-----------+
                            |
                 +----------v-----------+
                 |    Tunnel Server     |
                 |                      |
                 | API / Auth           |
                 | Public Proxy         |
                 | WSS Tunnel Endpoint  |
                 | Tunnel Registry      |
                 +----+-------------+---+
                      |             |
                    SQL           runtime
                      |             |
              +-------v--+      +---v--------+
              |PostgreSQL|      |Connections |
              +----------+      +------------+
                                    ^
                                    |
                              WSS outbound
                                    |
                         +----------+-----------+
                         |    Tunnel Client     |
                         | CLI + Local Proxy    |
                         +----------+-----------+
                                    |
                                    v
                              localhost:3000

## Runtime registry

Use a process-local registry in V1:
Map<tunnel_id, TunnelConnection>

This limits V1 to one active tunnel-server process for each tunnel.

For horizontal scaling later, introduce shared routing/control infrastructure.

## Request flow

1. Browser connects to public hostname.
2. Reverse proxy forwards request to tunnel server.
3. Server validates host.
4. Registry returns active connection.
5. Server allocates stream ID.
6. Server sends request frames.
7. Client forwards to local target.
8. Client streams response frames.
9. Server streams response to browser.
10. Stream closes.

## Persistence
PostgreSQL:
- users
- credentials
- tunnels
- audit logs

Runtime:
- sockets
- stream objects
- queues
- heartbeat state

## Process model
Start with one tunnel-server process.

If using multiple Uvicorn workers, explicitly ensure tunnel endpoint ownership is handled correctly. Do not pretend process-local sockets work across workers.

For V1, one worker per tunnel-server instance is acceptable and should be documented.

Horizontal scaling is a separate architecture phase.
