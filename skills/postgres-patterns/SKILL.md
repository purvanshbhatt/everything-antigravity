---
name: postgres-patterns
description: >-
  Applies PostgreSQL features in depth: JSONB modelling and GIN indexes, CTEs
  and recursive queries, window functions, upserts and SKIP LOCKED queues,
  declarative partitioning, row-level security for multi-tenant data,
  extensions, and autovacuum, bloat and wraparound health. Use when writing
  advanced Postgres SQL, partitioning a large table, adding RLS, or diagnosing
  vacuum, bloat or long-transaction problems.
---

# PostgreSQL Patterns

PostgreSQL does far more than CRUD. Use its features to push invariants,
isolation and heavy set logic into the database, but confirm the server
version first and prove every pattern with a plan on realistic data.

## When to use

- Ranking, running totals, top-N per group, trees or graph walks.
- Semi-structured attributes in `jsonb`, or a job queue inside Postgres.
- A table is heading past ~100 GB or needs time-based retention: partitioning.
- Tenant isolation must hold even if application code forgets a `WHERE`: RLS.
- Autovacuum lags, tables bloat, or `age(datfrozenxid)` is climbing.

## When not to use

- Basic schema, type and index choices or zero-downtime migration recipes: use `database-design`.
- Reading plans and fixing one slow query: use `sql-optimization`.
- Embeddings and ANN indexes with pgvector: use `vector-databases`.
- Instance sizing, HA and connectivity on Google Cloud: use `cloud-sql-alloydb`.

## Workflow

1. **Confirm version and extensions.** Many features below are version-gated.

   ```sql
   SHOW server_version;
   SELECT name, installed_version, default_version FROM pg_available_extensions
   WHERE name IN ('pg_stat_statements','pg_trgm','btree_gist','vector','postgis','pg_partman');
   ```

   **Check:** Every feature you plan to use is available on this server and on the managed service (Cloud SQL, AlloyDB) that runs production.

2. **Pick the feature from the matrix below** and write the SQL against a scratch database seeded with realistic volume.

   **Check:** The query returns correct results on edge cases (ties, NULLs, empty groups, cycles).

3. **Prove the plan** with `EXPLAIN (ANALYZE, BUFFERS)`; for writes wrap it in `BEGIN; ... ROLLBACK;`.

   **Check:** The intended index or partition pruning appears in the plan.

4. **For RLS or partitioning, test as the application role**, not the owner or a superuser (both bypass RLS by default).

   ```sql
   SET ROLE app_user;
   SET app.tenant_id = '11111111-1111-1111-1111-111111111111';
   SELECT count(*) FROM invoices WHERE tenant_id <> current_setting('app.tenant_id')::uuid;  -- expect 0
   RESET ROLE;
   ```

   **Check:** Cross-tenant reads return zero rows and cross-tenant inserts fail `WITH CHECK`.

5. **Ship structural changes through reviewed migrations.** Converting a table to partitioned, enabling RLS or `VACUUM FULL` on a shared database needs an implementation-plan artifact and explicit user confirmation before running.

   **Check:** The user approved the plan, lock levels are stated, and a backup or PITR window exists.

## Patterns

### Feature matrix

| Need | Feature | Notes |
| :--- | :--- | :--- |
| Latest row per key | `DISTINCT ON (key) ... ORDER BY key, ts DESC` | Postgres-only; needs index on `(key, ts DESC)` |
| Top-N per group | `row_number() OVER (PARTITION BY g ORDER BY x DESC)` filtered `<= N`, or `LATERAL (... LIMIT N)` | `LATERAL` wins when an index serves each group |
| Running totals | `sum(x) OVER (PARTITION BY g ORDER BY ts ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)` | Default frame is `RANGE`, which lumps ties together |
| Trees and graphs | `WITH RECURSIVE` plus `CYCLE` clause (14+) or a path array guard | Always bound depth |
| Upsert | `INSERT ... ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v` | `MERGE` exists from 15; `ON CONFLICT` is safer under concurrency |
| Work queue | `SELECT ... FOR UPDATE SKIP LOCKED LIMIT n` | Partial index on the queued state |
| Mutual exclusion | `pg_advisory_xact_lock(hashtext('job:'||id))` | Released at commit; no table needed |
| Fuzzy search | `pg_trgm` GIN index plus `%` or `ILIKE '%x%'` | Cheap alternative to a search engine for small corpora |

### JSONB

```sql
CREATE INDEX products_attrs_gin ON products USING gin (attrs jsonb_path_ops);  -- serves @>, @?, @@
SELECT id FROM products WHERE attrs @> '{"color": "red"}';
CREATE INDEX products_sku ON products ((attrs->>'sku'));                       -- one hot key: expression B-tree
```

`jsonb_path_ops` is smaller and faster but supports only containment and jsonpath; use default `jsonb_ops` if you need key-exists (`?`, `?|`, `?&`). Promote any field you filter, join or constrain on every request to a real column.

### CTEs

From PostgreSQL 12, a side-effect-free CTE referenced once is inlined into the outer query. Add `MATERIALIZED` to force an optimization fence (compute once, reuse) or `NOT MATERIALIZED` to force inlining. Data-modifying CTEs (`WITH moved AS (DELETE ... RETURNING *) INSERT ...`) run exactly once and are atomic with the statement.

### Declarative partitioning

```sql
CREATE TABLE events (
  id bigint GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz NOT NULL,
  payload jsonb,
  PRIMARY KEY (id, created_at)                -- unique keys must include the partition key
) PARTITION BY RANGE (created_at);
CREATE TABLE events_2026_11 PARTITION OF events FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
```

- Partition only for retention (drop or detach instead of `DELETE`) or when queries always filter on the key. Keep partition counts in the hundreds; planning time grows with them.
- Pre-create future partitions (cron job or `pg_partman`); a missing partition makes inserts fail unless a `DEFAULT` partition exists.
- `ALTER TABLE ... DETACH PARTITION ... CONCURRENTLY` (14+) avoids blocking readers.
- An existing table cannot be converted in place: create the partitioned table, backfill in batches, then swap names in a short transaction.

### Row-level security

```sql
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;   -- owner is subject too
CREATE POLICY tenant_isolation ON invoices
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

Set the tenant with `SET LOCAL app.tenant_id = '...'` inside each transaction so it is safe with transaction-mode poolers. The `true` (missing_ok) argument makes an unset tenant yield NULL, which matches no rows. Index `tenant_id` as the leading column; policies are added to every query's predicate. The application role must not be a superuser or have `BYPASSRLS`.

### Vacuum and bloat health

```sql
SELECT relname, n_live_tup, n_dead_tup, last_autovacuum
FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 10;
SELECT pid, state, now() - xact_start AS xact_age, left(query, 80)
FROM pg_stat_activity WHERE xact_start IS NOT NULL ORDER BY xact_age DESC LIMIT 5;
SELECT datname, age(datfrozenxid) FROM pg_database ORDER BY 2 DESC;
```

- Long-open transactions (including `idle in transaction`) stop vacuum from removing dead rows everywhere. Set `idle_in_transaction_session_timeout`.
- Tune hot tables individually: `ALTER TABLE orders SET (autovacuum_vacuum_scale_factor = 0.02);`.
- Alert when `age(datfrozenxid)` passes roughly 1 billion; Postgres stops assigning transaction IDs before about 2.1 billion to prevent wraparound.
- `VACUUM FULL` rewrites the table under `ACCESS EXCLUSIVE`; prefer `pg_repack` (check that your managed service supports it).

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Store core relational fields only in `jsonb` | Real columns with constraints; `jsonb` for the variable tail | No constraints, poor statistics, bigger indexes |
| `SUM() OVER (ORDER BY ts)` with duplicate timestamps | Explicit `ROWS BETWEEN` frame or a unique tiebreaker | Default `RANGE` frame gives tied rows the same total |
| Recursive CTE without a cycle guard | `CYCLE` clause or path array check plus depth limit | Cyclic data loops until memory runs out |
| `SET app.tenant_id` at session level behind a pooler | `SET LOCAL` in every transaction | The setting leaks to the next client on that connection |
| Testing RLS as the table owner | `SET ROLE app_user` plus `FORCE ROW LEVEL SECURITY` | Owners and superusers bypass policies silently |
| `DELETE` old rows from a huge table | Drop or detach the partition | Mass deletes bloat and churn vacuum |

## Verification checklist

- [ ] Server version and extension availability were checked on the production platform.
- [ ] Window frames and tie-breakers are explicit where ordering has duplicates.
- [ ] Partitioned tables include the key in unique constraints and future partitions are pre-created.
- [ ] RLS is forced, tested as the application role, and fails closed when the tenant is unset.
- [ ] Vacuum health queries show no runaway dead tuples or long transactions.
- [ ] Structural changes on shared databases were confirmed by the user with backup or PITR in place.

## Related

- Knowledge: `database-design`, `sql-optimization`, `database-migrations`, `vector-databases`, `multi-tenant-saas`, `cloud-sql-alloydb`, `orm-patterns`.
- Workflows: `/root-cause` (lock or bloat incidents), `/code-review` (migration review).
- Agents: `database-architect`, `sql-reviewer`.
