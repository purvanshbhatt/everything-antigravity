# Reading EXPLAIN and avoiding lock incidents (PostgreSQL)

## Running EXPLAIN safely

```sql
-- Read query: safe to run as-is
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS)
SELECT ... ;

-- Write query: ANALYZE executes it, so roll back
BEGIN;
EXPLAIN (ANALYZE, BUFFERS) UPDATE orders SET status = 'closed' WHERE ...;
ROLLBACK;
```

PostgreSQL 18 includes buffer statistics in `EXPLAIN ANALYZE` by default; state `BUFFERS` explicitly so the command works the same on older versions. For a visual view, paste the `FORMAT JSON` output into a plan visualiser such as explain.dalibo.com (only if the query text and plan contain no sensitive data).

## What to look at, in order

1. **Total time and the most expensive node.** `actual time=start..end` is per loop; multiply by `loops`. The node with the largest exclusive time is the target.
2. **Row estimates versus actuals.** `rows=10` estimated versus `rows=250000` actual means stale statistics or correlated columns. Fix with `ANALYZE table;`, a higher `ALTER TABLE ... ALTER COLUMN ... SET STATISTICS 1000`, or `CREATE STATISTICS s (dependencies) ON col_a, col_b FROM t;`.
3. **Scan types.**
   - `Seq Scan` with a selective filter and high `Rows Removed by Filter` on a large table: missing or unusable index.
   - `Index Scan` returning most of the table: the planner was misled; a seq scan may be better.
   - `Index Only Scan` with high `Heap Fetches`: the visibility map is stale; vacuum the table.
   - `Bitmap Heap Scan` with `Recheck Cond` and `lossy` blocks: `work_mem` too small for the bitmap.
4. **Joins.** `Nested Loop` with a large outer side and an inner index scan repeated thousands of times (`loops=50000`) is the classic N+1 inside SQL. `Hash Join` with `Batches: 8` spilled to disk; raise `work_mem` for that session or reduce rows earlier.
5. **Sorts and aggregates.** `Sort Method: external merge Disk: 120MB` means it spilled; an index matching `ORDER BY` or more `work_mem` fixes it. `HashAggregate` with batches also spills.
6. **Buffers.** `shared hit` is cache, `shared read` is from disk or the OS cache, `temp read/written` is spill. High `read` on a repeated query means the working set does not fit in `shared_buffers`.

## Common fixes

| Symptom | Fix |
| :--- | :--- |
| Filter on `lower(email)` ignores the index on `email` | Expression index on `lower(email)` |
| `LIKE '%term%'` is slow | `pg_trgm` GIN index (`gin_trgm_ops`) or full-text search |
| `WHERE a = ? ORDER BY b LIMIT 20` sorts everything | Composite index `(a, b)` |
| `OR` across columns prevents index use | `UNION ALL` of two indexed queries, or a GIN index on a combined expression |
| Function or type cast on the indexed column | Compare like with like (`created_at >= $1::timestamptz`), no wrapper on the column |
| `IN (SELECT ...)` or `NOT IN` with NULLs | `EXISTS` / `NOT EXISTS` |
| Count of a huge table for a UI badge | Estimated count from `pg_class.reltuples` or a maintained counter |

## Lock levels that bite

| Operation | Lock | Blocks |
| :--- | :--- | :--- |
| `SELECT` | `ACCESS SHARE` | Only `ACCESS EXCLUSIVE` |
| `INSERT` / `UPDATE` / `DELETE` | `ROW EXCLUSIVE` | DDL that takes `SHARE` or stronger |
| `CREATE INDEX` (plain) | `SHARE` | All writes for the whole build |
| `CREATE INDEX CONCURRENTLY`, `VALIDATE CONSTRAINT`, `VACUUM` | `SHARE UPDATE EXCLUSIVE` | Other DDL and vacuum on the table, not reads or writes |
| Most `ALTER TABLE` (add column, drop column, set type, add constraint without `NOT VALID`) | `ACCESS EXCLUSIVE` | Everything, including `SELECT` |

The lock queue is the trap: an `ALTER TABLE` waiting behind one long-running transaction holds its place in the queue, and every new `SELECT` queues behind it. A five-second-old analytics query can stall all traffic. Defences:

```sql
SET lock_timeout = '5s';          -- give up instead of queueing forever
SET statement_timeout = '15min';  -- bound backfills and index builds
```

Find blockers during an incident:

```sql
SELECT pid, state, wait_event_type, now() - xact_start AS xact_age,
       pg_blocking_pids(pid) AS blocked_by, left(query, 100) AS query
FROM pg_stat_activity
WHERE datname = current_database() AND state <> 'idle'
ORDER BY xact_start;
```

Terminating a session (`pg_terminate_backend(pid)`) rolls back its work: ask the user before doing it on a shared or production database.

## Batched backfill

```sql
-- Repeat until 0 rows updated; each batch is its own short transaction.
WITH batch AS (
  SELECT id FROM orders
  WHERE total_cents IS NULL
  ORDER BY id
  LIMIT 5000
  FOR UPDATE SKIP LOCKED
)
UPDATE orders o SET total_cents = (o.total * 100)::bigint
FROM batch WHERE o.id = batch.id;
```

Sleep briefly between batches, watch replication lag on replicas, and make the backfill idempotent so it can be restarted.

## Migration linting

- `squawk` lints PostgreSQL migration SQL for blocking operations (for example `squawk migrations/*.sql`).
- Framework tools: `strong_migrations` (Rails), `django-pg-zero-downtime-migrations`, Atlas lint (`atlas migrate lint`). Check each tool's current docs for flags.
