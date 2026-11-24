---
name: data-warehouse-modeling
disable-model-invocation: true
description: >-
  Models analytical data for warehouses such as BigQuery: Kimball star
  schemas, choosing the grain, fact table types, conformed and role-playing
  dimensions, surrogate keys, slowly changing dimensions (types 1, 2 and
  others) with point-in-time joins, wide denormalized tables versus stars, and
  semantic layers that define metrics once. Use when designing marts, facts or
  dimensions, handling history, or when teams disagree on metric definitions.
---

# Data Warehouse Modeling

Start every table with its grain: one sentence that says what one row means.
Facts record measurable events at that grain, dimensions describe them, and
metrics are defined once in a semantic layer so every dashboard agrees.

## When to use

- Designing marts for analytics, BI or ML features.
- Deciding whether to track history for an attribute, and how.
- Two dashboards show different numbers for the "same" metric.
- Choosing between a star schema and one big denormalized table on BigQuery.

## When not to use

- Writing the dbt models, tests and snapshots themselves: use `dbt`.
- Partitioning, clustering and cost tuning: use `bigquery`.
- OLTP schema design for an application: use `database-design`.
- Event tracking plans and product metrics: use `product-analytics`.

## Workflow

1. **List business processes and questions.** For example: orders placed, payments captured, subscriptions changed. Note the questions each must answer and who asks them.

   **Check:** Each process has an owner and three or more real questions.

2. **Declare the grain for each fact table** in one sentence: "one row per order line per order", "one row per account per day".

   **Check:** You can name the unique key that enforces the grain, and a test asserts it.

3. **Identify dimensions** (who, what, where, when, how) and conform shared ones across facts: one `dim_customer`, one `dim_date`, one `dim_product`. Record the conformed dimensions in a bus matrix (processes as rows, dimensions as columns).

   **Check:** Facts that share a dimension use the same table and key.

4. **Decide history per attribute** using the SCD table below. Default to type 1 (overwrite) unless someone needs "as it was at the time".

   **Check:** Every type 2 attribute has a stated question that needs history.

5. **Define measures and metrics.** Mark each measure additive, semi-additive (balances: do not sum across time) or non-additive (ratios: recompute from components). Put metric definitions in a semantic layer (dbt Semantic Layer with MetricFlow, Looker LookML, or similar).

   **Check:** Revenue, active users and other headline metrics each have exactly one definition with an owner.

6. **Review the model** with consumers using a few sample queries before building, and document grain, keys and SCD policy in the model docs.

   **Check:** Sample business questions are answerable with straightforward joins and no `DISTINCT` workarounds.

## Reference

### Fact table types

| Type | Grain | Example |
| :--- | :--- | :--- |
| Transaction | One row per event | `fct_order_lines` |
| Periodic snapshot | One row per entity per period | `fct_account_balance_daily` |
| Accumulating snapshot | One row per process instance, updated as milestones occur | `fct_order_fulfilment` (placed, paid, shipped dates) |
| Factless | Records that something happened or applied, no measures | `fct_student_attendance`, promotion coverage |

### Dimension techniques

| Technique | Use |
| :--- | :--- |
| Surrogate key | Stable key independent of source IDs; hash of natural key (and validity start for type 2), for example `dbt_utils.generate_surrogate_key` |
| Unknown member | A `-1` or "unknown" row so facts with missing references still join |
| Role-playing | One `dim_date` joined as order date, ship date, due date |
| Degenerate | Order number kept on the fact, no dimension table |
| Junk | Low-cardinality flags combined into one small dimension |
| Bridge | Many-to-many (accounts with several owners) with allocation weights |

### Slowly changing dimensions

| Type | Behaviour | When |
| :--- | :--- | :--- |
| 0 | Never changes | Original signup channel |
| 1 | Overwrite | Corrections, attributes nobody analyses historically |
| 2 | New row per change with `valid_from`, `valid_to`, `is_current` | "Revenue by the customer's region at the time of order" |
| 3 | Previous value column | One prior value is enough (old and new territory) |
| 6 | Type 1 plus 2 plus 3 combined | Both current and historical views from one table |

Point-in-time join for type 2:

```sql
SELECT f.order_id, f.amount, c.region
FROM fct_orders f
JOIN dim_customer_history c
  ON c.customer_id = f.customer_id
 AND f.ordered_at >= c.valid_from
 AND f.ordered_at <  COALESCE(c.valid_to, TIMESTAMP '9999-12-31')
```

Alternatively, resolve the type 2 surrogate key during the fact load and store it on the fact, which makes queries simple joins.

dbt snapshots produce type 2 history from mutable sources (dbt 1.9+ YAML form shown; older versions use a Jinja snapshot block):

```yaml
snapshots:
  - name: customers_snapshot
    relation: source('crm', 'customers')
    config:
      unique_key: customer_id
      strategy: timestamp
      updated_at: updated_at
```

### Star schema or one big table

| Choose | When |
| :--- | :--- |
| Star (facts plus conformed dimensions) | Many facts share dimensions; type 2 history; governed metrics |
| One big table (wide, nested `STRUCT`/`ARRAY` on BigQuery) | One dominant use case, BI tool performance, analysts who avoid joins |
| Both | Star as the governed core, wide tables derived from it for specific dashboards |

Build wide tables from the star, never the other way round, so definitions stay in one place.

### Late-arriving data

- Late facts: load into the correct partition and reprocess a lookback window.
- Late dimensions (fact references a customer not yet loaded): insert an inferred member row with the natural key and fill attributes when the dimension arrives.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Mixed grain in one fact table | One grain per fact | Sums double-count or undercount |
| Sum balances or ratios across time | Mark semi-additive and non-additive measures | Totals become meaningless |
| Type 2 everything | Type 2 only where a question needs history | Tables bloat and joins get slower and harder |
| Each team builds its own customer dimension | Conformed dimensions | Numbers disagree across dashboards |
| Metric logic copied into every dashboard | Semantic layer definitions | Definitions drift silently |
| Use source natural keys as the only join key across systems | Surrogate keys plus key mapping | Source IDs collide, change or get reused |

## Verification checklist

- [ ] Each fact table has a one-sentence grain and a uniqueness test.
- [ ] Shared dimensions are conformed and recorded in a bus matrix.
- [ ] SCD type is chosen per attribute with a stated reason.
- [ ] Measures are labelled additive, semi-additive or non-additive.
- [ ] Headline metrics have one definition in a semantic layer, with owners.
- [ ] Unknown members and late-arriving data are handled.

## Related

- Knowledge: `dbt`, `bigquery`, `etl-pipelines`, `data-quality`, `product-analytics`, `data-visualization`, `database-design`.
- Agents: `data-engineer`, `data-analyst`.
