---
name: duckdb-analytics
description: >-
  Runs fast local analytics with DuckDB: SQL directly on Parquet, CSV and JSON
  files (local or in Cloud Storage and S3), the CLI and Python API with pandas
  and Polars, friendly SQL extensions, profiling data, memory settings, and
  exporting results to Parquet or CSV. Use when analysing files or extracts on
  a laptop, prototyping warehouse SQL, converting CSV to Parquet, or adding
  embedded analytics to a notebook or script.
---

# DuckDB Analytics

DuckDB is an in-process columnar database: no server, one binary or one
`pip install`, and it queries files where they sit. Reach for it before
spinning up a cluster or loading a warehouse for anything that fits on one
machine, which today is often tens or hundreds of GB.

## When to use

- Exploring CSV, Parquet or JSON exports, logs or extracts quickly.
- Converting and repartitioning files (CSV to Parquet, many small files into fewer).
- Prototyping SQL before running it on BigQuery.
- Analytics inside notebooks, scripts, tests or a small app without a database server.

## When not to use

- Multi-user OLTP or many concurrent writers: use PostgreSQL (`postgres-patterns`).
- Shared, governed warehouse data with access control: use `bigquery`.
- Data truly beyond one machine's disk and memory: use `pyspark`.
- Statistical method choice and EDA narrative: use `exploratory-data-analysis`.

## Workflow

1. **Install and open.** `pip install duckdb` for Python, or the standalone CLI from the official site (winget, Homebrew and other package managers also carry it; verify the package name). Use a persistent file when you want tables to survive: `duckdb analytics.duckdb`. In the CLI, `.timer on` shows query time.

   **Check:** `duckdb -c "SELECT version()"` prints a version.

2. **Query files in place and inspect the schema.**

   ```sql
   DESCRIBE SELECT * FROM 'data/orders/*.parquet';
   SUMMARIZE SELECT * FROM read_csv('raw/orders.csv');        -- min, max, nulls, approx distinct per column
   SELECT * FROM read_parquet('data/events/*/*.parquet', hive_partitioning = true) LIMIT 5;
   ```

   **Check:** Column types are what you expect; fix CSV detection with explicit options (`delim`, `header`, `dateformat`, `types`) if not.

3. **Materialize when you will reuse data.** `CREATE TABLE orders AS SELECT * FROM read_csv('raw/orders.csv');` Native tables are faster than re-parsing CSV each time; Parquet can usually stay external.

   **Check:** Repeated queries no longer re-read the raw CSV.

4. **Analyse with friendly SQL** (table below), and check heavy queries with `EXPLAIN ANALYZE`.

   **Check:** Results are reproducible from a saved `.sql` file or notebook cell, not only from interactive history.

5. **Export results.**

   ```sql
   COPY (SELECT * FROM orders WHERE status = 'paid')
     TO 'out/paid_orders.parquet' (FORMAT parquet, COMPRESSION zstd);
   COPY orders TO 'out/orders' (FORMAT parquet, PARTITION_BY (order_year));
   COPY (SELECT region, sum(amount) AS revenue FROM orders GROUP BY ALL) TO 'out/revenue.csv' (HEADER, DELIMITER ',');
   ```

   Exporting over existing files or into shared buckets should be confirmed with the user first.

   **Check:** Re-reading the exported file returns the same row count and types.

## Reference

### Friendly SQL

| Feature | Example |
| :--- | :--- |
| Query a file as a table | `SELECT count(*) FROM 'logs/*.json'` |
| `FROM`-first | `FROM orders WHERE amount > 100` |
| Group or order by every non-aggregate | `GROUP BY ALL`, `ORDER BY ALL` |
| Drop or rename columns from `*` | `SELECT * EXCLUDE (payload)`, `SELECT * REPLACE (lower(email) AS email)` |
| Columns by pattern | `SELECT COLUMNS('amount_.*') FROM t` |
| Filter on window results | `QUALIFY row_number() OVER (PARTITION BY id ORDER BY ts DESC) = 1` |
| Reshape | `PIVOT orders ON status USING sum(amount) GROUP BY region` |
| Mismatched file schemas | `read_parquet('a/*.parquet', union_by_name = true)` |

### Python API

```python
import duckdb

con = duckdb.connect("analytics.duckdb")            # or duckdb.connect() for in-memory
top = con.sql("""
    SELECT customer_id, sum(amount) AS total
    FROM read_parquet('data/orders/*.parquet')
    GROUP BY ALL ORDER BY total DESC LIMIT 20
""").df()                                           # .pl() for Polars

recent = con.execute("SELECT * FROM orders WHERE created_at >= ?", ["2026-11-01"]).df()  # parameters, not f-strings
```

DuckDB can query a pandas or Polars DataFrame in scope by its variable name (`con.sql("SELECT * FROM df")`), which avoids copying data into a table.

### Remote files and other databases

- Cloud Storage and S3 use the `httpfs` extension (auto-loaded in recent versions). Create a secret with `CREATE SECRET` (for Cloud Storage, HMAC keys with `TYPE gcs`). Build the statement from environment variables at runtime and never commit keys in `.sql` files.
- `ATTACH 'dbname=shop host=localhost user=readonly' AS pg (TYPE postgres, READ_ONLY);` lets you join a PostgreSQL database with local files. Point it at a replica or a read-only role, never a busy primary with a write role.
- Spreadsheet files need an extension (for example the `excel` extension for `.xlsx`); check the current extension list.

### Resources

| Setting | Use |
| :--- | :--- |
| `SET memory_limit = '8GB';` | Cap memory; DuckDB spills larger operations to disk |
| `SET threads = 4;` | Leave cores for other work |
| `SET temp_directory = 'tmp/';` | Put spill files on a fast disk with space |
| `SET preserve_insertion_order = false;` | Lower memory for large exports when row order does not matter |

One process may open a database file for writing; others can open it read-only. For shared team access, publish Parquet files or load the results into BigQuery.

### Shell notes

PowerShell treats `$` and quotes differently: wrap SQL in single quotes (`duckdb -c 'SELECT 42'`) and double any embedded single quotes, or put SQL in a file and pipe it in: `duckdb analytics.duckdb < query.sql` in bash, `Get-Content query.sql | duckdb analytics.duckdb` in PowerShell. A file avoids quoting issues in every shell.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Load everything into pandas first | Query files with DuckDB, return only results | pandas holds all rows in memory and is slower to aggregate |
| Re-parse large CSVs in every query | Convert once to Parquet or a DuckDB table | CSV parsing dominates runtime |
| f-string user values into SQL | `execute(sql, params)` | Injection and quoting bugs |
| Use DuckDB as a multi-writer app database | PostgreSQL or a managed database | Single-writer file locking |
| Hard-code cloud keys in notebooks | Secrets built from environment variables at runtime | Notebooks get shared and committed |
| Trust CSV type detection blindly | `DESCRIBE`, then explicit types | Mis-detected dates and IDs corrupt results |

## Verification checklist

- [ ] Inputs were inspected with `DESCRIBE` or `SUMMARIZE` and types are correct.
- [ ] Analysis lives in saved SQL or notebook cells that re-run cleanly.
- [ ] Parameters are bound, not interpolated.
- [ ] Memory and thread limits are set for large jobs.
- [ ] Exports were re-read and checked for row counts and types.
- [ ] No credentials appear in committed SQL, notebooks or scripts.

## Related

- Knowledge: `bigquery`, `exploratory-data-analysis`, `jupyter-notebooks`, `data-quality`, `pyspark`, `data-visualization`.
- Agents: `data-analyst`, `data-engineer`.
