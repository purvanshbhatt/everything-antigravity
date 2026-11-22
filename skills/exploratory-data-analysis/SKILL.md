---
name: exploratory-data-analysis
description: >-
  Runs exploratory data analysis on a new dataset: framing questions,
  profiling schema and types, missing values, duplicates, distributions,
  outliers, relationships and correlations, time patterns and leakage
  signals, with pandas, Polars, DuckDB or BigQuery, then reports findings with
  clear charts and caveats. Use when the user shares a dataset, asks "what's
  in this data", or before modeling, forecasting or building a dashboard.
---

# Exploratory Data Analysis

EDA answers two questions: can this data support the question being asked,
and what surprises does it hold? Work from written questions, check data
quality before hunting for patterns, and finish with a one-page findings
document rather than a pile of charts.

## When to use

- The user shares a CSV, Parquet file, table or export and asks what is in it.
- Before modeling (`ml-evaluation`), forecasting (`time-series-forecasting`) or a dashboard.
- Numbers in a report look wrong and the data needs a sanity check.

## When not to use

- Formal hypothesis tests and model comparisons: `ml-evaluation`, `ab-testing`.
- Building dashboards: `data-visualization`. Presenting a narrative: `data-storytelling`.
- Ongoing validation rules and data contracts: `data-quality`. Warehouse SQL tuning: `bigquery`, `duckdb-analytics`.

## Workflow

1. **Frame the questions.** Write three to five questions, what one row represents, the time range, and how the data was collected (sampling, logging changes, known definition changes). Put them at the top of the notebook or document.

   **Check:** you can state in one sentence what a single row means.

2. **Load safely and look at raw rows.** For large files, query in place with DuckDB; for BigQuery, sample and dry-run first.

   ```python
   import duckdb
   con = duckdb.connect()
   print(con.sql("SUMMARIZE SELECT * FROM 'data/*.parquet'").df())   # types, nulls, min/max, quantiles
   df = con.sql("SELECT * FROM 'data/*.parquet' USING SAMPLE 100000 ROWS").df()
   print(df.sample(10, random_state=0))
   ```

   ```bash
   bq query --dry_run --use_legacy_sql=false 'SELECT * FROM `proj.ds.orders` TABLESAMPLE SYSTEM (1 PERCENT)'
   ```

   Do not paste raw rows containing personal data into chats, prompts or reports; aggregate or mask them (`gdpr-privacy`).

   **Check:** row and column counts are recorded, and ten random raw rows were read.

3. **Profile structure and quality.**

   ```python
   df.info(memory_usage="deep")
   print(df.describe(include="all").T)
   print(df.isna().mean().sort_values(ascending=False).head(20))
   print(df.duplicated().sum(), df["order_id"].is_unique)
   ```

   Look for wrong types (numbers or dates stored as text), sentinel values (`-1`, `999`, `"N/A"`, `1970-01-01`), mixed units or currencies, impossible values, constant columns, very high-cardinality categoricals, and missingness that clusters by source or time. For a quick automated pass on a sample: `ProfileReport(df, minimal=True).to_file("profile.html")` from `ydata-profiling`.

   **Check:** a data-quality issue list with counts exists, each issue with a suspected cause.

4. **Study each key column.** Numeric: histogram and ECDF, log scale for heavy tails, quantiles p1, p50 and p99. Categorical: top values plus the share of "other". Time: counts per day or week to expose logging gaps, launches and seasonality.

   **Check:** each key column has a one-line description of its distribution.

5. **Investigate outliers before acting.** Flag with IQR fences or a robust z-score (median and MAD), then decide case by case: data error, or a genuine extreme that matters. Never drop rows silently; record the rule and the count.

   **Check:** every outlier decision is logged with its row count.

6. **Explore relationships.** Numeric pairs: scatter with transparency or hexbin, and Spearman for monotonic trends. Category versus numeric: box or violin plots annotated with group sizes. Category pairs: `pd.crosstab(a, b, normalize="index")`. Check every key relationship within segments to catch Simpson's paradox. Against a prediction target, treat near-perfect predictors as leakage suspects (features recorded after the outcome).

   **Check:** the top relationships are listed with sample sizes and the caveat that correlation is not causation.

7. **Report findings.** One page: each question, its answer, the supporting chart or number, and confidence and caveats; then data-quality issues with owners, and next steps (clean, collect, model, dashboard). Charts carry a takeaway title, labeled axes with units, sorted bars, and no 3D or crowded pies. Save the report as an artifact for the user to review.

   **Check:** every claim in the report points to a chart or a number.

## Patterns

### Quick checks

| Question | pandas | DuckDB SQL |
| :--- | :--- | :--- |
| Nulls per column | `df.isna().mean()` | `SUMMARIZE tbl` (null percentage column) |
| Duplicate keys | `df["id"].duplicated().sum()` | `SELECT id, COUNT(*) c FROM tbl GROUP BY id HAVING c > 1` |
| Rows per day | `df.set_index("ts").resample("D").size()` | `SELECT date_trunc('day', ts) d, COUNT(*) FROM tbl GROUP BY d ORDER BY d` |
| Top categories | `df["country"].value_counts(normalize=True).head(10)` | `SELECT country, COUNT(*) FROM tbl GROUP BY 1 ORDER BY 2 DESC LIMIT 10` |
| Robust outliers | `(x - x.median()).abs() / (1.4826 * (x - x.median()).abs().median()) > 3.5` | Same logic with `median()` and `quantile_cont` |

Polars equivalents: `df.null_count()`, `df.describe()`, `df["country"].value_counts()`.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Chart everything first | Check quality and meaning of a row first | Patterns in broken data are artifacts |
| Drop nulls or outliers silently | Log the rule and the counts | Hidden choices change conclusions |
| Trust column names | Verify definitions with the data owner | `revenue` may be gross, net or booked |
| Report correlations as causes | State them as associations with caveats | Confounders are everywhere |
| Analyze only the aggregate | Check within key segments | Simpson's paradox reverses trends |
| Paste raw personal data into prompts | Aggregate or mask first | Privacy exposure |

## Verification checklist

- [ ] Questions and the meaning of a row are written down.
- [ ] Raw rows were read; data-quality issues are listed with counts.
- [ ] Key columns and relationships are described with sample sizes.
- [ ] Outlier and cleaning decisions are logged.
- [ ] The findings page cites a chart or number for each claim and lists caveats.
- [ ] No personal data left the approved environment.

## Related

- Knowledge: `jupyter-notebooks`, `duckdb-analytics`, `bigquery`, `data-quality`, `data-visualization`, `data-storytelling`, `ml-evaluation`, `time-series-forecasting`, `gdpr-privacy`.
- Agents: `data-analyst`, `data-engineer`.
