---
name: feature-dev
disable-model-invocation: true
description: >-
  Takes a feature from request to a review-ready branch through gated stages:
  /blueprint, /tdd, implementation, /verify, /code-review and /pr-ready, and
  delegates planning, test writing and review to subagents when the scope
  warrants it. Use when the user asks to build, add or implement a feature,
  endpoint, screen or user story end to end. Invoke with /feature-dev.
---

# Feature Development

Ship a feature through a fixed sequence of gates. Each gate has a pass condition; a failed gate loops back, never forward. The pipeline is the same for a two-hour change and a two-week one; only the depth of each gate changes.

```text
G0 intake -> G1 /blueprint (user approves) -> G2 /tdd red (tests fail for the right reason)
  -> G3 implement to green, step by step -> G4 /verify full -> G5 /code-review (no BLOCKER/MAJOR)
  -> G6 /pr-ready (the user decides on push and PR)
```

## When to use

- The user says "build", "add", "implement" or "ship" a feature, endpoint, screen or user story.
- Work that needs a plan, new tests and a review before it can merge.
- Resuming a half-finished feature: start at the first gate that has not passed.

## When not to use

- A bug with an unknown cause: `/root-cause` (it ends with a regression test and a fix).
- Pure cleanup: `/refactor-clean`. Planning only: `/blueprint`.
- The build is already red: `/build-fix` first.
- Large multi-stream efforts: `/orchestrate` with the `chief-of-staff` agent, which runs this pipeline per work item.

## Workflow

1. **Intake and branch (G0).** Restate the request in one line. If continuing earlier work, run `/session-resume` (or `eag sessions latest`). Confirm the tree is clean and create a branch that follows the repo's naming convention.

   ```bash
   git status --short
   git switch -c feat/<slug>
   ```

   If the tree has unrelated changes, ask the user how to proceed. Never stash, reset or discard their work without explicit confirmation.

   **Check:** You are on a feature branch with no unrelated changes.

2. **Blueprint (G1).** Run `/blueprint`. When the plan spans more than ~10 files or several modules, delegate the first draft to the `planner` subagent with the request, constraints and search hits, then review and publish it yourself as the implementation-plan artifact.

   **Check:** The user approved (or edited and approved) the plan. No production code exists yet.

3. **Tests first (G2).** For the first plan step, or for all steps when the contracts are stable, run the red phase of `/tdd`: write tests from the acceptance criteria and run them. With five or more independent cases or an unfamiliar harness, delegate to `test-engineer` with the contracts, acceptance criteria and target test paths, and require it to return the failing run output.

   **Check:** New tests fail on assertions or missing symbols, not on syntax, import or fixture errors in the tests themselves.

4. **Implement step by step (G3).** For each plan step: write the minimal code to pass, run the step's tests plus the affected tests, tick the task list, and commit with explicit paths (`git add <files>`; never interactive staging). On long features, `/checkpoint` after each green step. If the build breaks, switch to `/build-fix`; if a test fails unexpectedly, switch to `/root-cause` rather than guessing. If a contract must change, go back to G1 and re-confirm only that part.

   **Check:** Every plan step is green and ticked, and every commit builds.

5. **Verify (G4).** Run `/verify full`.

   **Check:** The VERIFICATION REPORT has no FAIL, and every SKIP has a reason the user would accept.

6. **Review (G5).** Run `/code-review` on `git diff <base>...HEAD` against the plan's acceptance criteria. For diffs over ~800 lines or 25 files, shard across `code-reviewer` subagents and add the language reviewer (`typescript-reviewer`, `python-reviewer` or `go-reviewer`). Add `security-guard` when the change touches auth, payments, user-input parsing or secrets. Fix every BLOCKER and MAJOR with a test that reproduces it, then rerun `/verify quick`.

   **Check:** The verdict is APPROVE or APPROVE WITH NITS.

7. **Ready for PR (G6).** Run `/update-docs` if user-visible behaviour, configuration or an API changed, then `/pr-ready`. Produce a walkthrough artifact: what changed, how it was verified, the risks and the rollback. Push the branch or open a PR only after the user says so.

   **Check:** The user has the walkthrough, and nothing was pushed without their go-ahead.

8. **Capture.** Record non-obvious lessons with `/instinct-capture`, then `/session-save`.

   **Check:** `eag sessions latest` shows the summary for this feature.

## Delegation

| Situation | Delegate to | Hand over | Expect back |
| :--- | :--- | :--- | :--- |
| Plan spans >10 files or several modules | `planner` | Request, constraints, search hits | Draft in the blueprint template |
| Unmapped area of the codebase | `codebase-explorer` | Paths and questions | `file:line` table and summary |
| 5+ independent test cases, or unfamiliar harness | `test-engineer` | Contracts, acceptance criteria, test paths | Failing tests and run output |
| Many build or type errors after a change | `build-error-resolver` | Full error output, changed files | Minimal fixes and a green build |
| Diff over ~800 lines or 25 files | `code-reviewer` (sharded) | File groups and acceptance criteria | Findings in `/code-review` format |
| Auth, payments, input parsing, secrets | `security-guard` | Diff and threat notes | Security findings |
| Schema change or migration | `database-architect` | Schema diff, data volumes | Migration review |
| A user journey changed | `e2e-runner` | Journeys and base URL | Playwright run results |

Keep for yourself: gate decisions, user approvals, merging subagent findings and the final summary. Give every subagent the acceptance criteria; without them it optimizes for the wrong thing. Independent delegations (for example tests for separate modules) can run in parallel.

## Gate failures

| Failure | Go back to | Action |
| :--- | :--- | :--- |
| A new test fails for the wrong reason | G2 | Fix the test, not the code |
| Implementation needs a contract change | G1 | Update the plan and re-confirm the changed part |
| `/verify` FAIL on build, types or lint | G3 | `/build-fix` |
| `/verify` FAIL on tests | G3 | `/root-cause` unless the cause is obvious in one read |
| Review BLOCKER or MAJOR | G3 | Reproduce with a failing test, fix, rerun G4 |

**Scaling down.** For a small feature, G1 can be a five-line plan in chat that the user approves, and G5 can be a single `/code-review` pass. G2 and G4 are never skipped.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Write code first and tests "after" | G2 before G3 | Tests written after the code assert what it does, not what it should do |
| Skip approval because the plan "is obvious" | Get a yes, even for a five-line plan | Scope errors are cheapest to catch here |
| Push through a red gate "to fix later" | Loop back to the failing gate | Red compounds; later rarely comes |
| Delegate without acceptance criteria | Pass criteria to every subagent | Subagents optimize for the wrong target |
| One giant commit at the end | One commit per green step | Bisectable history and easy rollback |
| Push or open the PR unasked | Ask before pushing | Pushing publishes the user's work |

## Verification checklist

- [ ] G1: plan approved before any production code.
- [ ] G2: every new behaviour has a test that was seen failing for the right reason.
- [ ] G3: each plan step committed green.
- [ ] G4: `/verify full` report has no FAIL.
- [ ] G5: `/code-review` has no open BLOCKER or MAJOR.
- [ ] G6: docs updated if behaviour changed, walkthrough delivered, push and PR only with user approval.

## Related

- Workflows: `/blueprint`, `/tdd`, `/build-fix`, `/verify`, `/code-review`, `/pr-ready`, `/update-docs`, `/e2e`, `/root-cause`, `/checkpoint`, `/session-save`, `/session-resume`, `/instinct-capture`, `/orchestrate`.
- Agents: `planner`, `test-engineer`, `code-reviewer`, `build-error-resolver`, `security-guard`, `database-architect`, `e2e-runner`, `codebase-explorer`, `chief-of-staff`.
- Knowledge: `tdd-testing`, `subagent-delegation`, `git-workflow`, `software-architecture`.
