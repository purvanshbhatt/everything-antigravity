---
name: database-design
disable-model-invocation: true
description: >-
  Designs PostgreSQL-first schemas and data access: types and constraints,
  normalization versus denormalization, B-tree/GIN/partial/covering indexes,
  reading EXPLAIN (ANALYZE, BUFFERS), zero-downtime expand/contract
  migrations and lock pitfalls, Cloud SQL and AlloyDB notes, and how Firestore
  and BigQuery modelling differ. Use when creating tables, writing migrations,
  fixing slow queries, or choosing a Google Cloud datastore.
---

# Database Design

The schema outlives every service that touches it. Put invariants in the
database, index for the queries you actually run, prove plans with
`EXPLAIN (ANALYZE, BUFFERS)`, and ship every schema change so that old and new
code can run against it at the same time.

## When to use

- New tables, columns, constraints or indexes; reviewing a migration file.
- A query is slow, a migration locked production, or connections pile up behind a lock.
- Choosing between Cloud SQL, AlloyDB, Firestore and BigQuery, or modelling for one of them.

## When not to use

- Transactions, outbox, idempotency and pooling in application code: use `backend-patterns`.
- API pagination contracts: use `api-design` (it relies on the keyset pattern here).
- Provisioning instances, networking and IAM: use `cloud-devops` and `terraform-iac`.
- Deep multi-table redesigns or capacity planning: delegate to the `database-architect` agent.

## Workflow

1. **Collect the access patterns first.** For each table, list the top queries (filters, sort, limit), their frequency and latency target, and the write rate. `pg_stat_statements` gives this for an existing database:

   ```sql
   SELECT calls, round(mean_exec_time::numeric, 1) AS mean_ms, rows, left(query, 120)
   FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;
   ```

   **Check:** Every new index or denormalization traces back to a named query.

2. **Model with constraints.** Normalize to third normal form by default; each fact lives in one place. Encode invariants as `NOT NULL`, `CHECK`, `UNIQUE`, foreign keys and exclusion constraints, not only in application code. Type choices are in the table below.

   **Check:** You cannot insert an invalid row with plain SQL (try one in a test).

3. **Index deliberately.** Composite B-tree order is equality columns, then range, then sort. Index every foreign key you join or cascade on (PostgreSQL does not do it automatically). Use partial, covering, expression and GIN indexes where they match a query. Build them with `CREATE INDEX CONCURRENTLY` on live tables.

   **Check:** `EXPLAIN` shows the intended index for each named query, and unused indexes are found with `pg_stat_user_indexes` (`idx_scan = 0`) before adding more.

4. **Prove performance with real plans.** Run `EXPLAIN (ANALYZE, BUFFERS)` on production-like data volume. For writes, wrap in `BEGIN; ... ROLLBACK;` because `ANALYZE` executes the statement. Read the plan with [EXPLAIN and locks](references/explain-and-locks.md).

   **Check:** Estimated and actual row counts agree within about 10x on the hot nodes, and no large sequential scan or disk sort remains on a hot path.

5. **Write migrations as expand/contract.** Each deploy step must work with both the previous and the next application version. Set `lock_timeout` in every migration, split long operations, backfill in batches. Lint with `squawk` where available.

   **Check:** The migration runs on a production-sized copy with concurrent traffic and never holds `ACCESS EXCLUSIVE` for more than the lock timeout.

6. **Get approval for shared-database changes.** Present the migration plan (steps, lock levels, rollback, backfill duration) as an implementation-plan artifact. Never run a migration against a shared or production database without explicit user confirmation.

   **Check:** The user approved the plan, and a backup or point-in-time-recovery window is confirmed.

## Reference

### PostgreSQL type choices

| Need | Use | Avoid |
| :--- | :--- | :--- |
| Surrogate key | `bigint GENERATED ALWAYS AS IDENTITY`; UUIDv7 when IDs are generated client-side or exposed (`uuidv7()` is built in from PostgreSQL 18, generate in the app before that) | `serial`, random UUIDv4 as a clustered-style hot index key |
| Timestamps | `timestamptz` | `timestamp` without time zone |
| Strings | `text` plus `CHECK (length(x) <= n)` when a limit is a business rule | `char(n)` |
| Money | `numeric(19,4)` or integer minor units plus currency code | `float`, `real`, `money` |
| Enumerations | Lookup table, or `text` plus `CHECK (status IN (...))` | Native `ENUM` if values change often (removing a value is hard) |
| Semi-structured | `jsonb` for genuinely variable attributes, with GIN index if queried | `jsonb` for core relational fields |

### Index types

| Index | Good for | Example |
| :--- | :--- | :--- |
| B-tree composite | Equality plus range plus sort | `CREATE INDEX ON orders (tenant_id, status, created_at DESC);` |
| Partial | Hot subset | `CREATE INDEX ON jobs (run_at) WHERE state = 'queued';` |
| Covering | Index-only scans | `CREATE INDEX ON orders (customer_id) INCLUDE (total, created_at);` |
| Expression | Normalised lookups | `CREATE UNIQUE INDEX ON users (lower(email));` |
| GIN | `jsonb @>`, arrays, full text, `pg_trgm` | `CREATE INDEX ON docs USING gin (attrs jsonb_path_ops);` |
| GiST | Ranges, geometry, exclusion constraints | `EXCLUDE USING gist (room_id WITH =, during WITH &&)` (needs `btree_gist`) |
| BRIN | Huge append-only, time-ordered tables | `CREATE INDEX ON events USING brin (created_at);` |

### Normalize or denormalize

Denormalize only for a measured read path, and pick the mechanism: a materialized view (`REFRESH MATERIALIZED VIEW CONCURRENTLY` needs a unique index), a trigger-maintained summary column, or a read model fed by events. Document who keeps the copy consistent.

### Zero-downtime migration recipes

| Change | Safe sequence |
| :--- | :--- |
| Add column | `ADD COLUMN` nullable, or with a constant default (metadata-only since PostgreSQL 11) |
| Add `NOT NULL` | `ADD CONSTRAINT c CHECK (col IS NOT NULL) NOT VALID` → backfill → `VALIDATE CONSTRAINT c` → `SET NOT NULL` (uses the validated check, PostgreSQL 12+) → drop `c` |
| Add foreign key | `ADD CONSTRAINT fk ... NOT VALID` → `VALIDATE CONSTRAINT fk` |
| Add unique | `CREATE UNIQUE INDEX CONCURRENTLY` → `ADD CONSTRAINT u UNIQUE USING INDEX idx` |
| Rename column or table | Expand: add new, dual-write, backfill, switch reads, stop writing old → contract: drop old in a later release |
| Change type | New column plus backfill plus switch (most type changes rewrite the table under `ACCESS EXCLUSIVE`) |
| Drop column | Stop reading and writing it in code first, deploy, then drop |

Every migration starts with `SET lock_timeout = '5s';` (and a `statement_timeout`), and is retried on timeout. `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block; if it fails it leaves an `INVALID` index that must be dropped before retrying.

### Google Cloud datastores

| | Cloud SQL / AlloyDB (PostgreSQL) | Firestore | BigQuery |
| :--- | :--- | :--- | :--- |
| Model | Normalized relations, joins, transactions | Documents shaped per screen or query; denormalize; no joins | Wide denormalized tables with nested `STRUCT` and `ARRAY` |
| Keys and limits | Constraints enforced | 1 MiB per document; sustained writes to one document are limited (around 1 per second); avoid monotonically increasing IDs | Partition (`PARTITION BY DATE(ts)`) and cluster (up to 4 columns); set `require_partition_filter` |
| Indexes | You design them | Single-field automatic; composites in `firestore.indexes.json`, deploy with `firebase deploy --only firestore:indexes` | No indexes; pruning via partitions and clustering |
| Cost driver | Instance size and storage | Document reads, writes, deletes | Bytes scanned (or slots); `bq query --dry_run --use_legacy_sql=false '<sql>'` estimates |

Cloud SQL and AlloyDB notes: connect through the Cloud SQL Auth Proxy or connectors with IAM database authentication and private IP; size pools against `max_connections` for the tier; use Query Insights for slow queries; enable PITR before risky migrations. AlloyDB adds read pool instances and a columnar engine for analytical queries. `gcloud sql instances patch --database-flags` replaces the full flag list, so include existing flags.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Enforce uniqueness only in code | `UNIQUE` constraint or unique index | Concurrent requests race past application checks |
| `CREATE INDEX` on a live large table | `CREATE INDEX CONCURRENTLY` | The plain form blocks writes for the whole build |
| `ALTER TABLE` without `lock_timeout` | `SET lock_timeout` and retry | A queued `ACCESS EXCLUSIVE` request blocks every read behind it |
| Rename a column in one deploy | Expand/contract over several releases | Running pods still use the old name |
| `OFFSET 100000` pagination | Keyset (`WHERE (created_at, id) < (...)`) | Offset scans and discards every skipped row |
| Guess from `EXPLAIN` without `ANALYZE` | `EXPLAIN (ANALYZE, BUFFERS)` on realistic data | Estimates hide misestimates, loops and disk sorts |
| Model Firestore like SQL tables | One document per read pattern, duplicated fields | Joins become N document reads and N bills |
| `SELECT *` in BigQuery | Select columns, filter on the partition column | You pay for every column scanned |

## Verification checklist

- [ ] Each table's top queries are written down and each index maps to one.
- [ ] Constraints (`NOT NULL`, FK, `CHECK`, `UNIQUE`) encode the invariants.
- [ ] Foreign keys used in joins or cascades are indexed.
- [ ] Hot queries were checked with `EXPLAIN (ANALYZE, BUFFERS)` on realistic volume.
- [ ] Migrations set `lock_timeout`, use `CONCURRENTLY` and `NOT VALID` where applicable, and are expand/contract.
- [ ] The user approved any migration on a shared or production database, with backup or PITR confirmed.

## Related

- Knowledge: `backend-patterns`, `api-design`, `cloud-devops`, `terraform-iac`, `observability-otel`, `software-architecture`.
- Workflows: `/blueprint`, `/code-review` (migration review), `/root-cause` (slow query or lock incidents).
- Agents: `database-architect`, `performance-optimizer`, `cloud-devops-engineer`.
