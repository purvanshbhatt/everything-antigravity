---
name: serverless-functions
disable-model-invocation: true
description: >-
  Builds serverless functions on Cloud Run functions, with notes for AWS
  Lambda and Azure Functions: HTTP and event triggers through Eventarc, the
  Functions Framework for local runs, cold starts, concurrency, timeouts and
  memory, idempotent event handlers with bounded retries, secrets and service
  identities. Use when writing or debugging a function, choosing functions vs
  containers, or reducing cold-start latency.
---

# Serverless Functions

Functions are the fastest path from an event to running code, and the easiest
place to hide bugs: retries that duplicate side effects, global state that
leaks between invocations, work that silently stops after the response, and
cold starts on the critical path. This skill builds functions that are
idempotent, bounded and testable locally, with Cloud Run functions (formerly
Cloud Functions 2nd gen) as the default platform.

## When to use

- Writing an HTTP or event-triggered function (Pub/Sub, Cloud Storage, Firestore, Eventarc).
- Choosing between a function, a Cloud Run service and a Cloud Run job.
- Cold-start latency, duplicate processing after retries, timeouts, or connection exhaustion from many instances.

## When not to use

- A long-lived service with many routes or WebSockets: use `cloud-run`.
- Batch work longer than the function timeout: use Cloud Run jobs via `background-jobs`.
- Trigger and subscription plumbing in depth: use `pubsub-eventarc`.
- Platform-wide IAM design: use `gcp-iam`.

## Workflow

1. **Pick the right compute.** Use the table below. A single-purpose handler for one trigger is a function; anything with several endpoints, background threads or custom binaries is a Cloud Run service; finite batch work is a Cloud Run job.

   **Check:** The handler does one job and fits comfortably inside the platform timeout.

2. **Scaffold with the Functions Framework and run locally.**

   ```bash
   npm install @google-cloud/functions-framework
   npx @google-cloud/functions-framework --target=onOrderPublished --signature-type=cloudevent
   # Python: pip install functions-framework && functions-framework --target=handler --debug
   ```

   Send a test CloudEvent (in PowerShell, call `curl.exe` and use a backtick for line continuation):

   ```bash
   curl localhost:8080 -X POST -H "Content-Type: application/json" \
     -H "ce-id: 123" -H "ce-specversion: 1.0" -H "ce-source: //pubsub.googleapis.com/projects/demo/topics/orders" \
     -H "ce-type: google.cloud.pubsub.topic.v1.messagePublished" -H "ce-time: 2026-11-22T10:00:00Z" \
     -d '{"message":{"data":"eyJvcmRlcklkIjoiNDIifQ=="}}'
   ```

   **Check:** The function handles the sample event locally and its unit tests pass without cloud credentials.

3. **Initialize once, lazily, in global scope.** Create SDK clients and connection pools outside the handler and reuse them across invocations on a warm instance; never open a new database connection per call. Size pools so `max instances x pool size` stays below the database connection limit.

   **Check:** `grep_search` finds no client constructors inside handler bodies.

4. **Make event handlers idempotent and bounded.** Event delivery is at-least-once. Use the event ID as the idempotency key for side effects, and drop events older than a cutoff instead of retrying forever. Event retries are off by default; if you enable them (`--retry`), a throwing handler is retried until the event expires, so the age cutoff is mandatory.

   ```js
   const functions = require('@google-cloud/functions-framework');

   functions.cloudEvent('onOrderPublished', async (event) => {
     if (Date.now() - Date.parse(event.time) > 60 * 60 * 1000) {
       console.error(JSON.stringify({ msg: 'dropping stale event', id: event.id }));
       return; // returning acks the event
     }
     const { orderId } = JSON.parse(Buffer.from(event.data.message.data, 'base64').toString());
     await fulfil(orderId, { idempotencyKey: event.id }); // throwing => redelivered when retries are on
   });
   ```

   **Check:** A test invokes the handler twice with the same event and observes one side effect.

5. **Finish all work before responding.** After an HTTP function returns its response, CPU may be throttled or the instance reclaimed, so un-awaited promises and background threads silently stop. Await everything; move slow work to a queue.

   **Check:** No fire-and-forget promises or threads remain in handlers.

6. **Set resources explicitly.** Memory, CPU, timeout, concurrency, and min and max instances. Concurrency above 1 per instance needs at least 1 vCPU and thread-safe global state. Cap max instances to protect downstream systems.

   **Check:** The deploy command or IaC lists every resource setting; none rely on defaults by accident.

7. **Use a dedicated identity and managed secrets.** Give each function its own service account with only the roles it needs; inject secrets from Secret Manager; require authentication for internal HTTP functions.

   **Check:** The function's service account is not the default compute service account.

8. **Deploy and verify.** Confirm the target project and region with the user before deploying to any shared or production project. Example (verify runtime IDs with `gcloud functions runtimes list --region=REGION`):

   ```bash
   gcloud functions deploy on-order-published --gen2 --region=us-central1 \
     --runtime=nodejs22 --source=. --entry-point=onOrderPublished \
     --trigger-topic=orders --retry --timeout=120s --memory=512Mi \
     --max-instances=20 --service-account=orders-fn@PROJECT_ID.iam.gserviceaccount.com \
     --set-secrets=API_KEY=orders-api-key:latest
   gcloud functions logs read on-order-published --region=us-central1 --limit=50
   ```

   **Check:** A real test event in a non-production project produces the expected log lines and side effect exactly once.

9. **Reduce cold starts only where they matter.** Measure first. Then trim dependencies and startup work, lazy-load rarely used modules, keep `min-instances` at 1 or more for latency-critical HTTP paths (it costs money while idle), and enable startup CPU boost on Cloud Run services.

   **Check:** p95 latency of the first request after scale-from-zero meets the target, or the cost of min instances is accepted in writing.

## Reference

### Choosing compute on Google Cloud

| Need | Use |
| :--- | :--- |
| One handler per trigger, short work | Cloud Run functions |
| Multiple routes, streaming, WebSockets, custom runtime | Cloud Run service |
| Batch or long-running finite work, parallel shards | Cloud Run jobs |
| Multi-step flow with waits and retries per step | Workflows calling functions or services |

Timeouts differ for HTTP and event-driven functions; check current limits in the Cloud Run functions docs before designing around them.

### Equivalent knobs on other platforms (verify against current docs)

| Concept | Cloud Run functions | AWS Lambda | Azure Functions |
| :--- | :--- | :--- | :--- |
| Keep instances warm | `--min-instances` | Provisioned concurrency | Always-ready instances (Flex Consumption, Premium) |
| Requests per instance | Configurable concurrency | One per execution environment | Depends on language and plan |
| Async retries | `--retry` flag | Async invoke retries plus on-failure destinations or DLQ | Per trigger type |
| Local run | Functions Framework | SAM CLI `sam local invoke` | Core Tools `func start` |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Enable retries without an age cutoff | Retries plus a stale-event drop | A poison event retries until it expires |
| Side effects without an idempotency key | Key on the event ID | At-least-once delivery duplicates work |
| Background work after the response | Await, or enqueue a task | CPU throttling stops it silently |
| New DB connection per invocation | Global lazy pool sized to max instances | Connection storms exhaust the database |
| Default compute service account | One least-privilege account per function | Broad default roles widen the blast radius |
| Secrets in plain environment variables in source | Secret Manager references | Values leak via config dumps and repos |

## Verification checklist

- [ ] Handlers run locally with the Functions Framework and have unit tests.
- [ ] Event handlers are idempotent, with an age cutoff when retries are on.
- [ ] Clients are global and lazy; pool size times max instances fits the database.
- [ ] Memory, timeout, concurrency and instance limits are set explicitly.
- [ ] Dedicated service account; secrets from Secret Manager; internal HTTP requires auth.
- [ ] Deployment target was confirmed with the user; logs verified after deploy.

## Related

- Knowledge: `cloud-run`, `pubsub-eventarc`, `background-jobs`, `secrets-management`, `gcp-iam`, `observability-otel`, `aws-essentials`, `azure-essentials`.
- Workflows: `/dockerize` (when a function outgrows the platform).
- Agents: `cloud-devops-engineer`, `backend-engineer`.
