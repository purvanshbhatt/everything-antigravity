---
name: llm-app-security
description: >-
  Secures applications and agents built on LLMs: direct and indirect prompt
  injection, data exfiltration through tools and rendered output, excessive
  agency, RAG access control, system prompt leakage, output handling, cost
  abuse, and red-team testing mapped to the OWASP Top 10 for LLM Applications.
  Use when building or reviewing a chatbot, RAG feature, agent or MCP tool
  integration.
---

# LLM Application Security

Assume the model will eventually follow attacker-written text, because no
filter stops prompt injection reliably. Design so that a fully manipulated
model still cannot reach data the user could not, take irreversible actions
without a human, or carry data out of the system.

## When to use

- Building or reviewing a chat feature, RAG pipeline, agent, or MCP server/tool set.
- The model reads untrusted content: web pages, emails, tickets, uploaded files, tool output.
- The model can call tools with side effects (write, send, pay, delete, execute).
- Preparing an LLM feature for a security review or red-team exercise.

## When not to use

- Guardrails for the coding agent you are running right now: use `agent-shield` and `sandbox-isolation`.
- Retrieval quality and chunking: use `rag-pipelines`; tool design in general: `agent-design-patterns`.
- Bias, fairness and content policy: use `responsible-ai`.
- Classic web vulnerabilities in the surrounding app: use `security-audit` and `api-security`.

## Workflow

1. **Map the trifecta.** List (a) sources of untrusted content, (b) sensitive data the model can see, (c) ways the model can communicate outward or change state (tools, links, images, emails, webhooks). Any session that combines all three is an exfiltration path.

   **Check:** A table lists each tool and data source with its trust level; trifecta sessions are named.

2. **Break the trifecta where possible.** Split flows so one model call handles untrusted content without sensitive data or outbound tools (a quarantined reader that returns structured fields), and a privileged step acts only on validated fields.

   **Check:** No single model context has untrusted input, private data and unrestricted outbound capability at once, or the exception is documented and gated by a human.

3. **Constrain tools.** Least privilege per tool; credentials scoped to the end user and resolved server-side; strict argument schemas; allowlisted destinations; human confirmation for side effects. Pin MCP servers to reviewed versions and read their tool descriptions, which the model treats as instructions.

   ```python
   def execute_tool(call, user, session):
       tool = REGISTRY[call.name]                     # unknown tool -> fail closed
       args = tool.schema.validate(call.arguments)    # reject extra or malformed args
       if not authz.allowed(user, tool.permission, args):
           return ToolResult.error("not permitted")
       if tool.side_effect and not session.confirmed(call.id):
           return ToolResult.needs_confirmation(tool.describe(args))
       return tool.run(args, credentials=creds_for(user))   # never model-chosen creds
   ```

   **Check:** A test where injected text requests a side-effect tool ends in a confirmation prompt or a denial, never an action.

4. **Enforce access control in retrieval.** Filter RAG results by the requesting user's permissions at query time (metadata filters on tenant, ACL groups). Never rely on the prompt to hide documents. Record the provenance of ingested documents to detect poisoning.

   **Check:** User A's query cannot surface a chunk from a document only user B can open.

5. **Handle output as untrusted input.** Escape before rendering HTML; parameterize any SQL; never `eval` or shell out with model text; validate structured output against a schema. In rendered markdown, block or proxy remote images and show link domains, because an image URL with data in its query string leaks it on render.

   **Check:** A response containing `<script>`, a remote image URL or a crafted link renders inert.

6. **Keep secrets and policy out of prompts.** Treat the system prompt as public. Authorization lives in code; credentials live in the tool layer.

   **Check:** `grep_search` over prompt templates finds no keys, internal URLs with tokens, or "only admins may" logic.

7. **Bound consumption.** Set max output tokens, per-user and per-tenant quotas, request timeouts, agent step limits and spend alerts.

   **Check:** A loop or flood test hits a limit and returns a clear error, not a large bill.

8. **Add screening as defense in depth.** Use input/output screening (for example Model Armor on Google Cloud, Gemini safety settings, or a classifier) and log decisions. Do not treat screening as the primary control.

9. **Red-team and regress.** Build an eval set with direct and indirect injection cases (poisoned documents, hostile web pages, tool output carrying instructions) and run it in CI with a tool such as promptfoo or garak. Delegate a design review to the `security-guard` subagent.

   **Check:** The suite runs on every prompt, model or tool change; failures block release.

## Reference

### OWASP Top 10 for LLM Applications (2025)

| ID | Risk | Primary control |
| :--- | :--- | :--- |
| LLM01 | Prompt Injection | Trifecta breaking, tool gating, confirmation |
| LLM02 | Sensitive Information Disclosure | Retrieval ACLs, redaction, no secrets in context |
| LLM03 | Supply Chain | Pinned models, reviewed MCP servers and datasets |
| LLM04 | Data and Model Poisoning | Ingestion provenance, review of fine-tuning data |
| LLM05 | Improper Output Handling | Escape, parameterize, schema-validate |
| LLM06 | Excessive Agency | Least-privilege tools, human approval |
| LLM07 | System Prompt Leakage | Assume the prompt is public |
| LLM08 | Vector and Embedding Weaknesses | Tenant-filtered vector search, access-aware indexes |
| LLM09 | Misinformation | Grounding, citations, uncertainty in UI |
| LLM10 | Unbounded Consumption | Quotas, token caps, timeouts |

### Injection test cases to include

- A retrieved document whose text tells the assistant to email its contents elsewhere.
- A web page with hidden text (white-on-white, HTML comments, zero-width characters).
- Tool output that contains instruction-like text and a URL.
- A file name or image metadata carrying instructions.
- Multi-turn setups where earlier turns plant instructions for later tools.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Rely on "the model is told not to" | Enforce limits in code around the model | Instructions are suggestions to a manipulable model |
| Wrap untrusted text in delimiters and call it safe | Isolate untrusted content from privileged tools | Delimiters reduce, but do not prevent, injection |
| Give the agent a service account with broad access | User-scoped, per-tool credentials | Injection inherits whatever the agent can do |
| Render model markdown with remote images | Proxy or block images; allowlist link domains | Rendering becomes a silent data channel |
| Index everything into one shared vector store | Tenant and ACL metadata filters on every query | The model will happily quote documents the user cannot open |
| Ship prompt changes without evals | Injection regression suite in CI | Prompt edits silently change security behaviour |

## Verification checklist

- [ ] Trifecta map exists; risky combinations are split or human-gated.
- [ ] Every tool has a schema, least-privilege credentials and authz; side effects require confirmation.
- [ ] Retrieval enforces per-user access control.
- [ ] Model output is escaped, parameterized or schema-validated before use.
- [ ] No secrets or authorization logic live in prompts.
- [ ] Quotas, token caps and step limits are set; injection evals run in CI.

## Related

- Knowledge: `agent-shield`, `sandbox-isolation`, `agent-design-patterns`, `rag-pipelines`, `mcp-server-development`, `agent-evals`, `prompt-engineering`, `responsible-ai`, `llm-observability`, `security-audit`.
- Workflows: `/threat-modeling`, `/security-scan`.
- Agents: `security-guard`, `gemini-ai-engineer`.
