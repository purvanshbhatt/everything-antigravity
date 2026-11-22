---
name: dbt
description: >-
  Builds and maintains dbt projects: staging, intermediate and mart layers,
  sources with freshness, generic, singular and unit tests, model contracts,
  incremental models and strategies (merge, insert_overwrite, microbatch),
  snapshots, docs, selection syntax, and slim CI with state:modified and defer.
  Use when writing or reviewing dbt models, adding tests, making a model
  incremental, or setting up dbt in CI, including on BigQuery.
---

# dbt

dbt turns warehouse SQL into a tested, documented dependency graph. Keep each
model small and single-purpose, test every primary key, and make CI build only
what changed against production state.

## When to use

- New dbt project, or new sources, models, tests or snapshots.
- A model is slow or expensive and should become incremental.
- Tests are missing, flaky, or too slow to run in CI.
- Setting up pull-request CI or scheduled production runs for dbt.

## When not to use

- Choosing grain, facts, dimensions and SCD types: use `data-warehouse-modeling` first.
- Extraction and loading from sources: use `etl-pipelines`.
- Warehouse-specific tuning (partitioning, slots, cost): use `bigquery` or `sql-optimization`.
- Cross-system contracts and monitoring beyond dbt tests: use `data-quality`.

## Workflow

1. **Check the environment.**

   ```bash
   dbt --version
   dbt debug          # profile, credentials, connection
   dbt deps           # packages from packages.yml / dependencies.yml
   ```

   **Check:** `dbt debug` passes for the target you intend to use (never default to the production target locally).

2. **Declare sources with freshness** before modelling them.

   ```yaml
   sources:
     - name: shop
       schema: raw_shop
       loaded_at_field: _loaded_at
       freshness:
         warn_after: {count: 12, period: hour}
         error_after: {count: 24, period: hour}
       tables:
         - name: orders
   ```

   Newer dbt versions move some properties such as `freshness` under `config:`; verify against current docs for your version.

   **Check:** `dbt source freshness` reports each source.

3. **Model in layers** (table below). Staging models are one-to-one with source tables: rename, cast, dedupe, nothing else. Business logic lives in intermediate and mart models.

   **Check:** No mart selects directly from a source; every model references upstream models with `ref()` or `source()`.

4. **Test as you go.** Every model's primary key gets `unique` and `not_null`. Add `relationships` and `accepted_values` where they encode real rules, unit tests for tricky logic (dbt 1.8+), and contracts on models other teams consume.

   ```yaml
   models:
     - name: fct_orders
       config:
         contract: {enforced: true}
       columns:
         - name: order_id
           data_type: string
           data_tests: [unique, not_null]
         - name: status
           data_type: string
           data_tests:
             - accepted_values: {values: [placed, paid, shipped, returned]}
   ```

   **Check:** `dbt build --select fct_orders+` passes, and a deliberately broken row makes a test fail.

5. **Make big models incremental** only when a full rebuild is too slow or expensive (pattern below).

   **Check:** The incremental result equals a `--full-refresh` result on a sample date range.

6. **Wire CI and production.** Pull requests build only modified models and their children, deferring unchanged parents to production artifacts. Production runs use `dbt build` on a schedule (dbt platform jobs, Composer, Cloud Run jobs or GitHub Actions). Running `--full-refresh` against production models requires explicit user confirmation.

   ```bash
   dbt build --select state:modified+ --defer --state ./prod-artifacts --target ci
   dbt retry          # re-run only what failed in the last invocation
   ```

   **Check:** CI writes to an isolated schema per pull request and drops it afterwards.

## Patterns

### Layers and naming

| Layer | Prefix | Materialization | Purpose |
| :--- | :--- | :--- | :--- |
| Staging | `stg_<source>__<table>` | view | Clean one source table |
| Intermediate | `int_<entity>_<verb>` | ephemeral or view | Reusable joins and logic |
| Marts | `fct_<process>`, `dim_<entity>` | table or incremental | Consumer-facing |

### Incremental model on BigQuery

```sql
{{ config(
    materialized='incremental',
    incremental_strategy='insert_overwrite',
    partition_by={'field': 'event_date', 'data_type': 'date'},
    cluster_by=['user_id'],
    on_schema_change='append_new_columns'
) }}
select event_date, user_id, count(*) as events
from {{ ref('stg_app__events') }}
{% if is_incremental() %}
where event_date >= date_sub(current_date(), interval 3 day)
{% endif %}
group by 1, 2
```

| Strategy | Use when |
| :--- | :--- |
| `merge` with `unique_key` | Rows update in place |
| `insert_overwrite` | Partitioned facts; rebuild recent partitions completely |
| `delete+insert` | Adapter lacks efficient merge |
| `microbatch` (1.9+) | Large time-series; dbt processes and retries per batch |
| `append` | Immutable events with no reprocessing |

Always reprocess a lookback window for late data, and run a periodic full refresh if drift is possible.

### Snapshots

Use snapshots to keep history of mutable source rows (type 2 slowly changing dimensions). Prefer `strategy: timestamp` with a trustworthy `updated_at`; use `check` on specific columns otherwise. dbt 1.9+ supports YAML-defined snapshots; older projects use Jinja `{% snapshot %}` blocks.

### Selection cheat sheet

| Selector | Meaning |
| :--- | :--- |
| `-s model+` / `+model` | Model plus children / parents |
| `-s tag:finance` | Tagged models |
| `-s path:models/marts` | Directory |
| `-s state:modified+` | Changed since the state artifacts, plus children |
| `--exclude` | Remove from the selection |
| `--empty` (1.8+) | Build with zero rows to check SQL and schema cheaply |

### Docs and lint

Describe every mart and its columns in YAML; `dbt docs generate` builds the catalog and lineage graph. Lint SQL with SQLFluff using the dbt templater, and format consistently.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Hard-code `project.dataset.table` | `ref()` and `source()` | Lineage, environments and CI deferral break |
| Business logic in staging models | Keep staging to rename, cast, dedupe | Logic gets duplicated across marts |
| Incremental by default | Table first; incremental when measured | Incremental logic adds drift and edge cases |
| `is_incremental()` filter with no lookback | Reprocess a window | Late-arriving rows are lost forever |
| Run the full project in every pull request | `state:modified+` with `--defer` | Slow, costly CI that people learn to skip |
| Tests only on marts | Primary-key tests on every model | Fan-out bugs start upstream |
| `--full-refresh` in production casually | Confirm, schedule and estimate cost first | Rebuilds can cost a lot and drop history in non-snapshot tables |

## Verification checklist

- [ ] Sources declare freshness, and `dbt source freshness` passes.
- [ ] Every model has `unique` and `not_null` on its primary key.
- [ ] Consumer-facing models have contracts and documentation.
- [ ] Incremental models reprocess a lookback window and match a full refresh on a sample.
- [ ] CI builds only modified models into an isolated schema with deferral.
- [ ] Production full refreshes were confirmed by the user.

## Related

- Knowledge: `data-warehouse-modeling`, `bigquery`, `data-quality`, `etl-pipelines`, `sql-optimization`, `ci-cd-github-actions`, `linting-formatting`.
- Agents: `data-engineer`, `sql-reviewer`, `data-analyst`.
