---
trigger: model_decision
description: Apply when building or changing features that call LLMs or embedding models, including prompts, tool or function calling, agents, RAG, structured output parsing, evals, model configuration, and AI cost or usage controls.
---

# LLM applications

## Output is untrusted

- Treat model output like user input. Validate structured output against a schema (zod, pydantic) before use, even when the provider enforces a JSON schema.
- Never pass model output directly to `eval`, a shell, SQL, file paths or URL fetchers. Map it onto an allowlist of actions with validated arguments.
- Escape or sanitize model output before rendering. Sanitized Markdown must block auto-loading images and links to untrusted hosts, a common data-exfiltration path.
- Handle every finish state: truncated (max tokens), safety-blocked, refused, empty and malformed. Retry parse failures at most a bounded number of times, then fail gracefully.

## Prompt injection

- Any content the model reads (user messages, retrieved documents, web pages, emails, tool results, file contents) may contain instructions. Keep system instructions separate, wrap untrusted content in clear delimiters, and state that it is data.
- Give tools least privilege. Side-effecting tools (send, pay, delete, write, deploy) require human confirmation or a policy check outside the model.
- Do not let the model choose arbitrary URLs, recipients or file paths without an allowlist.
- Never put secrets in prompts, and do not expose system prompts or other tenants' data to the model.

## Configuration

- Keep model IDs, temperatures and token limits in config, not scattered literals. Model names change: check the provider's current docs instead of guessing.
- Version prompts like code (files or a registry), and record the prompt version with each request.
- Set an explicit output token limit and a request timeout on every call.

## Cost and limits

- Enforce per-request token caps, per-user or per-tenant quotas, rate limits and budget alerts in code.
- Bound agent loops: maximum iterations, tool calls, tokens and wall-clock time per task.
- Retry only on retryable errors (429, 5xx, timeouts) with exponential backoff and jitter, and a retry cap.
- Cache (context and response caching) and route simple steps to cheaper models when evals show equal quality.
- Log tokens, latency and estimated cost per request and per feature.

## Personal data

- Send the minimum data needed; strip or pseudonymize PII before prompts when possible.
- Record the provider's data retention, training terms and region in the design.
- Do not log raw prompts or responses containing personal data unless policy allows it; redact first.

## Evals

- Keep a versioned eval set of representative and adversarial cases (including injection attempts) next to the code.
- Run evals on every prompt, model, retrieval or tool change, and block regressions in CI where feasible.
- Calibrate LLM-as-judge graders against human labels before trusting them. Track quality, refusal rate, latency and cost together.

## Testing and operations

- Unit tests mock the model client or use recorded responses; CI unit tests never call live model APIs.
- Keep API keys server-side only. Never ship them to browsers or mobile apps.
- Trace each call (model, prompt version, tokens, finish reason, latency) with the project's observability stack.
- Label AI-generated content and keep a human in the loop for high-stakes decisions.
