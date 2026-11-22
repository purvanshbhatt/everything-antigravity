---
name: bigquery
description: >-
  Builds cost-aware BigQuery datasets and queries: partitioning and clustering,
  dry runs and maximum-bytes-billed guards, on-demand versus capacity pricing,
  SQL patterns (QUALIFY dedupe, MERGE upserts, nested STRUCT/ARRAY), loading,
  scheduled queries, row-level and column-level security, and BI integration
  with Looker Studio and Connected Sheets. Use when creating BigQuery
  tables, writing or reviewing BigQuery SQL, or cutting BigQuery spend.
---

# BigQuery

BigQuery is a columnar warehouse billed by bytes scanned (on-demand) or by
slots (capacity). Every table design and query choice is a cost decision:
partition and cluster for your filters, select only the columns you need, and
dry-run anything big before it runs.

## When to use

- Creating tables, datasets, scheduled queries or materialized views.
- Writing analytical SQL, dedupe or upsert logic, or nested-data queries.
- A query is slow or expensive, or the monthly bill jumped.
- Wiring dashboards to BigQuery.

## When not to use

- Dimensional modelling decisions (grain, SCDs, conformed dimensions): use `data-warehouse-modeling`.
- Transformation projects with tests and lineage: use `dbt`.
- Pipeline orchestration and incremental loads: use `etl-pipelines`.
- Local analysis of files without a warehouse: use `duckdb-analytics`.

## Workflow

1. **Design the table around its filters.** Partition by the date or timestamp column most queries filter on, cluster by up to four columns used in filters or joins (most selective first), and require a partition filter on large tables.

   ```sql
   CREATE TABLE analytics.events (
     event_ts TIMESTAMP NOT NULL, user_id STRING, event_name STRING, props JSON)
   PARTITION BY DATE(event_ts)
   CLUSTER BY user_id, event_name
   OPTIONS (require_partition_filter = TRUE, partition_expiration_days = 400);
   ```

   **Check:** A query filtered on one day of `event_ts` dry-runs to a small fraction of the table size.

2. **Dry-run before running.**

   ```bash
   bq query --use_legacy_sql=false --dry_run 'SELECT user_id FROM analytics.events WHERE DATE(event_ts) = "2026-11-01"'
   bq query --use_legacy_sql=false --maximum_bytes_billed=10000000000 '<sql>'
   ```

   Set `maximum_bytes_billed` in client libraries and BI tools too, so a runaway query fails instead of billing.

   **Check:** Bytes processed match expectations; queries over the cap fail rather than run.

3. **Write the SQL with the patterns below**, then check the execution graph in the console for skewed stages, large shuffles or repartitioning.

   **Check:** No stage dominates slot time because of one hot key or an exploding join.

4. **Find what costs money** using the jobs views.

   ```sql
   SELECT user_email, ROUND(SUM(total_bytes_billed) / POW(1024, 4), 2) AS tib_billed,
          ROUND(SUM(total_slot_ms) / 3.6e6, 1) AS slot_hours
   FROM `region-us`.INFORMATION_SCHEMA.JOBS
   WHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY) AND job_type = 'QUERY'
   GROUP BY user_email ORDER BY tib_billed DESC LIMIT 20;
   ```

   **Check:** The top spenders are known and each has a fix (partition filter, clustering, materialization or a cap).

5. **Schedule and secure.** Create scheduled queries or move them into Dataform, dbt or Composer once they have dependencies. Apply row access policies and policy tags before sharing data. Changing pricing models, reservations or dataset deletion needs explicit user confirmation.

   **Check:** Scheduled jobs write idempotently (`WRITE_TRUNCATE` on a partition or `MERGE`) and access is granted to groups, not individuals.

## Patterns

### SQL

```sql
-- Latest version of each row (dedupe)
SELECT * FROM staging.orders
WHERE _ingest_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY)
QUALIFY ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY updated_at DESC) = 1;

-- Idempotent upsert
MERGE warehouse.orders t
USING staging.orders_latest s ON t.order_id = s.order_id
WHEN MATCHED AND s.updated_at > t.updated_at THEN UPDATE SET status = s.status, updated_at = s.updated_at
WHEN NOT MATCHED THEN INSERT ROW;
```

| Need | Use |
| :--- | :--- |
| Nested one-to-many | `ARRAY<STRUCT<...>>` columns, read with `UNNEST` |
| Safe math and casts | `SAFE_DIVIDE`, `SAFE_CAST` |
| Approximate distinct counts | `APPROX_COUNT_DISTINCT` (HyperLogLog++) |
| Exclude a column | `SELECT * EXCEPT (props)` |
| Repeated heavy aggregation | Materialized view, or a scheduled summary table |
| Point-in-time read | `FOR SYSTEM_TIME AS OF` within the time-travel window |
| Many daily tables | One partitioned table, not `_TABLE_SUFFIX` wildcards |

### Cost levers

| Lever | Effect |
| :--- | :--- |
| Partition filter plus `require_partition_filter` | Prunes whole partitions |
| Clustering | Prunes blocks within partitions; reclustering is automatic |
| Column selection | On-demand bills per column scanned; `LIMIT` does not reduce bytes |
| Previews | `bq head` or the console preview reads tables without query cost |
| Capacity (Editions) | Slot reservations with autoscaling for steady heavy workloads; compare against on-demand using `total_slot_ms` |
| Storage | Long-term rate after 90 days unmodified; physical storage billing per dataset can be cheaper for compressible data |
| Quotas | Custom per-user and per-project daily query quotas |

Prices, edition features and quotas change: verify against current docs before quoting numbers.

### Loading and scheduling

- Batch loads from Cloud Storage use a shared free pool: `bq load --source_format=PARQUET analytics.events "gs://<bucket>/events/*.parquet"`. Prefer Parquet or Avro over CSV for types and speed.
- Stream with the Storage Write API rather than legacy streaming inserts.
- Scheduled query whose SQL is an idempotent `MERGE` into a partitioned table (verify flags against current docs):

  ```bash
  bq mk --transfer_config --data_source=scheduled_query \
    --display_name="daily_revenue" --schedule="every 24 hours" \
    --params='{"query":"MERGE reporting.daily_revenue t USING (...) s ON ..."}'
  ```

  In PowerShell, keep the JSON in single quotes and use a backtick instead of `\` for line continuation. Use the `@run_date` or `@run_time` parameter in the SQL so a re-run targets the same day.

### Security and BI

- Grant roles on datasets to groups. Use authorized views or row access policies (`CREATE ROW ACCESS POLICY ... GRANT TO (...) FILTER USING (...)`) for row-level access, and policy tags for column-level masking.
- Looker Studio and Looker query live; set caching and BI Engine reservations for interactive dashboards. Connected Sheets gives spreadsheet users governed access without exports.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `SELECT *` on wide tables | Name columns or `EXCEPT` | You pay for every column scanned |
| Rely on `LIMIT` to cut cost | Filter partitions and select fewer columns | `LIMIT` stops output, not scanning |
| Filter the partition column through UDFs or subqueries | Compare it directly with constants or parameters | Pruning needs a filter the planner can evaluate up front |
| Date-sharded tables `events_20261101` | Partitioned table | Shards multiply metadata and break caching |
| Many single-row `INSERT`s | Batch loads, Storage Write API or `MERGE` | DML per row is slow and quota-bound |
| Share datasets with individual users | Groups plus authorized views or policies | Access becomes unauditable |

## Verification checklist

- [ ] Large tables are partitioned, clustered for their filters, and require a partition filter.
- [ ] Expensive queries were dry-run and run with a bytes-billed cap.
- [ ] Scheduled writes are idempotent (`WRITE_TRUNCATE` per partition or `MERGE`).
- [ ] Top-cost jobs from `INFORMATION_SCHEMA.JOBS` were reviewed.
- [ ] Access goes through groups, authorized views, row policies or policy tags.
- [ ] Pricing-model, reservation or deletion changes were confirmed by the user.

## Related

- Knowledge: `data-warehouse-modeling`, `dbt`, `etl-pipelines`, `sql-optimization`, `finops-cost`, `data-visualization`, `duckdb-analytics`.
- Agents: `data-engineer`, `data-analyst`, `sql-reviewer`.
