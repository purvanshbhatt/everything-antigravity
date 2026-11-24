---
name: backend-patterns
disable-model-invocation: true
description: >-
  Applies proven server-side patterns: layering, transactions and unit of
  work, transactional outbox, idempotent consumers, retries with backoff and
  jitter, circuit breakers, timeouts, cache-aside and invalidation, background
  jobs, connection pooling, and when CQRS or event sourcing are worth it. Use
  when building or reviewing service internals, fixing duplicate or lost
  events, cascading failures, stale caches or pool exhaustion.
---

# Backend Patterns

Most production incidents in services come from four places: a side effect
outside the transaction, a retry without idempotency, a call without a
timeout, and a cache nobody invalidates. This skill gives the pattern for each,
the rule that makes it correct, and how to prove it.

## When to use

- Writing a use case that touches a database and also publishes an event, calls an API or enqueues a job.
- Duplicate emails/charges, lost messages, "it worked on retry" bugs.
- Cascading failure when a dependency slows down; connection pool exhaustion; thundering herds.
- Adding a cache or a background worker; someone proposes CQRS or event sourcing.

## When not to use

- Service boundaries and module structure: use `software-architecture`.
- Wire contract (status codes, pagination, idempotency-key header): use `api-design`.
- Schema, indexes, locks and migrations: use `database-design`.
- Tracing and metrics for these patterns: use `observability-otel`.

## Workflow

1. **Draw the request path.** For the operation, list every I/O step in order: DB reads/writes, external calls, messages published, cache reads/writes, jobs enqueued. Mark which are inside the DB transaction.

   **Check:** You can point at each side effect and say whether it is transactional, idempotent and time-bounded.

2. **Put the transaction boundary in the use case.** The application service opens the transaction (unit of work), domain code mutates aggregates, repositories persist, commit happens once. Handlers and repositories never commit on their own. No network calls to third parties inside an open transaction (they hold locks and connections for the call's duration).

   **Check:** `grep_search` for `commit(`/`COMMIT`/`.transaction(` shows commits only in the use-case layer or a UoW helper.

3. **Make cross-system effects reliable with an outbox.** Write the business row and an `outbox` row in the same transaction; a relay publishes outbox rows and marks them sent. Delivery becomes at-least-once, so every consumer must be idempotent. SQL and relay code: [resilience code](references/resilience-code.md).

   **Check:** Killing the process between commit and publish loses nothing (the relay publishes on restart).

4. **Make consumers and handlers idempotent.** Record `(consumer, message_id)` in a unique-keyed table in the same transaction as the effect; on conflict, skip. For HTTP, store idempotency keys the same way.

   **Check:** A test delivers the same message twice and asserts one effect.

5. **Bound every remote call.** Set a timeout (connect plus overall deadline) on every client, propagate the caller's deadline, retry only transient failures of idempotent operations with exponential backoff and full jitter, and wrap flaky dependencies in a circuit breaker with a fallback.

   **Check:** No HTTP, gRPC, DB or cache client is constructed without an explicit timeout; retry code has a max-attempts and a total-deadline cap.

6. **Add caching last, with an invalidation plan.** Cache-aside with TTL plus jitter, delete-after-commit on writes, and stampede protection for hot keys. Measure the hit rate.

   **Check:** A write followed by a read returns fresh data in a test; a cache outage degrades to DB reads instead of errors.

7. **Size pools from the database side.** Total connections = instances × pool size, and it must stay below the database's `max_connections` minus headroom for admin and migrations.

   **Check:** The worst-case autoscaled instance count × pool size is written down and fits.

## Patterns

### Retry policy

| Retry | Don't retry |
| :--- | :--- |
| Connection reset or refused, DNS failure, timeout on an idempotent call | 400, 401, 403, 404, 409, 422 |
| HTTP 429 (honour `Retry-After`), 502, 503, 504 | Non-idempotent call without an idempotency key |
| gRPC `UNAVAILABLE`, `RESOURCE_EXHAUSTED` (with backoff) | gRPC `INVALID_ARGUMENT`, `FAILED_PRECONDITION`, `PERMISSION_DENIED` |
| Serialization failure / deadlock (`40001`, `40P01` in Postgres): retry the whole transaction | Anything after the caller's deadline has passed |

Delay: `sleep = random(0, min(cap, base * 2^attempt))` (full jitter). Typical: base 100 ms, cap 5-10 s, 3-5 attempts, overall deadline. Retry at one layer only: three layers of 3 retries is 27 calls to a dying dependency.

### Circuit breaker

Closed (count failures in a rolling window) → Open after a threshold such as 50% failures over at least 20 calls (fail fast, return fallback) → Half-open after a cool-down (let a few probes through) → Closed on success. Libraries: resilience4j (Java), Polly (.NET), opossum (Node), sony/gobreaker (Go), pybreaker (Python). Use a bulkhead (a separate pool or concurrency limit per dependency) so one slow dependency cannot exhaust shared threads or connections.

### Caching strategies

| Strategy | Read path | Write path | Use when |
| :--- | :--- | :--- | :--- |
| Cache-aside | App reads cache, on miss loads DB and fills | App writes DB, then deletes the key | Default choice |
| Read-through | Cache library loads on miss | Same as cache-aside | You want loading logic centralised |
| Write-through | Reads hit cache | Write goes to cache and DB synchronously | Read-after-write must be fresh and writes are rare |
| Write-behind | Reads hit cache | Cache flushes to DB asynchronously | Rarely; risk of loss on crash |

Invalidation rules: delete (don't update) the key after the DB commit; include a schema version in keys (`v3:user:42`); add ±10-20% jitter to TTLs; coalesce concurrent misses (singleflight, `golang.org/x/sync/singleflight`, or a short lock key); cache negative results briefly to stop miss storms on absent keys.

### Background jobs

- Durable queue only (Cloud Tasks, Pub/Sub, BullMQ, Celery, Sidekiq, a Postgres queue such as graphile-worker, River or Oban). An in-memory `setTimeout` or goroutine dies with the instance, and Cloud Run throttles CPU outside requests by default.
- Handlers are idempotent, carry the IDs they need (not whole objects), have a timeout below the visibility/ack deadline, and send to a dead-letter queue after N attempts.
- Enqueue from the outbox or in the same transaction as the triggering write (Postgres queues make this trivial).

### CQRS and event sourcing: only when needed

Use CQRS (separate read models fed by events) when read and write shapes diverge sharply, or reads need a different store (search index, analytics). Use event sourcing only when the history itself is the product (audit-mandated ledgers, temporal queries). Costs: eventual consistency in the UI, projection rebuilds, event schema versioning forever. A read replica or a materialized view usually solves the read-scaling problem first.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `db.commit(); publisher.publish(evt)` | Transactional outbox | A crash between the two loses the event; reversing the order publishes phantom events |
| Call a payment API inside an open DB transaction | Commit intent, call outside, record the result in a second transaction | Holds locks and a pooled connection for seconds; rollback can't undo the charge |
| Retry everything, everywhere | Retry transient errors of idempotent calls, at one layer, with jitter | Retry storms turn a brownout into an outage |
| No timeout on HTTP clients | Explicit connect and request timeouts plus deadline propagation | Default timeouts are often infinite; threads pile up |
| Update the cache on write | Delete the key after commit | Concurrent writers race and leave stale values |
| Pool size 100 on 50 autoscaled instances | Small pools (often 5-10) plus a pooler such as PgBouncer | 5,000 connections exceed `max_connections` and memory |
| Event sourcing for a CRUD app | Plain tables plus an audit log | Complexity with no consumer of the history |

## Verification checklist

- [ ] Each use case has one transaction boundary and no third-party calls inside it.
- [ ] Events and jobs leave via an outbox or a same-transaction queue insert.
- [ ] Duplicate-delivery tests exist for every consumer and idempotent endpoint.
- [ ] Every remote client has explicit timeouts; retries are capped, jittered and limited to transient errors.
- [ ] Circuit breakers or bulkheads guard dependencies with known instability.
- [ ] Cache keys are versioned, TTLs jittered, invalidation happens after commit.
- [ ] Pool size × max instances fits within the database connection limit.

## Related

- Knowledge: `database-design`, `api-design`, `software-architecture`, `observability-otel`, `python-fastapi`, `golang-services`, `cloud-devops`.
- Workflows: `/root-cause` (incident debugging), `/code-review`, `/feature-dev`.
- Agents: `code-architect`, `database-architect`, `performance-optimizer`, `silent-failure-hunter` (swallowed errors and lost events).
