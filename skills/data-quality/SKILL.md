---
name: data-quality
description: >-
  Puts data quality controls into pipelines and warehouses: quality
  dimensions, validation with pandera, Great Expectations, Soda and dbt tests,
  producer-consumer data contracts, write-audit-publish and quarantine
  patterns, freshness, volume and schema-drift monitoring, and lineage with
  OpenLineage and Dataplex. Use when bad data reached a dashboard or model,
  when defining a data contract, or when adding validation or monitoring to a pipeline.
---

# Data Quality

Bad data is a production incident that nobody pages for. Decide which checks
block publication and which only warn, put the blocking ones between "loaded"
and "published", and monitor freshness and volume so silent failures become
loud ones.

## When to use

- A dashboard, ML feature or report showed wrong, missing or duplicated numbers.
- A new pipeline or dataset needs validation before others depend on it.
- Two teams need a written agreement about a dataset's schema, semantics and freshness.
- You need to know which downstream assets a broken table affects.

## When not to use

- dbt test syntax and project structure: use `dbt`.
- Pipeline orchestration and idempotent loading: use `etl-pipelines`.
- API request and response contracts between services: use `contract-testing`.
- One-off profiling of a new dataset: use `exploratory-data-analysis`.

## Workflow

1. **Profile and pick the critical assets.** Start with the tables behind revenue, billing, compliance or ML features. Profile them (null rates, distinct counts, ranges, row counts per day) to learn normal behaviour.

   **Check:** A short list of critical tables exists, each with an owner and consumers.

2. **Write expectations per quality dimension** (table below). Translate each business rule into a check with a severity: `block` (stop publishing) or `warn` (alert, keep publishing).

   **Check:** Every check has a severity, an owner, and a reason a person could act on.

3. **Validate at the right points.** Source boundary (schema and types on ingest), after transformation (business rules), and before publish (reconciliation against the source).

   **Check:** A malformed sample file is rejected at ingest with a readable error.

4. **Publish through a gate.** Write-audit-publish: write to a staging table or branch, run blocking checks, then swap or merge into the published table. Route rejected rows to a quarantine table with the failure reason instead of dropping them.

   **Check:** A failing blocking check leaves yesterday's published data untouched.

5. **Monitor continuously.** Freshness (latest timestamp versus SLA), volume (row count versus a trailing baseline), schema changes, and distribution drift on key columns. Alert the owning team's channel with a link to the failing check.

   **Check:** Stopping an upstream load triggers a freshness alert within the SLA.

6. **Capture lineage** so an incident can answer "what is affected?" in minutes: OpenLineage events from Airflow, Spark or dbt, Dataplex data lineage on Google Cloud, or dbt docs for in-warehouse graphs.

   **Check:** For a critical table, you can list its upstream sources and downstream dashboards.

## Reference

### Quality dimensions

| Dimension | Example check |
| :--- | :--- |
| Completeness | `customer_id` not null; every day has rows |
| Uniqueness | `order_id` unique; no duplicate events per `event_id` |
| Validity | `status` in an allowed set; `amount >= 0`; email matches a pattern |
| Consistency | Order total equals the sum of its line items; foreign keys resolve |
| Timeliness | Latest `loaded_at` within 2 hours |
| Accuracy | Daily revenue reconciles with the billing system within 0.1% |
| Volume | Row count within an expected band of the trailing 4-week same-weekday average |

### Tool choice

| Tool | Fits |
| :--- | :--- |
| dbt tests and contracts | Rules on warehouse models, run in the same DAG |
| pandera | DataFrame validation in Python code, pipelines and tests |
| Great Expectations (GX) | Expectation suites, checkpoints and data docs across many sources; its API changed substantially in 1.x, so follow the docs for your version |
| Soda Core | YAML checks (SodaCL) run by CLI: `soda scan -d <datasource> -c configuration.yml checks.yml` |
| Dataplex data quality | Managed rules and scans on BigQuery tables |
| Data contract specs (for example the open Data Contract Specification and its CLI) | Contract files in the producer repo, tested in CI |

### pandera example

```python
import pandera.pandas as pa  # older pandera releases: import pandera as pa
from pandera.typing import Series

class Orders(pa.DataFrameModel):
    order_id: Series[str] = pa.Field(unique=True)
    amount: Series[float] = pa.Field(ge=0)
    status: Series[str] = pa.Field(isin=["paid", "refunded", "void"])

    class Config:
        strict = True   # unexpected columns fail
        coerce = True

validated = Orders.validate(df, lazy=True)  # lazy=True reports every failure at once (SchemaErrors)
```

### Data contract contents

1. Schema: columns, types, nullability, keys.
2. Semantics: definitions of each business field and its unit.
3. Quality rules with severities.
4. Freshness and availability SLA.
5. Ownership, support channel, and change policy: additive changes allowed; breaking changes need a new version and a deprecation window agreed with consumers.

Producers run the contract tests in their own CI, so breaking changes fail before release rather than in the consumer's pipeline.

### Severity and routing

| Severity | Action |
| :--- | :--- |
| Block | Stop publish, page or alert the producer, keep last good data |
| Warn | Publish, open a ticket, alert the owner channel |
| Info | Record in metrics for trend analysis only |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Hundreds of auto-generated checks nobody owns | Few checks on critical assets, each with an owner | Alert fatigue makes every alert ignorable |
| Validate only after publishing | Write-audit-publish gate | Consumers see bad data before the alert fires |
| Drop invalid rows silently | Quarantine with reasons and counts | Silent loss biases every downstream number |
| Fixed row-count thresholds | Seasonality-aware baselines | Weekends and holidays trigger false alarms |
| Contracts in a wiki | Contract files in the producer's repo, enforced in CI | Wikis drift; CI does not |
| Treat a schema change as a consumer problem | Version and announce breaking changes | Consumers learn about breaks from broken dashboards |

## Verification checklist

- [ ] Critical assets are listed with owners and consumers.
- [ ] Each check has a dimension, a severity and an actionable message.
- [ ] Blocking checks run before publish, and failures keep the last good data.
- [ ] Rejected rows land in quarantine with reasons.
- [ ] Freshness, volume and schema-change monitors alert the owning team.
- [ ] Lineage answers upstream and downstream questions for critical tables.

## Related

- Knowledge: `dbt`, `etl-pipelines`, `contract-testing`, `exploratory-data-analysis`, `stream-processing`, `observability-otel`, `bigquery`.
- Agents: `data-engineer`, `data-analyst`.
