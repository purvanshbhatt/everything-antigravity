---
name: mysql-mariadb
disable-model-invocation: true
description: >-
  Designs and tunes MySQL and MariaDB on InnoDB: clustered primary keys,
  secondary and covering indexes, EXPLAIN ANALYZE, slow-log and
  performance_schema triage, locking and deadlocks, replication lag, and
  online schema changes (INSTANT/INPLACE DDL, gh-ost, pt-online-schema-change).
  Use when writing schemas or queries for MySQL or MariaDB, a query is slow, an
  ALTER might lock production, or replicas fall behind.
---

# MySQL and MariaDB

InnoDB stores every table as a B-tree clustered on the primary key, and every
secondary index carries that key. Most MySQL performance and locking behaviour
follows from that one fact. MariaDB diverged from MySQL after 5.5, so check
which server and version you are on before using any feature below.

## When to use

- New tables or indexes on MySQL 8.x or MariaDB 10.6+/11.x, including Cloud SQL for MySQL.
- A slow query, a full table scan, a deadlock, or "Waiting for table metadata lock".
- An `ALTER TABLE` on a large or busy table.
- Replica lag, read-after-write anomalies, or failover planning.

## When not to use

- Engine-neutral plan reading and index theory: use `sql-optimization`.
- Migration tooling, expand/contract sequencing and CI checks: use `database-migrations`.
- PostgreSQL work: use `postgres-patterns`.
- Instance provisioning and HA on Google Cloud: use `cloud-sql-alloydb`.

## Workflow

1. **Identify server and settings.**

   ```sql
   SELECT VERSION(), @@version_comment, @@transaction_isolation, @@sql_mode, @@innodb_buffer_pool_size;
   ```

   **Check:** You know MySQL vs MariaDB, the major version, and whether strict mode and `ONLY_FULL_GROUP_BY` are on.

2. **Find the expensive statements** from data, not guesses.

   ```sql
   SELECT digest_text, count_star, ROUND(sum_timer_wait/1e12, 1) AS total_s, sum_rows_examined
   FROM performance_schema.events_statements_summary_by_digest
   ORDER BY sum_timer_wait DESC LIMIT 10;
   ```

   Or enable the slow log (`slow_query_log = ON`, `long_query_time = 1`) and summarise it with `pt-query-digest`. On Cloud SQL, set these as database flags and use Query Insights.

   **Check:** Each fix you plan targets a statement in this top list.

3. **Explain with real execution.** MySQL 8.0.18+: `EXPLAIN ANALYZE SELECT ...`. MariaDB: `ANALYZE FORMAT=JSON SELECT ...`. Look at `type` (`ALL` = full scan), `key`, `rows` versus actual rows, and `Extra` (`Using filesort`, `Using temporary`, `Using index` = covering).

   **Check:** The hot query uses the intended index and examines close to the rows it returns.

4. **Design the index** using the leftmost-prefix rule (below), then verify with step 3. Before dropping an index, make it invisible first (MySQL 8.0 `ALTER TABLE t ALTER INDEX i INVISIBLE`; MariaDB 10.6+ `IGNORED`) and watch for regressions.

   **Check:** `sys.schema_unused_indexes` shows no new dead weight, and the old plan does not come back.

5. **Plan the DDL path** before running any `ALTER` (table below). Always set `SET SESSION lock_wait_timeout = 5;` first; its default is one year. On a shared or production database, present the plan, the algorithm and expected duration, and get explicit user confirmation.

   **Check:** The `ALTER` names `ALGORITHM=INSTANT` or `ALGORITHM=INPLACE, LOCK=NONE` so it fails rather than silently copying, or an online tool is used.

## Reference

### Keys and types

| Choice | Do | Avoid |
| :--- | :--- | :--- |
| Primary key | `BIGINT UNSIGNED AUTO_INCREMENT`, or time-ordered UUIDv7 stored as `BINARY(16)` | Random UUIDv4 as PK (page splits, fat secondary indexes) |
| Charset | `utf8mb4` with an explicit collation | `utf8` (an alias for 3-byte `utf8mb3`, no emoji) |
| Money | `DECIMAL(19,4)` or integer minor units | `FLOAT`, `DOUBLE` |
| Time | `DATETIME(6)` stored in UTC, or `TIMESTAMP` (range ends in 2038) | Local-time `DATETIME` without a convention |
| Booleans/enums | `TINYINT(1)`; lookup table or `VARCHAR` plus `CHECK` (enforced from MySQL 8.0.16) | `ENUM` when values change often |

### Index rules

- Composite index `(a, b, c)` serves filters on `a`, `a,b`, `a,b,c`; equality columns first, then the range column, then sort columns.
- A range condition stops later columns from being used for seeking.
- Covering indexes (all selected columns in the index) avoid primary-key lookups.
- Functions on columns (`WHERE DATE(created_at) = ...`) and implicit casts (`WHERE varchar_col = 123`) disable the index. Use ranges and matching literal types, or functional indexes (MySQL 8.0.13+).

### DDL paths

| Change | MySQL 8.0 path |
| :--- | :--- |
| Add nullable column | `ALGORITHM=INSTANT` (any position from 8.0.29) |
| Add or drop secondary index | `ALGORITHM=INPLACE, LOCK=NONE` |
| Change column type, add PK, convert charset | Table copy: use `gh-ost` or `pt-online-schema-change` |
| Large table, low-impact required | Online tool with throttling on replica lag |

```bash
pt-online-schema-change --alter "ADD COLUMN note VARCHAR(255) NULL" D=shop,t=orders --dry-run
pt-online-schema-change --alter "ADD COLUMN note VARCHAR(255) NULL" D=shop,t=orders --execute
```

`gh-ost` is triggerless and binlog-based (needs `binlog_format=ROW`); without `--execute` it only does a no-op test run. Managed services restrict `SUPER` and binlog access, so check each tool's notes for your platform before relying on it.

### Locking and transactions

- InnoDB defaults to `REPEATABLE READ` with next-key (gap) locks: range updates can lock rows you never touch. Consider `READ COMMITTED` for high-concurrency OLTP after reviewing the consequences.
- Any long transaction holds a metadata lock that blocks `ALTER`, and the waiting `ALTER` then blocks every new query on the table. Check `sys.schema_table_lock_waits` and kill or finish the blocker before retrying.
- Deadlocks: `SHOW ENGINE INNODB STATUS` shows the latest one. Access rows in a consistent order, keep transactions short, and retry on error 1213.

### Replication

- Use row-based binlogs and GTIDs. Monitor `SHOW REPLICA STATUS` (`Seconds_Behind_Source`); older servers use `SHOW SLAVE STATUS`.
- Replicas are asynchronous: route read-after-write paths to the primary or wait for the GTID.
- Big single transactions (mass `UPDATE`, `DELETE`) replay serially and cause lag. Batch them by primary-key range.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Run a bare `ALTER TABLE` on a busy table | Set `lock_wait_timeout`, name the algorithm, or use an online tool | A queued metadata lock stalls all traffic on the table |
| Random UUIDv4 primary keys | Auto-increment or UUIDv7 in `BINARY(16)` | Random inserts split pages and bloat every secondary index |
| `utf8` charset | `utf8mb4` | `utf8` truncates or rejects 4-byte characters |
| `WHERE YEAR(created_at) = 2026` | `created_at >= '2026-01-01' AND created_at < '2027-01-01'` | Functions on the column defeat the index |
| `DELETE FROM big WHERE ...` in one statement | Batches of 1-10k by PK with pauses | Huge transactions lock, bloat undo and lag replicas |
| Drop an index you think is unused | Make it invisible or ignored, observe, then drop | Restoring a dropped index on a big table takes hours |

## Verification checklist

- [ ] Server flavour and version were confirmed before using version-specific syntax.
- [ ] Index changes trace to statements in the digest or slow-log top list.
- [ ] `EXPLAIN ANALYZE` (or MariaDB `ANALYZE`) confirms the new plan on realistic data.
- [ ] Every `ALTER` names its algorithm or uses an online tool, with `lock_wait_timeout` set.
- [ ] Large writes are batched and replica lag was watched while they ran.
- [ ] The user confirmed DDL on any shared or production database.

## Related

- Knowledge: `sql-optimization`, `database-design`, `database-migrations`, `cloud-sql-alloydb`, `orm-patterns`, `postgres-patterns`.
- Workflows: `/root-cause` (lock waits, lag incidents).
- Agents: `database-architect`, `sql-reviewer`.
