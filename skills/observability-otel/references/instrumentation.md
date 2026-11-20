# Instrumentation Recipes

Companion to the `observability-otel` skill. OpenTelemetry packages move
quickly: check each language's "getting started" page on opentelemetry.io for
current package names and supported runtime versions before installing.

## Node.js

```bash
npm install @opentelemetry/api @opentelemetry/auto-instrumentations-node
OTEL_SERVICE_NAME=checkout OTEL_TRACES_EXPORTER=otlp \
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
node --require @opentelemetry/auto-instrumentations-node/register dist/server.js
```

The register hook must load before any instrumented module, which is why it goes
on the command line. ES module apps need the loader setup described in the
current Node.js zero-code docs.

Manual span (TypeScript, strict mode):

```ts
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('checkout');

export async function placeOrder(order: Order): Promise<Receipt> {
  return tracer.startActiveSpan('checkout.place_order', async (span) => {
    try {
      span.setAttribute('order.item_count', order.items.length);
      const receipt = await charge(order);
      span.setAttribute('order.outcome', 'paid');
      return receipt;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}
```

Cloud Logging-compatible JSON with pino (set `GOOGLE_CLOUD_PROJECT` in the
deployment; it is not always present by default):

```ts
import pino from 'pino';
import { trace } from '@opentelemetry/api';

const project = process.env.GOOGLE_CLOUD_PROJECT;
const severity: Record<string, string> = {
  trace: 'DEBUG', debug: 'DEBUG', info: 'INFO', warn: 'WARNING', error: 'ERROR', fatal: 'CRITICAL',
};

export const log = pino({
  messageKey: 'message',
  formatters: { level: (label) => ({ severity: severity[label] ?? 'DEFAULT' }) },
  mixin() {
    const ctx = trace.getActiveSpan()?.spanContext();
    if (!ctx || !project) return {};
    return {
      'logging.googleapis.com/trace': `projects/${project}/traces/${ctx.traceId}`,
      'logging.googleapis.com/spanId': ctx.spanId,
      'logging.googleapis.com/trace_sampled': (ctx.traceFlags & 1) === 1,
    };
  },
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
});
```

## Python

```bash
pip install opentelemetry-distro opentelemetry-exporter-otlp
opentelemetry-bootstrap -a install          # installs instrumentations for detected libraries
OTEL_PYTHON_LOG_CORRELATION=true opentelemetry-instrument uvicorn app.main:app --host 0.0.0.0 --port 8080
```

Zero-code instrumentation does not work with `uvicorn --reload`, and pre-fork
servers with several workers may need per-worker initialization; check the
Python docs for your server.

Manual span:

```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)


def place_order(order: "Order") -> "Receipt":
    """Charge the order inside a span; exceptions mark the span as an error."""
    with tracer.start_as_current_span("checkout.place_order") as span:
        span.set_attribute("order.item_count", len(order.items))
        return charge(order)  # recorded and status set to ERROR automatically on raise
```

Cloud Logging JSON formatter:

```python
import json
import logging
import os

from opentelemetry import trace

PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "")


class CloudJsonFormatter(logging.Formatter):
    """Formats records as single-line JSON that Cloud Logging links to traces."""

    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, object] = {
            "severity": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
        }
        ctx = trace.get_current_span().get_span_context()
        if ctx.is_valid and PROJECT:
            entry["logging.googleapis.com/trace"] = f"projects/{PROJECT}/traces/{ctx.trace_id:032x}"
            entry["logging.googleapis.com/spanId"] = f"{ctx.span_id:016x}"
            entry["logging.googleapis.com/trace_sampled"] = ctx.trace_flags.sampled
        if record.exc_info:
            entry["stack_trace"] = self.formatException(record.exc_info)
        return json.dumps(entry)
```

## Go

```go
import (
	"context"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// initTracing reads OTEL_EXPORTER_OTLP_* and OTEL_SERVICE_NAME from the environment.
func initTracing(ctx context.Context) (func(context.Context) error, error) {
	exp, err := otlptracehttp.New(ctx)
	if err != nil {
		return nil, err
	}
	tp := sdktrace.NewTracerProvider(sdktrace.WithBatcher(exp))
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{}, propagation.Baggage{}))
	return tp.Shutdown, nil // call on SIGTERM so buffered spans are flushed
}

// handler := otelhttp.NewHandler(mux, "server")
```

## Collector configuration (Google Cloud export)

```yaml
receivers:
  otlp:
    protocols:
      grpc: { endpoint: 0.0.0.0:4317 }
      http: { endpoint: 0.0.0.0:4318 }

processors:
  memory_limiter:
    check_interval: 1s
    limit_percentage: 80
    spike_limit_percentage: 20
  resourcedetection:
    detectors: [env, gcp]
  attributes/scrub:
    actions:
      - { key: http.request.header.authorization, action: delete }
      - { key: http.request.header.cookie, action: delete }
      - { key: url.query, action: delete }
  batch: {}

exporters:
  googlecloud: {}
  googlemanagedprometheus: {}
  debug: { verbosity: basic }

service:
  pipelines:
    traces:  { receivers: [otlp], processors: [memory_limiter, resourcedetection, attributes/scrub, batch], exporters: [googlecloud] }
    metrics: { receivers: [otlp], processors: [memory_limiter, resourcedetection, batch], exporters: [googlemanagedprometheus] }
    logs:    { receivers: [otlp], processors: [memory_limiter, resourcedetection, attributes/scrub, batch], exporters: [googlecloud] }
```

- The `googlecloud` and `googlemanagedprometheus` exporters ship in the
  contrib distribution (`otel/opentelemetry-collector-contrib`) and Google's
  own Collector build. Pin the image version.
- The Collector authenticates with Application Default Credentials: Workload
  Identity on GKE, the service identity on Cloud Run. Grant
  `roles/cloudtrace.agent`, `roles/monitoring.metricWriter` and
  `roles/logging.logWriter`, nothing broader.
- Cloud Run: run the Collector as a sidecar container and point the app at
  `http://localhost:4318`. GKE: a DaemonSet or Deployment per cluster.
- Google Cloud also accepts OTLP directly through its telemetry endpoint for some
  signals; check current Cloud Trace docs before skipping the Collector.

Tail sampling (all spans of a trace must reach the same Collector instance, so
put a trace-ID-aware load-balancing layer in front when you scale out):

```yaml
processors:
  tail_sampling:
    decision_wait: 10s
    policies:
      - { name: errors,   type: status_code,   status_code:   { status_codes: [ERROR] } }
      - { name: slow,     type: latency,       latency:       { threshold_ms: 1000 } }
      - { name: baseline, type: probabilistic, probabilistic: { sampling_percentage: 10 } }
```

## Local debugging

```bash
# Jaeger (traces). UI: http://localhost:16686. Pin a released tag.
docker run --rm -p 16686:16686 -p 4317:4317 -p 4318:4318 jaegertracing/jaeger:<version>

# Grafana LGTM (traces, metrics, logs in one container). UI: http://localhost:3000
docker run --rm -p 3000:3000 -p 4317:4317 -p 4318:4318 grafana/otel-lgtm:<version>
```

Point the app at `http://localhost:4318` with `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf`
(or `:4317` with `grpc`).

## Troubleshooting

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| No telemetry at all | Port and protocol mismatch (4317 is gRPC, 4318 is HTTP); exporter set to `none` | Set endpoint and protocol explicitly; check exporter env vars |
| Node app has no HTTP spans | Instrumentation loaded after `http`/`express` were imported | Load the register hook with `--require` on the command line |
| Traces split into fragments | Context not propagated through queues, threads or custom HTTP clients | Inject and extract `traceparent` in message attributes; use context-aware executors |
| Server span but no database child spans | Driver not covered by installed instrumentations | Install the specific instrumentation or wrap calls in manual spans |
| Logs not linked to traces in Cloud Logging | Wrong trace field format | Use `projects/PROJECT_ID/traces/TRACE_ID` and a 16-hex-character span ID |
| Spans lost on shutdown | Provider not flushed | Call the SDK shutdown on `SIGTERM` before exit |
