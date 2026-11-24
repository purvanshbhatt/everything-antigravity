---
name: background-jobs
disable-model-invocation: true
description: >-
  Designs background job systems: durable queues (Cloud Tasks, Pub/Sub,
  BullMQ, Celery, Sidekiq, Postgres-backed queues), transactional enqueue,
  idempotent handlers, retries with backoff and dead letters, rate and
  concurrency limits, scheduling with Cloud Scheduler or cron, long work on
  Cloud Run jobs, and job visibility. Use when moving work off the request
  path, adding scheduled tasks, or fixing duplicate, stuck or silently failing
  jobs.
---

# Background Jobs

Background work fails quietly: a job enqueued before the transaction commits
runs against missing data, a retry sends the email twice, a cron job stops
firing and nobody notices for a month. This skill picks a durable mechanism,
makes every handler idempotent and bounded, and makes failures loud.

## When to use

- Moving slow or unreliable work (email, PDFs, webhooks, imports, AI calls) off the request path.
- Adding scheduled or recurring tasks, or delayed actions ("remind in 24 hours").
- Jobs run twice, never run, hang, or fail without anyone knowing.
- Rate-limiting calls to a third-party API from workers.

## When not to use

- Event fan-out between services: use `message-queues` and `event-driven-architecture`.
- Multi-step business processes with compensation: sagas in `event-driven-architecture`.
- Function-level details of Cloud Run functions: use `serverless-functions`.
- Data pipelines with DAGs and backfills: use `etl-pipelines`.

## Workflow

1. **Classify the work.** For each job note: trigger (user action, event, schedule), maximum runtime, required latency, idempotency risk (money, email, external writes), rate limits of what it calls, and whether per-tenant fairness matters.

   **Check:** Every job has a written maximum runtime and a named downstream limit.

2. **Choose a durable mechanism.** Use the table below. Never use in-process timers, unawaited promises or goroutines for work that must happen: they die with the instance, and serverless platforms may throttle CPU after the response.

   **Check:** `grep_search` for `setTimeout`, `setImmediate`, bare `go func` or thread pools on request paths finds no business work.

3. **Enqueue transactionally.** Insert the job in the same database transaction as the triggering write (Postgres-backed queues make this trivial), or write an outbox row that a relay turns into a task. Enqueuing before commit runs jobs on rows that may roll back; enqueuing after commit loses jobs on crash.

   **Check:** Killing the process right after commit still results in the job running.

4. **Write idempotent, small-payload handlers.** Pass IDs, not objects; reload current state in the handler; check whether the effect already happened. Give each job a deterministic key (`receipt:order-42`, `daily-report:2026-11-22`) and use the queue's deduplication (named Cloud Tasks tasks, BullMQ `jobId`, a unique constraint) plus an idempotency key on outbound API calls.

   **Check:** Running the same job twice concurrently produces one effect.

5. **Configure retries and dead letters.** Retry transient errors with exponential backoff and jitter; fail fast on permanent errors (validation, 4xx other than 408 and 429); cap attempts; move exhausted jobs to a dead-letter state with an alert and a documented manual retry. Replaying dead jobs that touch customers or money needs user confirmation.

   **Check:** A job that always fails stops after the cap and appears in the DLQ dashboard.

6. **Bound concurrency and rate.** Limit per-queue concurrency to what the database pool and third-party quotas allow (Cloud Tasks `--max-concurrent-dispatches` and `--max-dispatches-per-second`, BullMQ worker `concurrency` and `limiter`, Celery `worker_prefetch_multiplier=1` for long tasks). Use per-tenant queues or weighted fairness when one tenant can flood the system.

   **Check:** A burst of 10x normal volume drains at the configured rate without 429s from dependencies.

7. **Respect time limits.** Handler timeout must be shorter than the queue's visibility or dispatch deadline, or the job is redelivered while still running. Chunk long work into resumable batches with checkpoints, or run it as a Cloud Run job (`CLOUD_RUN_TASK_INDEX` and `CLOUD_RUN_TASK_COUNT` shard the work).

   **Check:** The longest observed run time is under 50% of the deadline.

8. **Schedule safely.** Use Cloud Scheduler (or the framework's scheduler) in UTC; make each run idempotent per period key; prevent overlap with a lease or lock; decide the catch-up policy for missed runs. Add a dead man's switch: alert when a scheduled job has not succeeded within its expected interval.

   **Check:** Disabling the scheduler in staging fires the "job did not run" alert.

9. **Make jobs visible.** Dashboards and alerts for queue depth, oldest job age, failure rate, retry rate and DLQ size, plus a per-job status record (queued, running, succeeded, failed, attempts, last error) that support staff can query. Tools: Cloud Tasks and Cloud Run console metrics, Bull Board, Flower, Sidekiq Web.

   **Check:** You can answer "did the receipt for order 42 go out, and when?" in under a minute.

## Reference

### Mechanisms

| Mechanism | Best for | Notes |
| :--- | :--- | :--- |
| Cloud Tasks | Per-task HTTP push to Cloud Run with rate limits, delays and named-task dedup | Dispatch deadline caps handler time; verify current limits |
| Pub/Sub | High-throughput fan-out | No per-task delay; see `message-queues` |
| Cloud Run jobs | Batch and long-running work, parallel shards | Trigger from Cloud Scheduler or Workflows |
| Postgres queue (graphile-worker, pg-boss, River, Oban, Solid Queue, Procrastinate) | Transactional enqueue with the business write | `FOR UPDATE SKIP LOCKED`; watch table bloat |
| BullMQ, Sidekiq, Celery | Mature app-level job frameworks | Redis brokers need `noeviction` and persistence |
| Workflows or Temporal | Multi-step, long-running, waits for humans | Durable state and per-step retries |

### Commands (Google Cloud; replace `\` with a backtick in PowerShell)

```bash
gcloud tasks queues create emails --location=us-central1 \
  --max-dispatches-per-second=20 --max-concurrent-dispatches=10 \
  --max-attempts=8 --min-backoff=5s --max-backoff=600s

gcloud scheduler jobs create http nightly-report --location=us-central1 \
  --schedule="0 3 * * *" --time-zone="Etc/UTC" --http-method=POST \
  --uri="https://reports-HASH-uc.a.run.app/jobs/nightly" \
  --oidc-service-account-email=scheduler@PROJECT_ID.iam.gserviceaccount.com

gcloud run jobs create reindex --region=us-central1 \
  --image=us-central1-docker.pkg.dev/PROJECT_ID/app/worker:1.4.0 \
  --tasks=20 --parallelism=5 --max-retries=2 --task-timeout=3600s
```

### Postgres dequeue

```sql
UPDATE jobs SET status = 'running', locked_at = now(), attempts = attempts + 1
WHERE id = (
  SELECT id FROM jobs
  WHERE status = 'queued' AND run_at <= now()
  ORDER BY run_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1)
RETURNING id, kind, payload, attempts;
```

Pair it with a reaper that requeues `running` jobs whose `locked_at` is older than the timeout.

### BullMQ options

```ts
await queue.add('send-receipt', { orderId }, {
  jobId: `receipt:${orderId}`,                      // not added again while this job exists
  attempts: 6, backoff: { type: 'exponential', delay: 2_000 },
  removeOnComplete: 1000, removeOnFail: false,
});
new Worker('emails', handler, { connection, concurrency: 10, limiter: { max: 50, duration: 1_000 } });
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Enqueue before the transaction commits | Same-transaction insert or outbox | Jobs run against rows that do not exist |
| Fire-and-forget promises or goroutines | Durable queue | Lost on deploy, crash or CPU throttling |
| Pass whole objects in the payload | Pass IDs; reload state | Stale data and oversized messages |
| Retry everything forever | Classify errors, cap attempts, DLQ | Poison jobs burn quota and hide in logs |
| Handler timeout longer than the visibility deadline | Shorter handler timeout or chunking | Duplicate concurrent runs |
| Cron in local time with no overlap guard | UTC, lease per period key | DST double-runs and overlapping executions |
| No alert when a scheduled job stops | Dead man's switch | Silent failure for weeks |

## Verification checklist

- [ ] Every job runs on a durable mechanism and is enqueued transactionally.
- [ ] Handlers are idempotent with deterministic job keys; duplicate runs are tested.
- [ ] Retries are capped with backoff; DLQ has an owner and an alert.
- [ ] Concurrency and rate limits match downstream capacity.
- [ ] Handler timeouts are below queue deadlines; long work is chunked or on Cloud Run jobs.
- [ ] Scheduled jobs are UTC, overlap-safe and covered by a missed-run alert.

## Related

- Knowledge: `message-queues`, `backend-patterns`, `serverless-functions`, `cloud-run`, `redis-caching`, `webhooks`, `transactional-email`, `observability-otel`.
- Agents: `backend-engineer`, `sre-engineer`, `silent-failure-hunter`.
