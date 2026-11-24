---
name: deep-work
disable-model-invocation: true
description: >-
  Runs a high-rigor mode for hard problems: restates the problem with testable
  acceptance criteria, enumerates competing hypotheses, plans with a verification
  per step, delegates bounded research to subagents, keeps context lean, and
  holds strict quality gates before claiming done. Use for bugs that survived
  several attempts, cross-cutting changes, or high-stakes code. Invoke with /deep-work.
---

# Deep Work

A deliberate, slower mode for problems where being wrong is expensive. It trades
speed for evidence: every belief gets a test, every step gets a check, and
"done" means demonstrated, not asserted. This replaces EAG v1's `/boost`, which
was renamed because Antigravity ships its own built-in with that name.

## When to use

- A bug survived two or more fix attempts, or nobody can explain why it happens.
- A change crosses module or service boundaries, or touches data, auth, money or concurrency.
- Requirements are ambiguous and a wrong guess means rework measured in days.
- Performance or reliability work where intuition is routinely wrong.
- The user says "think hard", "be thorough", "take your time", "go deep".

## When not to use

- A well-understood feature with clear scope: use `/feature-dev`.
- One failing test or error to diagnose: use `/root-cause` (deep-work calls it as a sub-step when needed).
- Planning only, no execution yet: use `/blueprint`.
- Work that splits cleanly into independent shards: use `/orchestrate`.
- Small edits: the overhead here is not worth it.

## Workflow

1. **Restate the problem and define done.** Write, in the implementation plan artifact: the problem in your own words, constraints, explicit non-goals, and acceptance criteria as executable checks (`pytest tests/test_sync.py::test_no_dup` passes; p95 below 200 ms on `npm run bench:api`). Ask at most three clarifying questions, and only those whose answer changes the design.

   **Check:** Every acceptance criterion names a command or an observable result. The user has confirmed the restatement if it changes their wording.

2. **Get evidence before theorizing.** Reproduce the problem or take a baseline measurement. Delegate bounded exploration to the `codebase-explorer` subagent, for example: "Find every writer to `orders.status`; return `file:line` plus a one-line role each, at most 30 lines; read-only." Read the returned locations yourself only where they matter.

   **Check:** You have a command that demonstrates the problem (fails, or shows the bad number) and that you will reuse as the final proof.

3. **Enumerate hypotheses or approaches.** List at least three, including one you think is unlikely. For each, record evidence for, evidence against, and the cheapest test that would discriminate it from the others. Run tests in order of likelihood divided by cost.

   | # | Hypothesis | For | Against | Discriminating test | Result |
   | :--- | :--- | :--- | :--- | :--- | :--- |
   | H1 | Retry re-sends after a commit timeout | dup rows share request id | none yet | Log idempotency key on retry | confirmed |
   | H2 | Two workers consume the same message | dup timestamps 3 ms apart | ack mode is manual | Count consumers per partition | rejected |
   | H3 | Clock skew orders events wrongly | multi-region | dups also in single region | Repro in one region | rejected |

   **Check:** Surviving hypotheses have positive evidence; rejected ones have the result that killed them (this feeds "Failed approaches" in `/session-save`).

4. **Plan with a verification per step.** Break the solution into steps of roughly one sitting and at most about 200 changed lines each. Every step lists: the change, the files, the command that proves it, and how to roll it back. Request user review of the plan when it changes a public API, a schema, or data.

   **Check:** No step's verification is "looks right"; each is a command or a measurable observation.

5. **Execute in small verified increments.** Write the failing test first where possible (see `tdd-testing`). After each step, run its verification before starting the next. If a step's verification fails twice, stop patching: return to step 3 with the new evidence instead of layering fixes on symptoms.

   **Check:** The task-list artifact shows each completed step with its proving command and result.

6. **Delegate research, keep the main thread lean.** Hand bounded questions (library behaviour, prior art in the repo, log analysis, a second opinion on a design) to subagents with a brief: goal, inputs, scope, output contract, budget (see `/orchestrate`). Summarize tool output instead of pasting it; do not re-read large files. At each plan milestone run `/checkpoint`; if the PreInvocation hook nudges you, or the session is long and slowing down, checkpoint and continue in a fresh conversation.

   **Check:** The main conversation holds decisions and evidence, not raw logs.

7. **Hold the quality gates.** All must pass before you say "done":
   - `/verify full` is green, and the original reproduction or benchmark from step 2 now passes.
   - `/code-review` on the full diff (or the `code-reviewer` subagent for large diffs) reports no BLOCKER or MAJOR.
   - Error handling was checked: delegate to `silent-failure-hunter` when the change adds catches, retries or fallbacks.
   - No test was weakened, skipped or deleted to get green (command below).
   - No new `TODO` or `FIXME` without an issue reference.

   ```bash
   git diff <base> | grep -nE '^\+.*(\.skip\(|\.only\(|xit\(|@pytest\.mark\.(skip|xfail)|t\.Skip\(|#\[ignore\])'
   git diff <base> | grep -nE '^-.*(assert|expect\()'
   ```

   ```powershell
   git diff <base> | Select-String -Pattern '^\+.*(\.skip\(|\.only\(|xit\(|@pytest\.mark\.(skip|xfail)|t\.Skip\(|#\[ignore\])'
   git diff <base> | Select-String -Pattern '^-.*(assert|expect\()'
   ```

   Every hit from the second command needs a reason (moved, replaced by a stronger assertion), or it is a defect.

   **Check:** Each acceptance criterion from step 1 is shown with its command and real output.

8. **Close out.** Write the walkthrough artifact: problem, root cause or chosen approach, rejected alternatives with evidence, changes, proof for each acceptance criterion, residual risks. Then run `/instinct-capture` for any non-obvious lesson.

   **Check:** A reviewer can verify every claim in the walkthrough without asking you.

## Reference

### Rigor by problem type

| Problem type | Minimum evidence before changing code | Final proof |
| :--- | :--- | :--- |
| Heisenbug or flaky failure | Reproduction rate measured (for example 7 of 50 runs) | 0 failures in at least 10x the original run count |
| Performance | Baseline on a fixed benchmark, three runs, median | Same benchmark, same machine, improvement beyond run-to-run noise |
| Data correctness | Query showing bad rows and their count | Same query returns zero; migration or backfill verified on a copy |
| Concurrency | The exact interleaving written out | A test that forces the interleaving (barrier, latch, fake clock) |
| Cross-service change | Contract of every consumer listed | Contract or integration tests green on both sides |

### Stop and escalate when

- Three hypothesis cycles produced no surviving explanation: report evidence so far and ask the user for access, logs or domain knowledge.
- The fix requires a destructive or shared-environment action (migration on shared data, force push, `terraform apply`): stop and get explicit consent.
- The acceptance criteria turn out to conflict: present the trade-off; do not pick silently.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Fix the first plausible cause | Enumerate at least three and test the cheapest discriminator | The first idea is the one most likely to be confirmation bias |
| Patch the symptom after a second failed attempt | Go back to hypotheses with the new evidence | Stacked patches hide the real cause and add new bugs |
| Paste full logs and files into the main thread | Delegate to a subagent and keep the summary | Context bloat degrades reasoning on exactly the hard part |
| Declare done because tests pass | Show the original reproduction now passing plus every criterion | Existing tests passed before the bug was found too |
| Make a test pass by loosening it | Fix the code; justify any removed assertion | A weakened test is a hidden regression |
| Do everything in one sitting with no saves | `/checkpoint` at each milestone | Long sessions lose earlier decisions to compaction |

## Verification checklist

- [ ] Acceptance criteria are executable and were written before code changed.
- [ ] A reproduction or baseline exists and is used as the final proof.
- [ ] At least three hypotheses were recorded, with evidence for each outcome.
- [ ] Every plan step had a verification, and each ran.
- [ ] `/verify full` green, `/code-review` has no BLOCKER or MAJOR, no weakened tests.
- [ ] Walkthrough artifact written; lessons captured with `/instinct-capture`.

## Related

- Workflows: `/root-cause`, `/blueprint`, `/feature-dev`, `/tdd`, `/verify`, `/code-review`, `/orchestrate`, `/checkpoint`, `/session-save`, `/instinct-capture`.
- Knowledge: `context-compaction`, `subagent-delegation`, `tdd-testing`, `software-architecture`, `safe-refactor`.
- Agents: `codebase-explorer`, `code-reviewer`, `silent-failure-hunter`, `performance-optimizer`, `planner`.
