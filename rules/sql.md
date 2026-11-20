---
trigger: glob
globs: "**/*.sql"
description: SQL and migration conventions
---

# SQL

## Safety

- Identify the dialect (PostgreSQL, MySQL, SQLite, BigQuery, SQL Server) from the project before writing SQL. Do not mix dialect features.
- Never build SQL by concatenating or interpolating user input. Use bind parameters (`$1`, `?`, `:name`) from application code.
- `DROP`, `TRUNCATE`, `ALTER ... DROP COLUMN`, and `UPDATE`/`DELETE` affecting many rows require explicit user confirmation before running against any shared or production database.
- Every `UPDATE` and `DELETE` has a `WHERE` clause. Run the equivalent `SELECT count(*)` first and compare the row count.
- Run multi-statement data changes inside a transaction where the dialect supports transactional DDL/DML, and keep transactions short.
- Application roles get only the privileges they need; no DDL rights at runtime.

## Migrations

- Migrations are versioned, forward-only files managed by the project's tool (Flyway, Liquibase, Alembic, Prisma, golang-migrate, EF). Never edit a migration that has been applied anywhere shared; add a new one.
- Use expand/contract for zero-downtime changes: add nullable column, deploy code that writes both, backfill in batches, add constraint, then remove the old path in a later release.
- PostgreSQL: create indexes on live tables with `CREATE INDEX CONCURRENTLY` (outside a transaction); add constraints as `NOT VALID` then `VALIDATE CONSTRAINT`; avoid long `ACCESS EXCLUSIVE` locks and set `lock_timeout`.
- Backfills run in bounded batches (by primary key range), never one statement over the whole table.
- Each migration states how to roll back, or why it cannot.

## Schema design

- Every table has a primary key. Use `bigint` identity or UUID per project convention.
- Declare `NOT NULL`, `UNIQUE`, `CHECK` and foreign keys; constraints are documentation that the database enforces.
- Index foreign key columns (PostgreSQL does not do it automatically) and columns used in frequent `WHERE`, `JOIN` and `ORDER BY`.
- Money in `numeric`/`decimal`, never floating point. Timestamps as `timestamptz` (PostgreSQL) or UTC with the zone documented.
- Consistent `snake_case` names; singular or plural table names, matching the existing schema.

## Queries

- List columns explicitly; no `SELECT *` in application queries or views, no `INSERT` without a column list.
- Use explicit `JOIN ... ON`, never comma joins. Qualify columns with table aliases when more than one table is involved.
- Remember NULL semantics: `IS NULL`, not `= NULL`; `NOT IN` with a nullable subquery returns no rows, so use `NOT EXISTS`.
- Do not wrap indexed columns in functions in `WHERE` (`WHERE created_at >= $1`, not `WHERE date(created_at) = $1`) unless there is a matching expression index.
- Paginate large result sets with keyset pagination (`WHERE id > $last ORDER BY id LIMIT n`) instead of large `OFFSET`.
- Check plans with `EXPLAIN` (PostgreSQL: `EXPLAIN (ANALYZE, BUFFERS)` on a non-production copy) before shipping queries on large tables.
- Use `SELECT ... FOR UPDATE` or atomic `UPDATE ... RETURNING` for read-modify-write instead of separate read and write.

## Style

- Uppercase keywords, one clause per line, CTEs (`WITH`) for readability. Follow `sqlfluff` config if present.
- Comment non-obvious business rules and any intentional full-table scan.
