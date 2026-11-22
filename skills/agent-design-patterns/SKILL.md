---
name: agent-design-patterns
description: >-
  Designs AI agents that behave reliably: choosing between a workflow and an
  agent, tool design (names, schemas, errors, idempotency), loop patterns such
  as ReAct, plan-and-execute, router, orchestrator-workers and
  evaluator-optimizer, memory tiers, human approval gates, budgets and stop
  conditions, and a failure-mode catalog. Use when designing or debugging an
  agent, its tools, or a multi-agent system.
---

# Agent Design Patterns

Most agent failures are design failures: too many vague tools, no stop
condition, side effects without approval, and memory that grows until it
poisons the context. Start with the least autonomous structure that solves the
task, and add autonomy only where evals show it pays.

## When to use

- "Build an agent", "should this be multi-agent", "the agent loops, picks the wrong tool, or forgets".
- Designing the tool surface for an agent or an MCP server.
- Reviewing an agent architecture before implementation.

## When not to use

- Building on ADK: `google-adk`. Raw Gemini tool loops: `gemini-api`. Agents in Python with the Antigravity SDK: `antigravity-sdk-orchestrator`.
- Splitting work across subagents in your own Antigravity session: `subagent-delegation`.
- Measuring agents: `agent-evals`. Securing them: `llm-app-security`. Writing MCP servers: `mcp-server-development`.

## Workflow

1. **Write the task contract.** Inputs; the output artifact; success criteria a program can check; allowed side effects; budgets (turns, tokens, wall-clock, money); who approves what.

   **Check:** success criteria are testable and every side effect is listed.

2. **Choose the least autonomous structure that works.**

   | Level | Pattern | Use when |
   | :--- | :--- | :--- |
   | 0 | Single call with a schema | One-shot transformation |
   | 1 | Prompt chain with code between steps | Steps are known in advance |
   | 2 | Router | Input type selects one of N fixed paths |
   | 3 | Parallel fan-out and aggregate | Independent subtasks (files, sections, sources) |
   | 4 | Tool loop (ReAct) | The next step depends on tool results |
   | 5 | Plan-and-execute | Long tasks with a reviewable plan; replan on failure |
   | 6 | Orchestrator-workers | Subtasks emerge at runtime; workers need isolated context or different permissions |
   | + | Evaluator-optimizer | A grader can check quality; iterations are capped |

   Each extra agent hop adds latency, cost and a failure point, so go multi-agent only for different tools, permissions or context isolation.

   **Check:** the design doc says why the next lower level is not enough.

3. **Design the tools.**
   - One tool, one job, with `verb_noun` names (`search_orders`, `refund_order`). The description says when to use it and when not to.
   - Typed, enumerated parameters instead of a free-form `query` when structure exists.
   - Compact results: top-k, pagination and an explicit truncation note, because tool output costs context.
   - Errors are data: return `{"error": "...", "hint": "..."}` the model can act on instead of raising into the loop.
   - Side-effecting tools take an idempotency key, support a dry run, and sit behind an approval gate.
   - Keep the active set small (roughly 10-20 per agent); beyond that, route to tool groups or sub-agents.

   **Check:** a reviewer who sees only tool names and descriptions picks the right tool for ten sample tasks.

4. **Design memory in tiers.**

   | Tier | Holds | Mechanism |
   | :--- | :--- | :--- |
   | Working | Current task and recent turns | The context window, compacted at thresholds |
   | Scratchpad | Plan, progress, intermediate results | A structured state object or file the agent reads and writes |
   | Long-term | Preferences, facts, past outcomes | Key-value or vector store with provenance and TTL |
   | Procedural | How-to knowledge | Versioned prompts and skills |

   Write to long-term memory only validated, attributed facts, never instructions taken from untrusted content.

   **Check:** measured context size at turn N stays bounded instead of growing with every turn.

5. **Put humans at irreversible points.** Gate sending messages, moving money, deleting, deploying and external writes. Show the exact action or diff, persist state, and resume from an approval token. Give the agent an `ask_user` tool for ambiguity.

   **Check:** a test proves a gated tool cannot run without an approval record.

6. **Bound the loop.** Cap turns, tokens, wall-clock and cost; detect repeats (same tool and arguments N times); check progress every K turns. On any cap, return the partial result and the reason; never stop silently.

   **Check:** tests hit each cap and assert a graceful, explained termination.

7. **Instrument and evaluate.** Trace every step (`llm-observability`); run trajectory evals (right tools, right order, no forbidden calls) plus outcome evals across repeated runs (`agent-evals`); red-team with instructions injected into tool results (`llm-app-security`).

   **Check:** the suite reports pass^k over repeated runs, and injected instructions never trigger gated tools.

## Patterns

### Tool definition (Gemini function-tool shape, see `gemini-api`)

```python
REFUND_TOOL = {
    "type": "function",
    "name": "refund_order",
    "description": ("Refund one paid order in full or in part. Use only after the user has "
                    "confirmed the amount. Do not use for exchanges; use create_exchange."),
    "parameters": {
        "type": "object",
        "properties": {
            "order_id": {"type": "string", "description": "Order ID such as A-1042"},
            "amount_cents": {"type": "integer", "minimum": 1},
            "reason": {"type": "string", "enum": ["damaged", "late", "wrong_item", "other"]},
            "idempotency_key": {"type": "string"},
            "dry_run": {"type": "boolean", "description": "Validate and price only"},
        },
        "required": ["order_id", "amount_cents", "reason", "idempotency_key"],
    },
}
```

Client-side validation still applies: some schema keywords (`minimum` among them) may not be enforced by the model; check in code.

### Failure modes

| Failure | Signal | Mitigation |
| :--- | :--- | :--- |
| Loop or oscillation | Same tool and arguments repeated | Repeat detector, turn cap, forced reflection step |
| Wrong tool | Trajectory evals fail | Sharper descriptions, fewer tools, a router |
| Invented tool or arguments | Validation errors | Schema validation, `tool_choice` constraints, errors as data |
| Context rot | Quality falls as turns grow | Compaction, scratchpad, workers with fresh context |
| Prompt injection via tool output | Instructions inside fetched content | Treat outputs as data, least-privilege tools, approval gates |
| Scope creep | Actions outside the contract | Allowed-actions list in the system instruction and in code |
| Premature "done" | Success criteria unmet | Programmatic completion check before the final answer |
| Cascading errors | One worker's bad output spreads | Validate worker outputs at every boundary |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Start multi-agent | Start at the lowest level that works | Hops multiply cost and failure |
| Expose 50 tools at once | Small sets per agent or route | Tool choice accuracy drops |
| Raise exceptions out of tools | Return structured errors | The model can recover from data |
| Rely on the prompt to stop loops | Hard caps in code | Prompts are advisory |
| Let the agent write its own memory freely | Validate and attribute writes | Memory poisoning persists |

## Verification checklist

- [ ] A task contract with testable success criteria exists.
- [ ] The structure is the lowest level that works, with the reason written down.
- [ ] Tools pass the names-only review; side-effecting tools are idempotent and gated.
- [ ] Memory tiers are defined; context growth is bounded and measured.
- [ ] Caps on turns, tokens, time and cost are tested.
- [ ] Traces, trajectory evals and injection tests run in CI.

## Related

- Knowledge: `google-adk`, `gemini-api`, `antigravity-sdk-orchestrator`, `subagent-delegation`, `mcp-server-development`, `agent-evals`, `llm-observability`, `llm-app-security`, `prompt-engineering`, `context-compaction`.
- Agents: `gemini-ai-engineer`, `code-architect`, `security-guard`.
