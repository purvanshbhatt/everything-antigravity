---
name: realtime-websockets
disable-model-invocation: true
description: >-
  Builds realtime features with WebSockets and Server-Sent Events: choosing
  WebSockets vs SSE vs polling, connection authentication and Origin checks,
  heartbeats, reconnection with backoff and resume, presence, fan-out across
  instances via Redis or Pub/Sub, backpressure, proxy and load balancer
  timeouts, and graceful deploys. Use when adding live updates, chat,
  collaboration or notifications, or when connections drop or messages go
  missing.
---

# Realtime: WebSockets and SSE

A realtime connection is a long-lived, stateful resource on a fleet built for
short stateless requests. Proxies cut idle connections, deploys drop every
socket at once, instances only see their own clients, and mobile networks
vanish without a close frame. Design for disconnection as the normal case:
every client must be able to reconnect and catch up.

## When to use

- Live dashboards, notifications, chat, collaborative editing, multiplayer lobbies.
- Connections drop after a fixed interval, or only behind one proxy or load balancer.
- Messages are missed during reconnects or deploys; users on different instances miss each other's updates.
- Presence ("who is online") or typing indicators.

## When not to use

- Notifications while the app is closed: use `push-notifications`.
- GraphQL subscription schema design: use `graphql-servers` (this skill covers the transport).
- Durable work queues between services: use `message-queues`.
- Game state sync with prediction and lag compensation: use `multiplayer-networking`.

## Workflow

1. **Choose the transport.** Use the decision table below. Default to SSE for server-to-client streams (plain HTTP, automatic reconnect with `Last-Event-ID`); use WebSockets when clients send frequent messages or need binary frames. Consider a managed service (Firestore listeners, Firebase Realtime Database) when you mainly sync documents.

   **Check:** You can state why the simpler option (polling or SSE) is not enough.

2. **Define a message protocol.** A typed envelope such as `{ "type": "chat.message", "id": "...", "seq": 1042, "payload": {...} }`, with a server-assigned sequence per channel, a protocol version negotiated at connect, and acknowledgements for messages that must not be lost.

   **Check:** Every message type is documented with direction, payload schema and delivery expectation.

3. **Authenticate and authorize.** Browsers cannot set custom headers on a WebSocket handshake. Either use the session cookie and validate the `Origin` header against an allowlist (prevents cross-site WebSocket hijacking), or exchange an authenticated HTTP call for a short-lived single-use ticket (30-60 seconds) passed on connect. Never put long-lived tokens in URLs (they end up in logs). Authorize every channel subscription, and close with code 1008 when a token expires without renewal.

   **Check:** A connection from a foreign Origin and a subscription to another user's channel are both rejected in tests.

4. **Keep connections alive deliberately.** Send a ping every 20-30 seconds (WebSocket ping frames or SSE comment lines) and drop peers that miss two. Set every idle timeout on the path (proxy, load balancer, platform request timeout) above the ping interval. Cloud Run keeps a WebSocket open at most for the service's request timeout (up to 60 minutes), so clients must expect periodic reconnects.

   **Check:** A connection stays up through an idle period longer than the shortest timeout on the path.

5. **Reconnect and resume.** Clients reconnect with exponential backoff and full jitter (for example 0.5 s doubling to a 30 s cap) and send the last sequence they processed. The server replays from a bounded per-channel buffer (Redis Streams works well) or tells the client to refetch a snapshot and then apply deltas.

   **Check:** Killing the server mid-stream loses no acknowledged messages after the client reconnects.

6. **Fan out across instances.** Each instance only holds its own sockets. Publish channel messages through Redis Pub/Sub (no history), Redis Streams (history for resume), Google Cloud Pub/Sub or NATS, and have every instance deliver to its local subscribers. Sticky sessions are only needed for transports with HTTP long-polling fallback (for example Socket.IO); enable session affinity in that case.

   **Check:** Two clients connected to different instances see each other's messages.

7. **Apply backpressure.** Give each connection a bounded send queue. When a slow client falls behind (watch `bufferedAmount`), coalesce or drop non-critical updates, or disconnect it with close code 1013 (try again later). Never let one slow consumer grow server memory without limit.

   **Check:** A throttled test client cannot raise server memory beyond the configured per-connection cap.

8. **Track presence with expiring state.** Heartbeat-driven, never "connected = online" alone:

   ```text
   ZADD presence:room:42 <now_ms> user:7                       # on each heartbeat
   ZREMRANGEBYSCORE presence:room:42 -inf <now_ms - 60000>     # evict stale members
   ZRANGE presence:room:42 0 -1                                # current members
   ```

   **Check:** A client that disappears without a close frame drops out of presence within the TTL.

9. **Deploy without a thundering herd.** On SIGTERM, stop accepting connections, send close code 1012 (service restart) or 1001 (going away), and drain. Client jitter spreads the reconnects.

   **Check:** A rolling deploy under load completes without an error spike or a reconnect storm.

## Patterns

### Transport decision

| Need | Choose |
| :--- | :--- |
| Server-to-client updates, text, behind ordinary HTTP infrastructure | SSE |
| Frequent client-to-server messages, binary, low latency both ways | WebSocket |
| Rare updates, very restrictive networks | Long polling or periodic fetch |
| Document sync with offline support | Firestore or Firebase Realtime Database listeners |

### Reverse proxy settings (nginx)

```nginx
location /ws/ {
  proxy_pass http://app;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 3600s;      # above the ping interval; the default 60s cuts idle sockets
}
```

For SSE through nginx, disable buffering (`proxy_buffering off;` or the `X-Accel-Buffering: no` response header). On Google Cloud load balancers, the backend service timeout also limits how long a WebSocket can stay open; verify against current docs.

### SSE endpoint (Express, TypeScript)

```ts
app.get('/events', async (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  const send = (e: { seq: number; type: string; data: unknown }) =>
    res.write(`id: ${e.seq}\nevent: ${e.type}\ndata: ${JSON.stringify(e.data)}\n\n`);
  for (const e of await replaySince(req.user.id, Number(req.get('Last-Event-ID') ?? 0))) send(e);
  const unsubscribe = bus.subscribe(req.user.id, send);
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
  req.on('close', () => { clearInterval(ping); unsubscribe(); });
});
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Long-lived JWT in the WebSocket URL | Short single-use ticket, or cookie plus Origin check | URLs are logged by proxies and servers |
| Skip Origin validation with cookie auth | Allowlist Origins | Cross-site WebSocket hijacking |
| Fixed-interval reconnect | Exponential backoff with jitter | Synchronized reconnect storms after outages |
| In-memory broadcast to local sockets only | Pub/Sub fan-out between instances | Users on other instances miss messages |
| Unbounded per-connection buffers | Bounded queue plus drop or disconnect | Slow clients exhaust server memory |
| Presence set on connect, cleared on close | Heartbeat with TTL eviction | Close frames are often never sent |

## Verification checklist

- [ ] Transport choice is justified; protocol envelope and versioning are documented.
- [ ] Auth tests cover foreign Origins, expired tokens and unauthorized channels.
- [ ] Heartbeats run below every idle timeout on the path.
- [ ] Reconnect with jittered backoff and resume from the last sequence is tested.
- [ ] Cross-instance fan-out verified with clients on different instances.
- [ ] Backpressure caps and graceful-deploy behaviour verified under load (k6 or Artillery).

## Related

- Knowledge: `redis-caching`, `message-queues`, `nginx-proxy`, `cloud-run`, `graphql-servers`, `push-notifications`, `auth-patterns`, `load-testing`.
- Agents: `backend-engineer`, `performance-optimizer`.
