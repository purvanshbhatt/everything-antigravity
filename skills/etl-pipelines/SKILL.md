---
name: etl-pipelines
disable-model-invocation: true
description: >-
  Builds batch ETL/ELT pipelines that are safe to rerun: orchestration with
  Airflow or Cloud Composer and Dagster, raw-staging-mart layering, idempotent
  partition overwrites and MERGE loads, incremental loads with watermarks and
  CDC, backfills, retries, and freshness monitoring. Use when designing or
  debugging a data pipeline or DAG, loading data into BigQuery or a warehouse,
  or planning a backfill.
---

# ETL Pipelines

A pipeline is correct when running any task twice, or running last month
again, produces the same tables. Design for reruns first; scheduling,
parallelism and speed come after.

## When to use

- New ingestion from an API, database, files or SaaS tool into a warehouse or lake.
- Writing or reviewing Airflow, Cloud Composer or Dagster code.
- Duplicate rows after a retry, gaps after an outage, or a backfill to plan.
- Choosing between full refresh, incremental, and change data capture.

## When not to use

- SQL transformation layers inside the warehouse: use `dbt`.
- Real-time event processing with windows and watermarks: use `stream-processing`.
- Large distributed transforms on Spark: use `pyspark`.
- Validation rules, contracts and monitoring depth: use `data-quality`.
- Application background work (emails, webhooks): use `background-jobs`.

## Workflow

1. **Write the data contract for each source.** Owner, extraction method, grain, primary key, update semantics (append-only, updated in place, deletes), latency need, and expected volume.

   **Check:** You know how to detect a changed or deleted row in every source.

2. **Choose the load strategy** per table from the matrix below, and land raw data unchanged first (Cloud Storage files or a raw BigQuery dataset) so transforms can be replayed without re-extracting.

   **Check:** Raw data is immutable and partitioned by load date or logical date.

3. **Make every task idempotent.** Tasks process exactly one logical interval taken from the scheduler (`data_interval_start`/`data_interval_end` in Airflow, the partition key in Dagster), never `now()`. Writes overwrite that interval's partition or `MERGE` on a key.

   **Check:** Clearing and rerunning a task for one day leaves row counts unchanged.

4. **Orchestrate** with small atomic tasks, retries with backoff, timeouts, and alerts. Keep heavy work out of the DAG file's top level (the scheduler parses it constantly) and push compute to the warehouse or a job runner instead of the scheduler workers.

   **Check:** The DAG parses fast (`python dags/orders.py` or `airflow dags list-import-errors`), and a deliberately failed task retries and alerts.

5. **Monitor outcomes, not only task status.** Freshness per table, row-count reconciliation against the source, and data tests on the published tables.

   **Check:** An empty extract or a half-loaded day fails loudly instead of publishing.

6. **Backfill deliberately.** Estimate volume and cost, cap concurrency, and run oldest-first. Backfills that overwrite shared or production tables need an implementation-plan artifact and explicit user confirmation.

   **Check:** The user approved; reconciliation matches for the backfilled range.

## Patterns

### Load strategy

| Strategy | Use when | Mechanics |
| :--- | :--- | :--- |
| Full refresh | Small tables (up to a few million rows) or no reliable change marker | Load to a temp table, swap or `WRITE_TRUNCATE` |
| Incremental append | Immutable events with an event time | Overwrite the logical-date partition |
| Incremental upsert | Rows updated in place with a trustworthy `updated_at` | High watermark minus a lookback window, then `MERGE` on the key |
| CDC | Deletes matter, or the source cannot afford heavy queries | Log-based replication, for example Datastream into BigQuery or Debezium into Kafka |

A watermark should come from the target table or a state store, not a variable in the scheduler. Always re-read a lookback window (for example 3 days) to catch late or clock-skewed updates; the `MERGE` makes the overlap harmless.

### Layers

| Layer | Contents | Rule |
| :--- | :--- | :--- |
| Raw (bronze) | Source data as received, plus load metadata | Never edited; replayable |
| Staging (silver) | Typed, renamed, deduplicated, one model per source table | No business logic yet |
| Marts (gold) | Facts, dimensions, aggregates for consumers | Tested and documented |

### Airflow TaskFlow example

```python
from datetime import datetime, timedelta
from airflow.decorators import dag, task  # Airflow 3: from airflow.sdk import dag, task

@dag(schedule="@daily", start_date=datetime(2026, 1, 1), catchup=False, max_active_runs=1,
     default_args={"retries": 3, "retry_delay": timedelta(minutes=5),
                   "retry_exponential_backoff": True, "execution_timeout": timedelta(hours=1)})
def orders_daily():
    @task
    def extract(ds=None) -> str:
        path = f"gs://raw-orders/dt={ds}/"
        export_orders_for_day(ds, path)   # replaces files for exactly one day
        return path

    @task
    def load(path: str, ds=None) -> None:
        overwrite_partition("raw.orders", ds, path)  # WRITE_TRUNCATE on that day's partition

    load(extract())

orders_daily()
```

- Pass only small values (paths, counts) between tasks; keep data in storage.
- Read secrets from a secrets backend (Secret Manager on Composer), never Variables in plain text or code.
- Use deferrable operators or sensors in reschedule mode so waiting does not hold a worker slot.
- Backfill: Airflow 2 `airflow dags backfill -s 2026-01-01 -e 2026-01-31 orders_daily`; Airflow 3 moved backfills to `airflow backfill create` (verify flags for your version and Composer image).

### Dagster

Model tables as software-defined assets with partitions (daily or static), declare dependencies between assets, and attach asset checks for quality. Backfills run per partition from the UI or CLI, and only stale partitions need re-materializing.

### Google Cloud mapping

| Need | Service |
| :--- | :--- |
| Managed Airflow | Cloud Composer |
| Database CDC | Datastream |
| SaaS and Google sources | BigQuery Data Transfer Service |
| SQL transforms in BigQuery | Dataform or dbt |
| Simple service-to-service steps | Workflows plus Cloud Run jobs |
| Big transforms | Dataflow or Serverless for Apache Spark |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `INSERT` appends on every run | Overwrite the interval or `MERGE` | Retries and reruns duplicate rows |
| Use wall-clock `now()` in tasks | Use the scheduler's logical interval | Reruns process the wrong window |
| Transform during extraction | Land raw, transform after | Bugs require re-pulling sources that may have changed |
| Heavy imports or API calls at DAG top level | Do work inside tasks | The scheduler re-parses files every few seconds |
| Pass datasets through XCom | Pass paths or table names | The metadata database is not a data store |
| `catchup=True` by accident on a new DAG | `catchup=False`, then backfill deliberately | Hundreds of runs launch at once |
| Alert only on task failure | Freshness, row counts and tests | Pipelines often "succeed" with empty or partial data |

## Verification checklist

- [ ] Every source has a contract: key, update semantics, deletes, volume.
- [ ] Raw data is landed unchanged and partitioned.
- [ ] Each task processes one logical interval and overwrites or merges idempotently.
- [ ] Rerunning a day leaves counts unchanged (tested).
- [ ] Retries, timeouts, freshness and reconciliation alerts are configured.
- [ ] Backfills over shared tables were estimated and confirmed by the user.

## Related

- Knowledge: `dbt`, `data-quality`, `bigquery`, `stream-processing`, `pyspark`, `data-warehouse-modeling`, `background-jobs`, `observability-otel`.
- Agents: `data-engineer`, `sre-engineer`.
