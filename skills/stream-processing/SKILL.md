---
name: stream-processing
description: >-
  Designs streaming pipelines on Dataflow with Apache Beam, on Apache Flink,
  or with Kafka Streams: event time versus processing time, windows,
  watermarks, triggers and allowed lateness, keyed state and timers,
  exactly-once semantics end to end, dead-letter handling, pipeline updates
  and drains, and testing. Use when building or debugging a streaming job,
  results are late, missing or duplicated, or a running pipeline must be changed.
---

# Stream Processing

A streaming result is only as correct as its notion of time. Assign event
time at the source, decide how long to wait for late data, and make the sink
idempotent or transactional; "exactly-once" inside the engine means nothing if
the sink duplicates writes.

## When to use

- Continuous aggregation, enrichment or alerting over Pub/Sub or Kafka streams.
- Results are missing late events, double-counted after restarts, or stuck because the watermark does not advance.
- Updating, draining or rolling back a long-running streaming job.
- Choosing between Dataflow, Flink, Kafka Streams and simpler consumers.

## When not to use

- Moving messages between services with retries and dead-letter queues: use `message-queues` and `pubsub-eventarc`.
- Event design, schemas and sagas: use `event-driven-architecture`.
- Batch pipelines and backfills: use `etl-pipelines`.
- Simple per-message processing with no windows or state: a plain subscriber on Cloud Run is usually enough.

## Workflow

1. **Write down the time semantics.** Which field is event time, the expected out-of-orderness, how late data may arrive, and what the consumer needs: early speculative results, one final result, or corrections.

   **Check:** Every aggregation states its window, allowed lateness and output policy.

2. **Pick the engine** from the matrix below. Prefer a managed runner (Dataflow) unless you already operate Flink or need Kafka-native processing.

   **Check:** The choice covers the source and sink connectors you need, with their delivery guarantees.

3. **Assign timestamps and watermarks at the source.** Beam `ReadFromPubSub(timestamp_attribute=...)`, Flink `WatermarkStrategy.forBoundedOutOfOrderness(...)` with idleness handling for quiet partitions.

   **Check:** In the job metrics, the watermark advances and data freshness stays within your bound.

4. **Window, trigger and aggregate.**

   ```python
   import apache_beam as beam
   from apache_beam import window
   from apache_beam.options.pipeline_options import PipelineOptions
   from apache_beam.transforms.trigger import AccumulationMode, AfterProcessingTime, AfterWatermark

   with beam.Pipeline(options=PipelineOptions(streaming=True)) as p:
       (p
        | beam.io.ReadFromPubSub(subscription=SUB, timestamp_attribute="event_ts")
        | beam.Map(parse_to_kv)                                   # -> (store_id, amount)
        | beam.WindowInto(window.FixedWindows(60),
                          trigger=AfterWatermark(late=AfterProcessingTime(30)),
                          allowed_lateness=600,
                          accumulation_mode=AccumulationMode.ACCUMULATING)
        | beam.CombinePerKey(sum)
        | beam.Map(to_bq_row)
        | beam.io.WriteToBigQuery(TABLE, method=beam.io.WriteToBigQuery.Method.STORAGE_WRITE_API))
   ```

   With accumulating late firings, downstream must upsert by `(key, window)` rather than append.

   **Check:** A test with late elements produces the expected on-time and late panes.

5. **Handle bad and late records explicitly.** Parse failures and records beyond allowed lateness go to a dead-letter output (a Pub/Sub topic or BigQuery table) with the error and the raw payload.

   **Check:** Malformed input increments a dead-letter counter instead of crashing or stalling the job.

6. **Plan changes to the running job.** Dataflow: launch with the update option and the same job name for compatible changes; otherwise drain (`gcloud dataflow jobs drain <job-id> --region=<region>`) and start a new job. Flink: stop with a savepoint (`flink stop --savepointPath <dir> <job-id>`), then `flink run -s <savepoint> ...`. Draining or cancelling a production job needs explicit user confirmation.

   **Check:** The change plan states whether state is preserved and how much data is reprocessed.

## Reference

### Engine choice

| Engine | Strengths | Watch out for |
| :--- | :--- | :--- |
| Dataflow (Beam) | Managed autoscaling, Streaming Engine, Pub/Sub and BigQuery integration, batch and stream in one model | Update compatibility rules; cost of always-on workers |
| Apache Flink | Rich state and timers, low latency, Flink SQL, strong Kafka integration | You operate checkpoints, savepoints, upgrades and state backends |
| Kafka Streams | Library inside your service, Kafka transactions | Kafka-only in and out; scaling bound to partition count |
| Plain subscriber | Simplest for stateless per-message work | No windows, watermarks or managed state |

### Windows

| Window | Use for |
| :--- | :--- |
| Fixed (tumbling) | Per-minute or per-hour metrics |
| Sliding | Moving averages ("last 10 minutes, every minute") |
| Session | User activity bursts separated by a gap |
| Global with triggers | Running totals or count-based emission |

### Exactly-once, end to end

1. Replayable source: Pub/Sub retention or seeking, Kafka offsets committed with checkpoints.
2. Deterministic processing: no wall-clock or random values in keyed logic; stable IDs.
3. Idempotent or transactional sink: upsert by key, BigQuery Storage Write API in exactly-once mode, Kafka transactional producer with consumers using `isolation.level=read_committed`, or Flink two-phase-commit sinks.
4. Dedupe at the edge by event ID when producers may resend. Pub/Sub also offers exactly-once delivery for pull subscriptions.

Dataflow streaming defaults to exactly-once processing; an at-least-once mode is cheaper when the sink is idempotent. Verify current options and pricing against the docs.

### State and timers

Keyed state grows with key cardinality and time. Set state TTL or clear state in timers, and watch checkpoint size (Flink) or per-key state metrics. Use timers for "no event in N minutes" detection instead of polling.

### Testing

Beam: `TestStream` to inject elements and advance the watermark, with `apache_beam.testing.util.assert_that` and `equal_to`. Flink: `MiniClusterWithClientResource` or the test harnesses for operators. Test late data, out-of-order data, duplicates and malformed input, not only the happy path.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Window on processing time for business metrics | Event-time windows with watermarks | Backlogs and restarts shift events into wrong windows |
| Allowed lateness of zero by default | Measure lateness and set it explicitly | Late events are silently dropped |
| Append accumulating panes to a table | Upsert by key and window | Each firing double-counts |
| Crash on one malformed message | Dead-letter output with the raw payload | One poison message stalls the whole stream |
| Unbounded keyed state | TTL or timer-based cleanup | State and checkpoint sizes grow until the job fails |
| Cancel and restart to deploy | Update, or drain or savepoint first | In-flight data and state are lost |

## Verification checklist

- [ ] Event time, window, allowed lateness and trigger are written down for each aggregation.
- [ ] Watermarks advance, including when some partitions go idle.
- [ ] The sink is idempotent or transactional, and duplicate inputs are deduplicated.
- [ ] Malformed and too-late records reach a dead-letter destination with counters.
- [ ] Tests cover late, out-of-order and duplicate events.
- [ ] Production drains, cancels or state-losing redeploys were confirmed by the user.

## Related

- Knowledge: `message-queues`, `pubsub-eventarc`, `event-driven-architecture`, `etl-pipelines`, `bigquery`, `data-quality`, `observability-otel`.
- Agents: `data-engineer`, `sre-engineer`.
