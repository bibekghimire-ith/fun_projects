# Tunnel Protocol

## Transport
Recommended:
- TLS terminated at tunnel server
- WebSocket Secure (WSS) for persistent client tunnel
- binary frames

## Envelope

Conceptual frame:

version
frame_type
flags
tunnel_id
stream_id
sequence
payload_length
payload

Use a robust binary serialization/framing implementation.

Never trust payload_length without bounds checking.

## Frame types

HELLO
AUTH
REGISTER
REGISTER_OK
REGISTER_ERROR

REQUEST_START
REQUEST_HEADERS
REQUEST_DATA
REQUEST_END

RESPONSE_START
RESPONSE_HEADERS
RESPONSE_DATA
RESPONSE_END

ERROR
PING
PONG
CLOSE

## Stream IDs
stream_id is unique within a tunnel connection.

Reserve 0 for connection-level frames.

## Limits
Reject frames exceeding configured maximum size.

## Heartbeat
Server/client send PING periodically.
Peer responds PONG.

If heartbeat timeout expires:
- mark connection offline
- fail active streams
- allow reconnect

## Authentication
AUTH must occur before REGISTER.

Do not accept application request frames before registration succeeds.

## Protocol version
Negotiate a major/minor version.

Incompatible major versions fail cleanly.

## Ordering
Frames belonging to a stream are processed in order.

Different streams may progress concurrently.

## Backpressure
Implement bounded async queues.

When queues are full:
- apply flow control/backpressure
- do not grow memory without bound

## Errors
Connection-level error:
- invalid authentication
- protocol mismatch

Stream-level error:
- local connection failure
- timeout
- body limit exceeded

## Future compatibility
Unknown optional frame types should be handled according to the versioning policy rather than crashing the whole connection.
