# Networking Skill

You are responsible for robust network programming.

Requirements:
- asyncio-safe code
- explicit framing
- bounded buffers
- backpressure
- timeouts
- heartbeat
- reconnect
- graceful close
- cancellation handling
- connection state tracking

Treat malformed network data as hostile input.

Never assume packets/frames arrive in one read.

Never create an unlimited memory buffer from remote input.

Use well-tested HTTP/WebSocket libraries for protocol parsing.
