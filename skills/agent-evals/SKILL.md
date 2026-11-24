---
name: agent-evals
disable-model-invocation: true
description: >-
  Evaluates LLM features and agents: golden datasets, programmatic graders,
  rubric and LLM-as-judge scoring with human calibration, pass@k and pass^k,
  trajectory evals for tool use, red-team sets, cost and latency tracking, and
  regression gates in CI, with a minimal Python harness. Use when the user asks
  "is this prompt or model better", "add evals", "why did quality drop", or
  before shipping or changing an LLM feature.
---

# Agent Evals

An eval is a test suite for behaviour you cannot assert with `==`. Without one,
every prompt edit, model upgrade or new tool is a guess. Build the smallest
suite that would have caught your last real failure, gate merges on it, and
grow it from production failures.

## When to use

- Before shipping an LLM feature, and before every change to its prompt, model, tools or retrieval.
- "Is v2 better than v1?", "which model should we use?", "quality dropped after the upgrade".
- An agent uses tools and you need to know it calls the right ones, in the right order, without dangerous side effects.

## When not to use

- Deterministic code paths: ordinary unit tests (`tdd-testing`, `/tdd`).
- Writing the prompt itself: `prompt-engineering`. Retrieval-specific metrics: `rag-pipelines` (its eval section feeds this harness).
- ADK agents: start with `adk eval` (`google-adk`), then add the gates below.

## Workflow

1. **Define what "good" means per case type.** For each behaviour, choose the cheapest reliable grader: exact match, regex or schema checks first; reference comparison next; a rubric judged by an LLM only for open-ended quality; a trajectory check for tool use.

   **Check:** every case type has a named grader, and any LLM-judged criterion has a written rubric with pass/fail definitions.

2. **Build the golden dataset.** Start with 50 to 200 cases from real traffic (sampled logs, support tickets, bug reports), plus synthetic cases only to fill coverage gaps. Stratify by intent, difficulty, language and input size; include negative cases (should refuse, should ask, should say "not found"). Store JSON Lines in the repo with `id`, `input`, `expected` or `rubric`, `grader` and `tags`. Scrub personal data, keep a held-out slice you never tune against, and version the file.

   ```json
   {"id": "refund-007", "tags": ["refund", "edge"], "grader": "trajectory",
    "input": {"message": "Refund order A-1042, it arrived broken"},
    "expected_tools": ["get_order", "create_refund"], "forbidden_tools": ["delete_order"], "max_steps": 6}
   ```

   **Check:** `tags` counts show every important slice has at least 5 cases, and no case appears in prompt few-shot examples.

3. **Write programmatic graders first.**

   ```python
   from math import comb

   def trajectory_grader(case: dict, out: dict) -> tuple[bool, str]:
       """Expected tools appear in order (gaps allowed); no forbidden tool; step cap respected."""
       calls = [step["tool"] for step in out["trajectory"]]
       it = iter(calls)
       in_order = all(any(c == want for c in it) for want in case["expected_tools"])
       forbidden = sorted(set(calls) & set(case.get("forbidden_tools", [])))
       ok = in_order and not forbidden and len(calls) <= case.get("max_steps", 20)
       return ok, f"calls={calls} forbidden={forbidden}"

   def pass_at_k(n: int, c: int, k: int) -> float:
       """Unbiased pass@k from n trials with c passes."""
       return 1.0 if n - c < k else 1.0 - comb(n - c, k) / comb(n, k)
   ```

   Also check tool arguments (schema-valid, key values correct) and recovery after an injected tool error.

   **Check:** each grader has unit tests with one passing and one failing output.

4. **Calibrate any LLM judge against humans.** Hand-label 50 to 100 outputs (two people on a subset to measure human agreement), run the judge on the same outputs, and compare: accuracy, Cohen's kappa, and recall on the "fail" class. Iterate the judge prompt until its agreement with humans approaches human-to-human agreement. Use binary or three-point verdicts per criterion, require a quoted piece of evidence for each verdict, swap order in pairwise comparisons, prefer a judge from a different or stronger tier than the system under test, and pin the judge's model ID and prompt version. Prompt and procedure: [references/judge-and-ci.md](references/judge-and-ci.md).

   **Check:** a calibration report records agreement numbers and the pinned judge version; recalibrate whenever either changes.

5. **Run several trials and report reliability, not luck.** Run each case 3 to 5 times. Report pass@1, pass@k (can it ever succeed; useful when a verifier picks the winner) and pass^k (every trial passed; what users of an agent actually feel). Compare variants on the same cases, and treat differences smaller than run-to-run spread as noise.

   **Check:** the report shows per-slice pass rates with trial spread, not one headline number.

6. **Track cost and latency per case.** Record input, output, thought and cached tokens, tool calls, wall time and money per trial. Report p50 and p95 latency and **cost per successful task** (total spend divided by passed cases); that is the number to optimise, not cost per call.

   **Check:** the report includes cost per success and p95 latency, and they are compared with the baseline.

7. **Maintain a red-team set with zero tolerance.** Cover direct injection, indirect injection through documents and tool output, role-play jailbreaks, data exfiltration (links or images carrying data), personal-data leakage, destructive tool use, and over-refusal of benign requests. Any critical failure blocks release regardless of the average score.

   **Check:** the red-team suite runs in CI and has no critical failures.

8. **Gate regressions in CI.** On every PR that touches prompts, model IDs, tools or retrieval, run a smoke subset (about 20 cases); run the full suite nightly and before release. Fail the build when the pass rate falls below an absolute floor, drops more than the noise margin below the stored baseline, any red-team case fails, or cost per success rises beyond budget. Updating the baseline requires review. Workflow YAML: [references/judge-and-ci.md](references/judge-and-ci.md#ci-gate).

   **Check:** a deliberately broken prompt fails the CI gate.

9. **Feed production back in.** Log prompt version, model ID, tool trajectory and user feedback; turn every production failure into a new case before fixing it.

   **Check:** the dataset's changelog shows cases added from real incidents.

## Minimal harness

```python
import json, statistics, time
from pathlib import Path
from typing import Callable

Grader = Callable[[dict, dict], tuple[bool, str]]   # e.g. trajectory_grader; pass_at_k is from step 3

def run_suite(cases: Path, system: Callable[[dict], dict], graders: dict[str, Grader], trials: int = 3) -> dict:
    """`system(input)` returns {"output": ..., "trajectory": [...], "cost_usd": float}."""
    per_case: dict[str, list[bool]] = {}
    latencies, cost = [], 0.0
    for line in cases.read_text(encoding="utf-8").splitlines():
        case = json.loads(line)
        for _ in range(trials):
            start = time.perf_counter()
            out = system(case["input"])
            latencies.append(time.perf_counter() - start)
            cost += out.get("cost_usd", 0.0)
            ok, _why = graders[case["grader"]](case, out)
            per_case.setdefault(case["id"], []).append(ok)
    passes = sum(sum(v) for v in per_case.values())
    latencies.sort()
    return {
        "pass_at_1": statistics.mean(pass_at_k(len(v), sum(v), 1) for v in per_case.values()),
        "pass_hat_k": statistics.mean(all(v) for v in per_case.values()),
        "p95_latency_s": latencies[int(0.95 * (len(latencies) - 1))],
        "cost_per_success_usd": cost / max(passes, 1),
        "failing_cases": sorted(k for k, v in per_case.items() if not all(v)),
    }
```

Wire `system` to the real feature (with recorded fixtures for offline unit
runs, live calls for eval runs), print the dict as JSON, and compare it with
`evals/baseline.json` in the gate script.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Judge quality by reading five outputs | A versioned golden set with graders | Anecdotes don't catch regressions |
| Use an uncalibrated LLM judge | Measure agreement with human labels first | Judges have position, length and self-preference bias |
| Score 1 to 10 | Binary or three-point verdicts per criterion, with evidence | Fine scales are noisy and drift |
| Run each case once | 3 to 5 trials; report pass^k | One lucky pass hides flaky agents |
| Optimise cost per call | Optimise cost per successful task | Cheap failures are expensive |
| Tune against the whole dataset | Keep a held-out slice | Overfitting looks like progress |
| Average away red-team failures | Zero tolerance on critical cases | One exfiltration is an incident |
| Grade only the final answer of an agent | Grade the trajectory too | Right answer via a destructive tool call is still a failure |

## Verification checklist

- [ ] Golden set is versioned, stratified, scrubbed, and has a held-out slice.
- [ ] Every grader has unit tests; LLM judges have a calibration report and pinned versions.
- [ ] Reports show pass@1, pass^k, per-slice rates, p95 latency and cost per success.
- [ ] Trajectory cases cover tool order, arguments, forbidden tools and step caps.
- [ ] Red-team suite passes with zero critical failures.
- [ ] CI gate fails on a deliberately broken prompt; baseline changes need review.

## Related

- Knowledge: `prompt-engineering`, `rag-pipelines`, `llm-cost-routing`, `gemini-api`, `google-adk`, `tdd-testing`, `agent-shield`, `observability-otel`.
- Agents: `test-engineer` (harness and graders), `security-guard` (red-team set), `gemini-ai-engineer`.
- Workflows: `/tdd`, `/verify`, `/test-coverage`, `/pr-ready`.
