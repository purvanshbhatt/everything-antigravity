---
name: pyspark
description: >-
  Writes and tunes PySpark jobs on Dataproc, Serverless for Apache Spark or
  any Spark cluster: DataFrame API idioms, lazy evaluation, partitioning and
  shuffles, join strategies and skew handling with AQE and salting, Python UDF
  costs versus built-ins and pandas UDFs, caching, file layout, the BigQuery
  connector, and pytest testing. Use when writing Spark code, a Spark job is
  slow or runs out of memory, or Spark code needs tests.
---

# PySpark

Spark is fast when work stays in the JVM, data moves across the network as
little as possible, and partitions are evenly sized. Most slow jobs come from
Python UDFs, skewed keys, too many or too few partitions, or repeated
recomputation of the same lineage.

## When to use

- Transforms too large for one machine (hundreds of GB and up) on Dataproc or Serverless for Apache Spark.
- A Spark stage is slow, spills, or fails with executor out-of-memory errors.
- Replacing Python UDFs, fixing skewed joins, or reducing small files.
- Adding unit tests for Spark transformations.

## When not to use

- Data that fits on one machine: use `duckdb-analytics` or pandas/Polars; Spark overhead dominates.
- SQL transforms that can run inside BigQuery: use `bigquery` and `dbt`.
- Event-time streaming with watermarks on Dataflow or Flink: use `stream-processing`.
- Orchestration, scheduling and backfills: use `etl-pipelines`.

## Workflow

1. **Structure the job as pure transforms.** Read, then a chain of functions `DataFrame -> DataFrame`, then write. Keep I/O at the edges so transforms are testable.

   ```python
   from pyspark.sql import DataFrame, functions as F

   def daily_revenue(orders: DataFrame) -> DataFrame:
       return (orders.where(F.col("status") == "paid")
               .groupBy(F.to_date("paid_at").alias("day"))
               .agg(F.sum("amount").alias("revenue")))
   ```

   **Check:** Each transform can run on a tiny in-memory DataFrame in a unit test.

2. **Use built-in functions before UDFs.** `pyspark.sql.functions` covers dates, strings, JSON, arrays, maps and windows. If Python is unavoidable, use a vectorized pandas UDF (`@pandas_udf`) or, on Spark 3.5+, an Arrow-optimized UDF (`useArrow=True`).

   **Check:** `grep_search` for `@udf` / `F.udf` shows none on hot paths, or each has a written reason.

3. **Read the physical plan before running at scale.** `df.explain(mode="formatted")`. Look for `Exchange` (shuffle), the join type (`BroadcastHashJoin` versus `SortMergeJoin`), and whether filters and column pruning are pushed into the file scan.

   **Check:** Filters appear as `PushedFilters` on Parquet/ORC scans, and only needed columns are read.

4. **Run on a sample, then read the Spark UI.** On the Stages tab, compare max and median task duration (skew), shuffle read and write size, and spill. Dataproc exposes the Spark UI and history server through the console.

   **Check:** No stage has tasks running far longer than the median, and spill is zero or explained.

5. **Tune the specific problem** using the tables below, one change at a time, re-reading the UI each time.

   **Check:** Wall time and cost per run improved on the same input.

6. **Write output in a reader-friendly layout.** Partition by low-cardinality columns readers filter on (`partitionBy("dt")`), target files of roughly 128 MB to 1 GB, and overwrite partitions idempotently. Overwriting shared production paths or tables needs explicit user confirmation.

   **Check:** A rerun of the same date produces the same files and row counts, without leftovers.

## Reference

### Partitions and shuffles

| Setting or call | Guidance |
| :--- | :--- |
| `spark.sql.shuffle.partitions` | Default 200. Adaptive Query Execution (on by default since Spark 3.2) coalesces small shuffle partitions; raise the initial number for very large shuffles |
| `repartition(n, col)` | Full shuffle; use to spread data before a heavy stage or to co-locate keys |
| `coalesce(n)` | Merges partitions without a full shuffle; use to reduce output files |
| `spark.sql.sources.partitionOverwriteMode=dynamic` | Overwrite only the partitions present in the output |

### Joins and skew

| Situation | Fix |
| :--- | :--- |
| One side is small (tens to a few hundred MB) | `big.join(F.broadcast(small), "key")`; the automatic threshold `spark.sql.autoBroadcastJoinThreshold` defaults to 10 MB |
| Skewed key in a sort-merge join | Rely on AQE skew-join handling (`spark.sql.adaptive.skewJoin.enabled`), then salting if still skewed |
| Null or default keys dominate | Filter them out or handle them separately before the join |
| Same large join repeated in several jobs | Bucket or pre-partition both sides on the key |

Salting: add a random salt `0..N-1` to the skewed side, replicate the other side N times with each salt value, and join on `(key, salt)`.

### Caching and actions

- `cache()` or `persist()` only a DataFrame reused by two or more actions, and `unpersist()` after use.
- Each action (`count`, `collect`, `write`) recomputes lineage unless cached. Avoid "debug" `count()` calls in production code.
- Never `collect()` or `toPandas()` an unbounded DataFrame; aggregate or `limit` first.

### Google Cloud

```bash
gcloud dataproc batches submit pyspark gs://<bucket>/jobs/daily.py --region=<region> -- --date=2026-11-01
gcloud dataproc jobs submit pyspark gs://<bucket>/jobs/daily.py --cluster=<cluster> --region=<region> -- --date=2026-11-01
```

Read BigQuery with the Spark BigQuery connector (`spark.read.format("bigquery").load("project.dataset.table")`); writes need either a temporary Cloud Storage bucket or the direct write method. Verify connector options and image versions against current docs. Spark 4 enables ANSI SQL mode by default, so invalid casts raise errors instead of returning NULL.

### Testing

```python
import pytest
from pyspark.sql import SparkSession
from pyspark.testing import assertDataFrameEqual  # Spark 3.5+; otherwise the chispa library

@pytest.fixture(scope="session")
def spark():
    s = SparkSession.builder.master("local[2]").config("spark.sql.shuffle.partitions", "2").getOrCreate()
    yield s
    s.stop()

def test_daily_revenue(spark):
    orders = spark.createDataFrame([("paid", "2026-11-01 10:00:00", 10.0), ("void", "2026-11-01 11:00:00", 5.0)],
                                   "status string, paid_at string, amount double")
    expected = spark.createDataFrame([("2026-11-01", 10.0)], "day string, revenue double") \
        .selectExpr("to_date(day) as day", "revenue")
    assertDataFrameEqual(daily_revenue(orders), expected)
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Row-at-a-time Python UDFs | Built-in functions, then pandas or Arrow UDFs | Every row is serialized to a Python worker and back |
| `collect()` to loop in the driver | Express the logic as DataFrame operations | The driver runs out of memory and parallelism is lost |
| `repartition(1)` to get one output file | Accept several files, or `coalesce` to a sensible count | One task does all the work |
| Cache everything | Cache only reused DataFrames | Evicts useful data and adds memory pressure |
| Partition output by high-cardinality columns | Partition by date or region | Millions of tiny files slow every reader |
| Fix out-of-memory errors only by adding memory | Find the skew or explode first | Memory hides the cause and raises cost |

## Verification checklist

- [ ] Transforms are pure functions with unit tests on a local session.
- [ ] No row-level Python UDFs on hot paths without a reason.
- [ ] The plan shows pushed filters, pruned columns and the intended join types.
- [ ] Spark UI shows no severe skew or unexplained spill on a realistic run.
- [ ] Output layout is partitioned sensibly and overwrites idempotently.
- [ ] Overwrites of shared production data were confirmed by the user.

## Related

- Knowledge: `etl-pipelines`, `stream-processing`, `bigquery`, `python-testing`, `profiling`, `data-quality`, `duckdb-analytics`.
- Agents: `data-engineer`, `python-reviewer`, `performance-optimizer`.
