---
name: webhooks
description: >-
  Builds and consumes webhooks reliably: HMAC signatures over the raw body,
  constant-time verification, replay windows, fast 2xx then async
  processing, idempotency by event ID, out-of-order handling, retries with
  backoff and endpoint disabling, secret rotation, SSRF-safe delivery to
  customer URLs, and local testing with tunnels. Use when
  receiving webhooks from Stripe, GitHub and similar, or offering webhooks
  from your own API.
---

# Webhooks

A webhook is an HTTP request from someone else's retry loop. Receivers must
assume every delivery can be forged, replayed, duplicated, delayed or
reordered; senders must assume every endpoint is slow, flaky or hostile. This
skill covers both sides.

## When to use

- Receiving events from payment providers, Git hosts, CRMs, identity providers or SaaS tools.
- Offering webhooks to your own customers or integrators.
- Duplicate processing, signature failures, missed events, or endpoints timing out.

## When not to use

- Event delivery between your own services: use `message-queues` and `event-driven-architecture`.
- Stripe-specific event flows and objects: use `payments-stripe` (this skill covers the generic mechanics).
- Choosing signing primitives beyond HMAC: use `cryptography`.

## Workflow

### Receiving

1. **Capture the raw body.** Signatures cover exact bytes; parsing and re-serializing JSON changes them. Express: `express.raw({ type: 'application/json' })` on the webhook route only; FastAPI: `await request.body()`; Go: read `r.Body` before decoding.

   **Check:** The verification function receives a `Buffer` or `bytes`, not a parsed object.

2. **Verify the signature in constant time.** Recompute the HMAC with the endpoint secret over exactly what the provider documents (GitHub: the body, header `X-Hub-Signature-256: sha256=<hex>`; Stripe: `<timestamp>.<body>` via `stripe.webhooks.constructEvent`; Standard Webhooks: `<id>.<timestamp>.<body>`). Compare with `crypto.timingSafeEqual`, `hmac.compare_digest` or `hmac.Equal`. Prefer the provider's SDK helper when one exists.

   **Check:** Tests with a tampered body, a wrong secret and a missing header all return 400 or 401.

3. **Reject stale deliveries.** When the scheme signs a timestamp, reject requests outside a tolerance window (commonly 5 minutes) to stop replays.

   **Check:** A correctly signed request with a 10-minute-old timestamp is rejected.

4. **Acknowledge fast, process asynchronously.** After verification, persist the event (or enqueue it) and return 2xx within a few seconds; providers time out and retry slow endpoints. Do the real work in a background job.

   **Check:** Endpoint p99 latency stays under one second while downstream processing is slow.

5. **Deduplicate by event ID.** Insert the provider's event ID into a table with a unique constraint in the same transaction as the side effect; skip on conflict. Retries and manual redeliveries reuse the ID.

   **Check:** Delivering the same event twice produces one effect.

6. **Handle reordering.** Delivery order is not guaranteed. Compare object versions or timestamps before applying, or treat the webhook as a hint and fetch the current object from the provider API.

   **Check:** Delivering `subscription.updated` before `subscription.created` ends in the correct final state.

7. **Monitor and reconcile.** Alert on signature failures (misconfigured secret or attack) and processing failures; run a periodic reconciliation against the provider API for events you may have missed during outages.

   **Check:** A simulated one-hour outage is fully recovered by provider retries or reconciliation.

### Sending

1. **Define the event contract.** Each delivery has a unique `id`, a `type`, a `created` timestamp and an API version; document whether payloads are thin (IDs only; receivers fetch) or full snapshots. Publish JSON Schemas and sample payloads.

   **Check:** Every event type has a schema, a sample and a changelog entry.

2. **Sign every delivery.** HMAC-SHA256 over `id.timestamp.body` with a per-endpoint secret, following the Standard Webhooks spec (`webhook-id`, `webhook-timestamp`, `webhook-signature` headers) so customers can use existing libraries. Support two active secrets during rotation and include both signatures.

   **Check:** A reference verifier in at least one language validates your deliveries in CI.

3. **Deliver from a queue with retries.** Enqueue deliveries from an outbox; attempt with a short timeout (5-10 seconds); treat 2xx as success; retry other responses and timeouts with exponential backoff and jitter over a day or more; after sustained failure, disable the endpoint and notify the owner.

   **Check:** A failing endpoint is retried on schedule and then disabled with a notification.

4. **Protect against SSRF.** Customer URLs can target your internal network. Require HTTPS, resolve DNS and block private, loopback, link-local and metadata addresses (including `169.254.169.254`) at connect time, do not follow redirects, and send from an egress proxy (for example Smokescreen) with no internal access.

   **Check:** Registering `http://169.254.169.254/` or a hostname that resolves to `10.0.0.1` fails.

5. **Give customers visibility.** A delivery log with request, response status and latency, a manual redeliver action, and test events.

   **Check:** Support can see the last 20 deliveries for an endpoint and redeliver one.

## Patterns

### Constant-time verification (Node, GitHub-style)

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifySignature(rawBody: Buffer, header: string | undefined, secret: string): boolean {
  if (!header) return false;
  const expected = Buffer.from('sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex'));
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
```

### Local testing

```bash
stripe listen --forward-to localhost:3000/webhooks/stripe   # forwards test-mode events and prints a signing secret
stripe trigger payment_intent.succeeded
cloudflared tunnel --url http://localhost:3000              # or ngrok http 3000
```

Exposing a local server through a public tunnel is outward-facing: confirm with the user first, keep signature verification on, and stop the tunnel afterwards. Save real (sanitized) payloads as test fixtures.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Verify against re-serialized JSON | Verify the raw bytes | Signatures fail or, worse, get disabled |
| Compare signatures with `==` | Constant-time comparison | Timing leaks help forge signatures |
| Do the work before responding | Persist, return 2xx, process async | Timeouts trigger retries and duplicates |
| Assume one delivery per event | Unique event-ID table | Providers retry and redeliver |
| Trust payload state blindly | Version checks or fetch current state | Out-of-order delivery overwrites newer data |
| POST to any customer URL from app servers | Validated URLs through an egress proxy | SSRF into internal services and cloud metadata |
| Retry forever without disabling | Backoff window, then disable and notify | Dead endpoints consume queue capacity |

## Verification checklist

- [ ] Signatures verified on raw bytes in constant time; timestamps enforced.
- [ ] Endpoint returns 2xx quickly; processing is async and idempotent by event ID.
- [ ] Out-of-order and duplicate deliveries are tested.
- [ ] Outgoing deliveries are signed, retried with backoff, logged and SSRF-protected.
- [ ] Secret rotation works with two active secrets.
- [ ] Reconciliation or replay covers outages.

## Related

- Knowledge: `payments-stripe`, `background-jobs`, `api-security`, `cryptography`, `event-driven-architecture`, `api-design`.
- Agents: `security-guard`, `backend-engineer`.
