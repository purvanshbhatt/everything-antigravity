---
name: observability-otel
description: >-
  Instruments services with OpenTelemetry traces, metrics and logs: semantic
  conventions, structured JSON logs with trace correlation, sampling, RED and
  USE metrics, SLOs with error-budget burn-rate alerts, export to Google Cloud
  Trace, Monitoring and Logging, and local debugging with Jaeger or Grafana.
  Use when adding telemetry, when an incident lacked signal, or when defining
  SLOs and alerts.
---

# Observability with OpenTelemetry

Make every production question answerable from telemetry: which users are
hurting, where the time went, and what changed. Instrument with the vendor-neutral
OpenTelemetry API, ship over OTLP through a Collector, and alert on user-facing
symptoms measured against SLOs.

## When to use

- Adding tracing, metrics or structured logging to a service, or replacing a vendor SDK with OpenTelemetry.
- An incident review found missing signal: no trace across a hop, logs without request context, no latency histogram.
- Defining SLIs, SLOs, error budgets and alert policies.
- Exporting to Cloud Trace, Cloud Monitoring and Cloud Logging, or debugging telemetry locally.

## When not to use

- Finding the cause of one specific bug with telemetry already in place: use `/root-cause`.
- Front-end Core Web Vitals and bundle performance: use `web-performance`.
- Profiling CPU or memory hot spots in code: delegate to the `performance-optimizer` agent.
- Scrubbing secrets that already leaked into logs: use `credential-sanitizer`.

## Workflow

1. **Start from questions, not tools.** List the critical user journeys (for example "checkout completes") and, for each, the SLI: good events over valid events, with latency thresholds. Write them into the implementation plan artifact.

   **Check:** Each journey has a measurable SLI with a numerator, denominator and threshold.

2. **Set resource identity once, through environment variables.**

   ```bash
   export OTEL_SERVICE_NAME=checkout
   export OTEL_RESOURCE_ATTRIBUTES=service.version=1.4.2,deployment.environment.name=prod
   export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
   export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
   # PowerShell: $env:OTEL_SERVICE_NAME = "checkout"   (same pattern for each variable)
   ```

   **Check:** Spans in the backend carry `service.name`, `service.version` and `deployment.environment.name`.

3. **Enable zero-code instrumentation first.** It covers inbound HTTP, outbound HTTP, gRPC and common database clients. Setup per language is in [instrumentation](references/instrumentation.md).

   ```bash
   node --require @opentelemetry/auto-instrumentations-node/register dist/server.js   # Node (CommonJS)
   opentelemetry-instrument python -m app                                             # Python
   ```

   **Check:** Run a local backend (step 9), send one request, and see a server span with child spans for its database and HTTP calls.

4. **Add manual spans for business operations.** Name spans with low-cardinality names (`checkout.place_order`, `GET /orders/{id}`), add attributes that explain the outcome, and on failure record the exception and set the span status to error.

   **Check:** A forced failure produces a trace whose error span names the operation and the `error.type`.

5. **Correlate logs with traces.** Emit one JSON object per line with `trace_id` and `span_id` from the active context. On Google Cloud use the special fields so Logging links each entry to Cloud Trace (format below). Never log secrets, tokens, cookies, full request bodies or personal data.

   **Check:** From any error log line you can open its trace, and `eag shield --file sample.log` (fallback `node <plugin-root>/bin/eag.js shield --file sample.log`) finds no secrets in a captured sample.

6. **Emit RED metrics with bounded attributes.** Use the instrumentation's `http.server.request.duration` histogram, or record your own histogram in seconds. Allow only bounded attributes: route template, method, status code, outcome. Never user IDs, request IDs, emails or raw URLs.

   **Check:** Each metric has a known, small set of attribute combinations (under about 1,000 series per service).

7. **Choose sampling deliberately.** Head-sample with `OTEL_TRACES_SAMPLER=parentbased_traceidratio` and `OTEL_TRACES_SAMPLER_ARG=0.1` (adjust to volume). When you must keep every error and slow trace, add tail sampling in the Collector.

   **Check:** Traces are complete across services (no orphaned children), and trace volume matches the budget.

8. **Export through a Collector.** App to Collector over OTLP; the Collector applies `memory_limiter`, redaction and `batch`, then exports to Google Cloud. Use a sidecar on Cloud Run or a gateway or agent deployment on GKE. Configuration is in [instrumentation](references/instrumentation.md).

   **Check:** Data appears in Cloud Trace, Monitoring and Logging, and the Collector's own logs show no dropped data or exporter errors.

9. **Define SLOs and burn-rate alerts.** Set each SLO target with its owner, alert on error-budget burn rate (table below), and route every page to a runbook. Details in [SLOs and alerting](references/slo-alerting.md).

   **Check:** Each alert names the SLO, the burn-rate window and a runbook link, and a synthetic failure in staging triggers it.

## Patterns

### Semantic conventions to get right

| Area | Attributes |
| :--- | :--- |
| Resource | `service.name`, `service.version`, `deployment.environment.name`, `cloud.region` |
| HTTP server | `http.request.method`, `http.route` (template), `http.response.status_code`, `url.scheme` |
| HTTP client | `server.address`, `server.port`, `http.response.status_code` |
| Database | `db.system.name` (older instrumentations emit `db.system`), `db.operation.name`, `db.collection.name`, `db.query.text` (sanitized, no literals) |
| Messaging | `messaging.system`, `messaging.destination.name`, `messaging.operation.type` |
| Errors | `error.type`, plus span events `exception.type` and `exception.message` |

Conventions are versioned and some names changed as they stabilized. Check which
version your instrumentation emits before building dashboards on attribute names.

### RED and USE

| Method | Applies to | Measure |
| :--- | :--- | :--- |
| RED | Request-driven services and endpoints | Rate (requests/s), Errors (failed/s or ratio), Duration (latency histogram, p50/p95/p99) |
| USE | Resources: CPU, memory, connection pools, queues, disks | Utilization, Saturation (queue depth, wait time), Errors |

### Log line for Google Cloud Logging

```json
{"severity":"ERROR","message":"payment declined","logging.googleapis.com/trace":"projects/my-project/traces/4bf92f3577b34da6a3ce929d0e0e4736","logging.googleapis.com/spanId":"00f067aa0ba902b7","logging.googleapis.com/trace_sampled":true,"order_id":"ord_123","error.type":"CardDeclined"}
```

Cloud Run and GKE parse JSON lines from stdout into structured entries. Outside
Google Cloud, emit plain `trace_id` and `span_id` fields instead.

### Burn-rate alerts (30-day SLO window)

| Severity | Long window | Short window | Burn rate | Budget spent when it fires |
| :--- | :--- | :--- | :--- | :--- |
| Page | 1 hour | 5 minutes | 14.4 | 2% |
| Page | 6 hours | 30 minutes | 6 | 5% |
| Ticket | 3 days | 6 hours | 1 | 10% |

Fire only when both windows exceed the rate: the long window proves
significance, the short window proves it is still happening.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Log full request or response bodies and headers | Log IDs, sizes and outcomes; redact in app and Collector | Secrets and personal data end up in widely readable log storage |
| User or request IDs as metric attributes | Put them on spans or logs | Unbounded cardinality explodes cost and breaks queries |
| Alert on CPU above 80% | Alert on SLO burn rate; keep CPU on dashboards | Cause-based alerts page people for things users never notice |
| Ratio sampling without `parentbased_` | `parentbased_traceidratio` | Services sample independently and traces arrive broken |
| Span names containing IDs (`GET /orders/123`) | Route templates (`GET /orders/{id}`) | Each ID becomes a new span name and aggregation fails |
| New correlation ID minted in every service | Propagate W3C `traceparent` and use the trace ID | IDs that change per hop cannot join an incident timeline |
| Record the exception, then swallow it | Record, set error status, then handle or rethrow deliberately | Telemetry shows an error the code silently ignored |
| Vendor-specific SDK calls throughout the code | OpenTelemetry API plus OTLP and a Collector | Switching backends becomes a config change, not a rewrite |

## Verification checklist

- [ ] Critical journeys have written SLIs and SLO targets with owners.
- [ ] Resource attributes set; traces propagate across every service hop with no orphaned spans.
- [ ] Error paths record exceptions and set span status; span names are low-cardinality.
- [ ] Logs are structured JSON with trace and span IDs; a sampled log capture contains no secrets or personal data.
- [ ] Metric attributes are bounded; latency is a histogram in seconds.
- [ ] Sampling policy documented; tail sampling keeps errors and slow traces if required.
- [ ] Collector runs `memory_limiter`, redaction and `batch`; exporter errors are monitored.
- [ ] Burn-rate alerts exist for each SLO, each with a runbook, and were tested once.

## Related

- Agents: `cloud-devops-engineer` (Collector and Google Cloud setup), `performance-optimizer` (latency work driven by traces), `silent-failure-hunter` (errors that never reach telemetry).
- Workflows: `/root-cause`, `/verify`, `/feature-dev` (instrument new endpoints as part of done).
- Knowledge: `kubernetes-gke`, `backend-patterns`, `credential-sanitizer`, `web-performance`, `cloud-devops`.
