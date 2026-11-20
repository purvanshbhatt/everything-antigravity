# Resilience code: outbox, idempotent consumer, retry, pooling

## Transactional outbox (PostgreSQL)

```sql
CREATE TABLE outbox (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  aggregate_id  text        NOT NULL,
  event_type    text        NOT NULL,
  payload       jsonb       NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz
);
CREATE INDEX outbox_unpublished ON outbox (id) WHERE published_at IS NULL;
```

Write path (one transaction):

```sql
BEGIN;
INSERT INTO orders (...) VALUES (...);
INSERT INTO outbox (aggregate_id, event_type, payload)
VALUES ($1, 'OrderPlaced', $2);
COMMIT;
```

Relay (run in one or more workers; `SKIP LOCKED` lets several relays run without double-sending the same row in the same instant):

```sql
BEGIN;
SELECT id, event_type, payload
FROM outbox
WHERE published_at IS NULL
ORDER BY id
LIMIT 100
FOR UPDATE SKIP LOCKED;
-- publish each row to Pub/Sub / Kafka, wait for the broker ack
UPDATE outbox SET published_at = now() WHERE id = ANY($1);
COMMIT;
```

If publish succeeds but the `UPDATE` fails, the row is sent again: that is why consumers must be idempotent. Include the outbox `id` (or a UUID) as the message ID. Strict per-aggregate ordering needs a single relay per partition key (Pub/Sub ordering keys, Kafka partitions by `aggregate_id`). Alternative relay: change data capture (Debezium, Datastream) reading the WAL. Prune published rows on a schedule.

## Idempotent consumer

```sql
CREATE TABLE processed_messages (
  consumer    text        NOT NULL,
  message_id  text        NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer, message_id)
);
```

```python
def handle(msg: Message, session: Session) -> None:
    """Apply the effect once per message, even under redelivery."""
    with session.begin():
        inserted = session.execute(
            text("INSERT INTO processed_messages (consumer, message_id) "
                 "VALUES (:c, :m) ON CONFLICT DO NOTHING"),
            {"c": "billing", "m": msg.id},
        ).rowcount
        if inserted == 0:
            return                      # duplicate: already applied
        apply_effect(session, msg)      # same transaction as the dedupe row
    msg.ack()                           # ack only after commit
```

Effects outside the database (sending email, calling an API) cannot share the transaction: pass a deterministic idempotency key to the provider (for example the message ID) or record "sent" state and check it first.

## Retry with exponential backoff and full jitter

TypeScript:

```ts
export async function retry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  { attempts = 4, baseMs = 100, capMs = 5_000, deadlineMs = 15_000, isRetryable }: {
    attempts?: number; baseMs?: number; capMs?: number; deadlineMs?: number;
    isRetryable: (err: unknown) => boolean;
  },
): Promise<T> {
  const deadline = Date.now() + deadlineMs;
  for (let attempt = 0; ; attempt++) {
    const remaining = deadline - Date.now();
    try {
      return await fn(AbortSignal.timeout(Math.max(remaining, 1)));
    } catch (err) {
      if (attempt + 1 >= attempts || !isRetryable(err)) throw err;
      const delay = Math.random() * Math.min(capMs, baseMs * 2 ** attempt);
      if (Date.now() + delay >= deadline) throw err;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
```

Python: `tenacity` (`@retry(stop=stop_after_attempt(4) | stop_after_delay(15), wait=wait_random_exponential(multiplier=0.1, max=5), retry=retry_if_exception(is_transient))`). Go: `cenkalti/backoff` or a hand-written loop honouring `ctx.Done()`. Java: resilience4j `Retry` with `IntervalFunction.ofExponentialRandomBackoff`.

## Timeouts by client

| Client | Setting |
| :--- | :--- |
| Node `fetch` | `fetch(url, { signal: AbortSignal.timeout(2000) })` |
| Python `httpx` | `httpx.Client(timeout=httpx.Timeout(5.0, connect=1.0))` |
| Python `requests` | `requests.get(url, timeout=(1, 5))`: no timeout by default |
| Go `net/http` | `http.Client{Timeout: 5 * time.Second}` plus `http.NewRequestWithContext(ctx, ...)` |
| gRPC | Per-call deadline (`ctx` with timeout in Go, `deadline` option in other languages) |
| PostgreSQL | `SET statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout` per role or session |

## Connection pool sizing

- Start from the database: usable connections = `max_connections` − reserved (superuser, replication, migrations, admin) − other apps.
- Per instance pool = usable ÷ maximum instance count (Cloud Run `--max-instances`, HPA `maxReplicas`). Often 5-10 per instance.
- The HikariCP guideline `connections ≈ (core_count × 2) + effective_spindle_count` refers to the database server's cores and is a ceiling for useful concurrency, not a per-instance target.
- Put PgBouncer (transaction pooling) or a managed pooler in front when instances × pool exceeds the limit. In transaction mode, session state (`SET`, advisory locks, `LISTEN`, temp tables) does not survive between transactions; prepared statements need PgBouncer 1.21+ with `max_prepared_statements` set, or must be disabled in the driver.
- Set pool `max_lifetime` below any proxy or load-balancer idle timeout, and a connection acquisition timeout so callers fail fast instead of hanging.
