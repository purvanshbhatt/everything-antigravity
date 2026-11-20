# Cost accounting and cascade router

## Price config (fill from the pricing page; never hard-code in logic)

```yaml
# config/llm_prices.yaml  - USD per 1M tokens; source: https://aistudio.google.com/docs/pricing.md
# Record the date you copied the numbers; prices and tiers change.
updated: 2026-11-20
models:
  <flash-lite-model-id>: { input: <x>, cached_input: <x>, output: <x> }
  <flash-model-id>:      { input: <x>, cached_input: <x>, output: <x> }
  <frontier-model-id>:   { input: <x>, cached_input: <x>, output: <x> }
grounding:
  google_search_per_1k_queries: <x>   # Gemini 3+ bills per executed query after a free monthly allowance
batch_discount: 0.5
```

## Cost of one interaction

```python
def interaction_cost_usd(usage, price: dict) -> float:
    """usage: interaction.usage from the Interactions API; price: one models.<id> entry."""
    input_tokens = usage.total_input_tokens or 0
    cached = usage.total_cached_tokens or 0
    thought = usage.total_thought_tokens or 0
    output = usage.total_output_tokens or 0
    # Confirm for your SDK version whether total_input_tokens includes cached tokens and
    # whether total_output_tokens includes thought tokens: check that total_tokens adds up.
    uncached = max(input_tokens - cached, 0)
    return (uncached * price["input"] + cached * price["cached_input"]
            + (output + thought) * price["output"]) / 1_000_000
```

Add tool-use tokens and grounding queries if your workload uses them.

## Cascade

```python
from dataclasses import dataclass
from typing import Callable, Optional

@dataclass(frozen=True)
class Tier:
    name: str            # "lite", "flash", "frontier"
    model: str           # from config, verified with models.list()
    thinking_level: str  # "low", "medium", "high", ...

@dataclass
class Attempt:
    tier: str
    output: Optional[dict]
    ok: bool
    cost_usd: float
    reason: str

Call = Callable[[Tier, dict], tuple[Optional[dict], float]]   # -> (parsed output or None, cost)
Verify = Callable[[dict, dict], tuple[bool, str]]             # -> (ok, reason)

def cascade(task: dict, tiers: list[Tier], call: Call, verify: Verify) -> list[Attempt]:
    """Try tiers cheapest-first; stop at the first output that passes verification."""
    attempts: list[Attempt] = []
    for tier in tiers:
        output, cost = call(tier, task)
        ok, reason = (False, "invalid or empty output") if output is None else verify(task, output)
        attempts.append(Attempt(tier.name, output, ok, cost, reason))
        if ok:
            break
    return attempts
```

`call` wraps one Interactions API request with `response_format` and
`generation_config={"thinking_level": tier.thinking_level}`, parses with
Pydantic, returns `None` on a validation error, and computes cost with the
function above. Log every attempt: the escalation rate per route is the
number that tells you whether the cheap tier earns its place.

## Verifiers that work

| Task | Verifier |
| :--- | :--- |
| Extraction | Schema plus "every value appears in the source" check |
| Classification | Enum membership; agreement of two cheap samples, else escalate |
| Code | Compiles, type-checks and the relevant tests pass |
| Math or totals | Recompute in code |
| RAG answers | Every cited chunk ID was provided; refusal when retrieval is empty |
| Open-ended writing | Calibrated judge on a rubric (`agent-evals`), sampled rather than per call |

## Router classifier prompt

```text
Classify the request into exactly one route. Return JSON {"route": "<enum>"}.
Routes:
- simple_extract: pull fields from short text; no reasoning beyond lookup.
- standard: summaries, answers from provided context, single tool call.
- complex: multi-step plans, code changes, conflicting sources, ambiguous asks.
When unsure between two routes, choose the more complex one.
<request_{tag}>...</request_{tag}>
```

Run it on the cheapest tier with `thinking_level` set low, and measure its
accuracy against labelled requests before trusting it.

## Break-even check

With per-call costs `c_lite`, `c_verify`, `c_frontier` and escalation rate
`p`, a two-tier cascade beats always-frontier while:

```text
c_lite + c_verify + p * c_frontier < c_frontier
=> p < 1 - (c_lite + c_verify) / c_frontier
```

Recompute whenever prices, prompts or the verifier change.
