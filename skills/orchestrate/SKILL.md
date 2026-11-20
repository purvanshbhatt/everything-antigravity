---
name: orchestrate
description: >-
  Designs and runs multi-agent pipelines with EAG subagents: sequential
  planner-implementer-reviewer chains, parallel fan-out of independent shards
  with a merge, and adversarial review loops. Covers delegation briefs, handoff
  documents, merge and conflict rules, and budget limits. Use when work splits
  into independent pieces or needs an independent check. Invoke with /orchestrate.
---

# Orchestrate

Split work across subagents only where it buys parallelism, isolation or an
independent opinion, and keep ownership of the goal, the integration and the
verification in one place: you (or the `chief-of-staff` agent). Subagents get a
bounded brief and return a contract-shaped result; they never get the transcript.

## When to use

- The work splits into independent units: review 40 files, migrate 12 handlers, compare 3 libraries.
- A stage benefits from a fresh, unanchored opinion: adversarial review, security pass, test design.
- The pipeline is long (plan, implement, review, document) and each stage needs a clean context.
- The user says "parallelize", "fan out", "use subagents", "have another agent check this".

## When not to use

- Under about 30 minutes of work, or a single file: do it directly; briefing costs more than it saves.
- Tightly coupled edits in the same files: one agent working sequentially is faster and safer.
- You need a plan but not a pipeline: use `/blueprint`.
- One hard problem needing depth rather than breadth: use `/deep-work`.
- Concepts of parent/subagent topologies and depth limits: read the `subagent-delegation` knowledge skill.

## Workflow

1. **Decompose and pick a pattern.** List the units of work, their inputs and outputs, and their dependencies. Choose a pattern from the table in Patterns. Record the DAG in the implementation plan artifact.

   **Check:** Dependencies form a DAG (no cycles), and each unit has exactly one owner and one output.

2. **Set budgets before dispatching.** Write them into the plan: at most 4 parallel subagents, depth 1 (subagents do not delegate further unless the brief says so, never deeper than 2), one retry per unit, at most 3 rounds for any review loop, and a per-unit scope (directories and files). Ask the user before exceeding these.

   **Check:** The plan shows the caps, and the total number of planned delegations.

3. **Write a delegation brief per unit** using the template in Patterns. A brief is self-contained: the subagent knows only what you write. State what is already ruled out so it does not redo it, and give the output contract as an exact format.

   **Check:** Cold-reader test: someone who has not seen this conversation could do the task from the brief alone.

4. **Assign file ownership.** Parallel units that write must own disjoint file sets. If two units need the same file, serialize them (the second receives the first's output) or make both read-only and have them return patches for you to apply.

   **Check:** You have listed each writer's files and confirmed no two lists intersect.

5. **Dispatch.** Sequential stages run one after another, each receiving the previous stage's handoff document. Parallel units are dispatched together. While they run, do not duplicate their work.

   **Check:** Every dispatched unit is tracked in the task-list artifact with its owner and status.

6. **Validate each result against its contract.** Reject results that ignore the format, exceed scope, or claim success without evidence; re-brief once with the specific gap. Treat claims such as "tests pass" as unverified until you re-run the command yourself.

   **Check:** Every accepted result conforms to its contract, and its key claims were re-checked.

7. **Merge and resolve conflicts** using the rules below, then run `/verify full` on the integrated result.

   **Check:** The integrated tree is green, and every conflict has a recorded resolution.

8. **Close out.** Write a walkthrough artifact: units, owners, what each produced, how conflicts were resolved, verification evidence, open issues. Run `/checkpoint` if the pipeline continues in another session.

   **Check:** The user can see who did what and the proof that the whole works.

## Patterns

### Pipeline patterns

| Pattern | Shape | Use when | Typical agents |
| :--- | :--- | :--- | :--- |
| Sequential | `planner` -> implementer -> `code-reviewer` -> `doc-updater` | Each stage needs the previous output | `planner`, `code-architect`, `test-engineer`, `code-reviewer`, `doc-updater` |
| Parallel fan-out and merge | N shards in parallel -> you merge | Units are independent (per directory, per service, per question) | `codebase-explorer`, `code-reviewer`, `typescript-reviewer`, `python-reviewer`, `go-reviewer` |
| Adversarial loop | implementer -> reviewer -> fix -> reviewer, max 3 rounds | Correctness or security is high-stakes | `code-reviewer`, `security-guard`, `silent-failure-hunter` |
| Specialist consult | One bounded question to an expert, answer feeds your plan | A single decision needs depth | `database-architect`, `performance-optimizer`, `cloud-devops-engineer`, `gemini-ai-engineer` |

For a whole session run as an orchestrator, start Antigravity with the `chief-of-staff` agent (`agy --agent chief-of-staff`); it applies this skill's rules. Use `planner` to produce the decomposition when the work is large or unfamiliar.

### Delegation brief template

```markdown
## Brief <unit-id> -> <agent>
Goal: <one sentence: the outcome, not the activity>
Context: <3-6 bullets the agent cannot cheaply discover: decisions, constraints, what is ruled out>
Inputs: <files, directories, diff range `base..HEAD`, artifact paths, handoff doc>
Scope: may read <...>; may edit <... | nothing (read-only)>; must not touch <...>
Constraints: <conventions, no new dependencies, no network, no commits>
Output contract: <exact format, e.g. markdown table `file:line | severity | problem | fix`, max 40 rows>
Done when: <verifiable condition, e.g. `npm test -- src/billing` passes>
Budget: <about N tool calls>; after 2 failed attempts, stop and report what blocked you
Escalate if: <ambiguity, scope creep, destructive action needed>
```

### Handoff documents

Between sequential stages, pass a handoff document, not the conversation. Each stage writes one to the artifact directory using [the handoff template](references/handoff-template.md): outcome, files changed, decisions, evidence, known issues, and what the next stage must do.

### Merge and conflict rules

1. You integrate. Subagents never merge each other's work.
2. Evidence beats votes: when two agents disagree (one reports a bug, one says the code is fine), reproduce it. If you cannot settle it, raise it to the user as a question.
3. Deduplicate findings by `file:line` plus root cause; keep the best-evidenced version.
4. Overlapping edits: re-apply the later patch on top of the earlier one by hand and re-run the tests both units named. Never resolve by "last writer wins".
5. Reject any result that weakens, skips or deletes tests to get green.
6. A unit that fails twice is re-scoped or done by you; do not loop it.

### Budget defaults

| Limit | Default | Raise only when |
| :--- | :--- | :--- |
| Parallel subagents | 4 | Units are tiny and read-only; ask the user |
| Delegation depth | 1 (max 2) | A unit is itself a fan-out, and the brief says so |
| Retries per unit | 1 | Never automatically |
| Review loop rounds | 3 | The user accepts the extra cost |
| Output size per unit | about 40 lines or rows | The contract needs a patch file instead |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Delegate "look into the auth module" | Give a goal, scope, output contract and done condition | Vague briefs come back as vague essays |
| Pass the whole conversation to a subagent | Pass a brief plus a handoff document | Subagents anchor on noise and inherit your mistakes |
| Let parallel writers touch the same file | Assign disjoint file ownership or return patches | Concurrent edits silently overwrite each other |
| Accept "all tests pass" from a subagent | Re-run the command yourself | Subagent claims are confident whether or not they are right |
| Fan out 10 agents for a 20-minute task | Do it yourself | Coordination overhead exceeds the parallel gain |
| Run review loops until the reviewer is quiet | Cap at 3 rounds, then escalate the residue | Reviewers can always find something; loops burn budget |

## Verification checklist

- [ ] The pattern and DAG are in the plan artifact, with budgets written down.
- [ ] Every brief passed the cold-reader test and had an output contract.
- [ ] Parallel writers had disjoint file sets.
- [ ] Every accepted result was validated against its contract, and key claims re-checked.
- [ ] Conflicts were resolved by evidence and recorded; no test was weakened.
- [ ] `/verify full` is green on the integrated result, and the walkthrough artifact exists.

## Related

- Agents: `chief-of-staff` (session-level orchestrator), `planner` (decomposition), `codebase-explorer`, `code-reviewer`, `security-guard`, `test-engineer`, `doc-updater`, `silent-failure-hunter`.
- Workflows: `/blueprint`, `/deep-work`, `/code-review`, `/verify`, `/checkpoint`, `/session-save`.
- Knowledge: `subagent-delegation`, `context-compaction`, `antigravity-sdk-orchestrator`, `llm-cost-routing`.
