---
name: llm-observability
disable-model-invocation: true
description: >-
  Instruments LLM and agent applications: OpenTelemetry GenAI spans for model,
  tool and agent steps, token, cost and latency metrics, prompt and model
  version tags, PII-safe capture of prompts and outputs, Cloud Trace or
  LLM-focused backends, dashboards and alerts, and user feedback linked to
  traces for evals. Use when adding tracing to an LLM app, or when debugging
  cost spikes, slow responses or bad answers in production.
---

# LLM Observability

You cannot debug what you cannot replay. Every model call, tool call and agent
step emits a span carrying the model, prompt version, tokens, latency and
outcome, linked to the user request and to any feedback, with sensitive
content redacted or access-controlled.

## When to use

- Adding tracing to an LLM feature or agent before launch.
- "Why was this answer wrong?", "why did costs double?", "where does the latency go?"
- Building the loop from production feedback into eval sets.

## When not to use

- General service telemetry, sampling, exporters and SLO alerting: `observability-otel`.
- Building the eval harness itself: `agent-evals`. Cutting spend: `llm-cost-routing`.

## Workflow

1. **Define the trace model.** Span tree per request: request, then agent invocation, then LLM calls, tool calls and retrievals. Follow the OpenTelemetry GenAI semantic conventions; they are still evolving, so pin the spec version you follow (check opentelemetry.io). Core attributes: `gen_ai.operation.name` (`chat`, `embeddings`, `execute_tool`, `invoke_agent`), `gen_ai.request.model`, `gen_ai.response.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.tool.name`, plus the provider attribute (renamed between spec versions). Add app attributes: `app.prompt.version`, `app.feature`, `app.thought_tokens`, `app.cached_tokens`, `app.cost_usd`.

   **Check:** the attribute list and pinned spec version are documented in the repo.

2. **Instrument through one wrapper.** Route every model call through one function (pattern below), so tracing, cost and redaction live in one place. Alternatives: the OpenTelemetry contrib instrumentation for the Google Gen AI SDK (verify the package name and maturity on PyPI) and ADK's built-in tracing (`google-adk`). Export over OTLP to Cloud Trace or an LLM-focused backend such as Langfuse or Arize Phoenix (check OTLP support in the version you deploy).

   **Check:** one request in a dev environment shows the full span tree with token counts.

3. **Set a content-capture policy.** Prompts and outputs are the most useful and most sensitive data. Default to off or sampled in production; redact emails, phone numbers, card numbers and keys before export; store full content only in an access-controlled store with a retention limit. Scan samples with `eag shield --file <export>`.

   **Check:** a test sends a prompt containing a fake key and email and asserts both are redacted in the exported span.

4. **Compute cost and latency metrics.** Cost per call = tokens x a versioned price table (input, output including thinking, cached input). Chart tokens and cost by feature, model and prompt version; p50 and p95 latency and time to first token for streams; error rate by code (429, safety 400, 5xx); retries; cached-token share; tool calls per request; agent turns per task; turn-cap hits; schema-validation failures.

   **Check:** the dashboard shows cost per request and cost per successful task.

5. **Alert on what hurts.** Hourly cost above budget, 429 rate, a spike in safety blocks, latency SLO burn, turn-cap hits and structured-output failure rate. Every alert links a runbook (`runbooks-oncall`).

   **Check:** each alert fired once in a test and reached the right channel.

6. **Close the feedback loop.** Store thumbs up or down, user edits and escalations with the trace ID. Weekly, sample negative traces, label them, and add them to the eval set (`agent-evals`). Optional online evaluators (an LLM judge on sampled traces) must be calibrated against human labels.

   **Check:** feedback rows join to traces, and the eval set grew from production failures this cycle.

7. **Debug from the trace.** For a bad answer: find the trace by request ID; inspect retrieval results, prompt version, tool inputs and outputs and the model output; classify the cause (retrieval miss, prompt, model, tool bug, injection); add a regression case. Delegate large trace exports to a subagent that returns only the classified findings.

   **Check:** every incident ends with a regression case in the eval set.

## Patterns

### Traced call wrapper

```python
import time
from google import genai
from opentelemetry import trace

tracer = trace.get_tracer("app.llm")
client = genai.Client()

def traced_interaction(model: str, prompt_version: str, feature: str, **kwargs):
    """One Gemini call with GenAI span attributes. Exceptions are recorded by the span."""
    with tracer.start_as_current_span(f"chat {model}") as span:
        span.set_attribute("gen_ai.operation.name", "chat")
        span.set_attribute("gen_ai.request.model", model)
        span.set_attribute("app.prompt.version", prompt_version)
        span.set_attribute("app.feature", feature)
        start = time.perf_counter()
        result = client.interactions.create(model=model, **kwargs)
        usage = result.usage
        span.set_attribute("gen_ai.usage.input_tokens", usage.total_input_tokens or 0)
        span.set_attribute("gen_ai.usage.output_tokens", usage.total_output_tokens or 0)
        span.set_attribute("app.thought_tokens", usage.total_thought_tokens or 0)
        span.set_attribute("app.cached_tokens", usage.total_cached_tokens or 0)
        span.set_attribute("app.latency_ms", round((time.perf_counter() - start) * 1000))
        return result
```

Usage field names follow the Interactions API in `gemini-api`; generateContent exposes `usage_metadata` instead. Wrap tool executions the same way with `gen_ai.operation.name = "execute_tool"` and `gen_ai.tool.name`.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Log raw prompts to general application logs | Redacted, access-controlled capture with retention | Logs spread personal data and secrets widely |
| Trace only the top-level request | Spans for every model, tool and retrieval step | The failure is usually inside a step |
| Omit the prompt version | Tag every span with it | Regressions can't be attributed |
| Compute cost from list prices hard-coded in code | A versioned price table | Prices and tiers change |
| Collect feedback without trace IDs | Link feedback to the trace | Feedback you can't replay can't become evals |
| Alert on every error | Alert on budget, SLO burn and spikes | Alert fatigue hides real incidents |

## Verification checklist

- [ ] The span model and pinned GenAI convention version are documented.
- [ ] All model and tool calls go through instrumented wrappers.
- [ ] Redaction is tested; content capture follows a written policy with retention.
- [ ] Dashboards show tokens, cost per successful task, latency and error codes by version.
- [ ] Alerts have runbooks and were test-fired.
- [ ] Feedback links to traces and feeds the eval set.

## Related

- Knowledge: `observability-otel`, `agent-evals`, `llm-cost-routing`, `gemini-api`, `google-adk`, `agent-design-patterns`, `gdpr-privacy`, `runbooks-oncall`, `credential-sanitizer`.
- Agents: `sre-engineer`, `gemini-ai-engineer`.
