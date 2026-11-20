---
name: llm-cost-routing
description: >-
  Cuts LLM spend without losing quality: cost per successful task, routing by
  difficulty across Gemini tiers, cascades with verifiable confidence checks,
  thinking-level tuning, implicit and explicit caching, Batch API, token
  budgets, prompt compression and response caching, plus picking agent models
  in Antigravity (model: flash, pro or inherit). Use when LLM cost, quota or
  latency is too high, or when choosing models.
---

# LLM Cost Routing

Spend the expensive model only where it changes the outcome. Cost per call is
the wrong metric; cost per successful task is the right one, and you can only
measure it with an eval set. Routing a bad prompt to a cheaper model just
fails more cheaply.

## When to use

- The bill or quota (429s) keeps growing, latency is too high, or someone asks "which model should we use?".
- Planning a high-volume pipeline (classification, extraction, embeddings) or an agent that makes many calls.
- Antigravity sessions burn quota on subagents and long contexts.

## When not to use

- Quality is below target: fix it with `prompt-engineering` or `rag-pipelines` and measure with `agent-evals` first.
- Cloud infrastructure spend (VMs, databases): `cloud-devops`.
- Pricing your own product: `pricing-strategy`.

## Workflow

1. **Measure the baseline.** Log per call: model ID, prompt version, input, cached, output, thought and tool-use tokens, search queries, latency and success. Compute cost from the current pricing page (`https://aistudio.google.com/docs/pricing.md`) with prices kept in config, never in code; thought tokens bill as output, and Search grounding on Gemini 3+ bills per query. Then compute **cost per success** = total cost / tasks that passed (evals offline, a success signal in production). Code: [references/router.md](references/router.md).

   **Check:** a table per feature shows calls per day, tokens per call, cost per success and p95 latency.

2. **Cut tokens before changing models.**
   - Trim system instructions and examples; send only the tools a route needs (every declaration is input on every turn); keep fewer chunks after reranking; summarize history (`context-compaction`); crop and downscale images; cap `max_output_tokens`; ask for terse structured output; truncate tool results.
   - Keep a byte-stable prefix for implicit caching: system instruction, tools and shared documents first, per-request data last, and no timestamps or request IDs in the prefix. Current Gemini 4 and 3.x models cache prefixes from 4,096 tokens; in Gemini 4 agent loops the previous request is fully cached only when the new request adds at least 2,050 tokens.
   - For a large shared context with a TTL, use explicit caching (generateContent, Gemini 3 and 2.5); cache storage is billed.

   **Check:** tokens per call fall, the `total_cached_tokens` share rises, and the eval pass rate is unchanged.

3. **Tune reasoning depth per route.** Set `thinking_level` per route: `low` for extraction and classification, `high` for planning, `xhigh` only for cases proven to need it. Track `total_thought_tokens`.

   **Check:** a per-level table of pass rate and cost exists, and each route uses the lowest level that meets its target.

4. **Route by difficulty.**

   | Work | Start at |
   | :--- | :--- |
   | Classification, extraction, routing, PII tagging | Flash-Lite |
   | Summaries, chat, RAG answers, ordinary tool use | Flash |
   | Multi-step planning, hard code, ambiguous analysis, many-tool agents | Frontier (Gemini 4 family) |
   | Vectors | An embedding model, never a generative one |

   Confirm current IDs with `client.models.list()` (`gemini-api`). Route with rules (task type, input size, customer tier), a Flash-Lite classifier that returns an enum, or nearest-neighbour lookup against labelled examples.

   **Check:** router accuracy is measured on a labelled set, and every route's tier passes that route's eval subset.

5. **Cascade with verifiable confidence.** Try the cheap tier, verify, escalate on failure. Verifiers, most reliable first: schema validation; deterministic checks (tests pass, arithmetic re-computed, citations exist, value in an allowed set); agreement between two cheap samples; a judge call. Never escalate on the model's self-reported confidence alone. Expected cost is `c_cheap + c_verify + p_escalate * c_expensive`, so the cascade only wins while `p_escalate < 1 - (c_cheap + c_verify) / c_expensive`; watch the escalation rate.

   **Check:** cost per success and pass rate beat the always-frontier baseline on the eval set.

6. **Move offline work to batch.** Use the Batch API (50% price, 24-hour target, generateContent only) for backfills, nightly classification and re-embedding. Job creation is not idempotent, so record job names before polling. Reserve priority inference (higher price, may downgrade to standard) for latency-critical paths.

   **Check:** nightly jobs run through batch and no duplicate jobs exist.

7. **Cache responses safely.** Key an exact-match cache on a hash of model ID, prompt version, normalized input and tool versions; set the TTL by data freshness; never share cached personalized or permission-scoped answers across users. Adopt semantic caching only after validating its similarity threshold on the eval set.

   **Check:** hit rate is logged, and bumping the prompt version invalidates the cache.

8. **Enforce budgets.** Cap `max_output_tokens` per request, tool-loop turns per task, and tokens and calls per agent session (Antigravity SDK `BudgetConfig`); set per-tenant daily spend caps with alerts; back off on 429 storms instead of retrying in a tight loop. Limits are per project (RPM, TPM, RPD).

   **Check:** a deliberately runaway loop stops at the budget with a clear stop reason.

9. **Choose models inside Antigravity.** In agent frontmatter, use `model: flash` for exploration, scans, log triage and doc updates (`codebase-explorer`, `doc-updater`, `e2e-runner`), `model: pro` for deep reasoning (`code-architect`, `security-guard`), and `inherit` otherwise. Parallel fan-out multiplies spend: shard work to flash subagents and keep synthesis in the main agent (`subagent-delegation`). Always-on rules are resent every turn, so keep them small. In the Antigravity SDK, leave `model` unset unless measurements justify a change, and read `agent.conversation.total_usage` (including `thoughts_token_count`).

   **Check:** session usage before and after the change shows lower spend for the same task success.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Pick the cheapest model from the price sheet | Pick by cost per successful task | Failures and retries cost more than the savings |
| Escalate on self-reported confidence | Schema, tests, citations, agreement | Models are overconfident |
| Put timestamps or request IDs at the top of the prompt | Variable data at the end | Breaks prefix caching |
| Send all 40 tools on every call | Scope tools per route | Declarations are input tokens every turn |
| Use maximum thinking everywhere | Per-route levels, measured | Thought tokens bill as output |
| Batch interactive paths | Batch only work that can wait a day | 24-hour target |
| Ship semantic caching untested | Exact-match first; validated threshold | Wrong answers served confidently |
| Fan out ten pro subagents | Flash shards, pro synthesis | Quota multiplier |

## Verification checklist

- [ ] Cost per success, tokens per call and p95 latency are measured per feature, with prices from config.
- [ ] Prompt prefix is byte-stable; cached-token share is tracked.
- [ ] Each route has a tier, a thinking level and an eval subset proving it.
- [ ] Cascades use verifiable checks; escalation rate is monitored.
- [ ] Offline workloads use batch; budgets and caps stop runaway loops.
- [ ] Antigravity agents declare `flash`, `pro` or `inherit` deliberately.

## Related

- Knowledge: `gemini-api`, `agent-evals`, `prompt-engineering`, `rag-pipelines`, `context-compaction`, `subagent-delegation`, `antigravity-sdk-orchestrator`, `observability-otel`.
- Agents: `gemini-ai-engineer`, `performance-optimizer`, `chief-of-staff`.
- Workflows: `/orchestrate`, `/deep-work`, `/verify`.
