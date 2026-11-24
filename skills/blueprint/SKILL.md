---
name: blueprint
disable-model-invocation: true
description: >-
  Produces a reviewable implementation plan before any code is written: scope,
  constraints, affected modules found by search, contracts first, risks, and
  atomic steps that each carry a test. Use when the user asks to plan, scope or
  design a feature, refactor or migration, or when a change spans several files
  or a public contract. Invoke with /blueprint.
---

# Blueprint

Turn a request into a plan the user can approve, edit or reject before any source file changes. A good blueprint makes implementation boring: every step is small, ordered, testable and reversible. Antigravity ships its own `/plan`; `/blueprint` is EAG's planning procedure, and it produces the implementation-plan artifact that `/feature-dev` executes.

## When to use

- The user says "plan", "scope", "design", "break this down", "how would you implement" or "what would it take".
- The change touches more than ~3 files, a public contract (API, schema, CLI, event, config key) or stored data.
- Requirements are ambiguous and a wrong guess is expensive to undo.
- As gate 1 of `/feature-dev`, and before a large `/refactor-clean`.

## When not to use

- A one-file, obvious change: go straight to `/tdd`.
- A bug with an unknown cause: run `/root-cause` first, then plan the fix.
- An unfamiliar repository with no map: run `/codebase-onboard` first.
- System-level choices (service boundaries, datastore, sync vs async): delegate to the `code-architect` subagent with the `software-architecture` skill. The blueprint consumes that decision; it doesn't make it.

## Workflow

1. **Pin down scope in writing.** Record the goal in one sentence, what is in scope, what is explicitly out of scope, and acceptance criteria as observable behaviour (Given/When/Then or checkable bullets). List open questions. If an answer would change the design rather than a detail, ask now and stop until the user answers.

   **Check:** Every acceptance criterion could become a test without further clarification.

2. **Collect constraints from files, not memory.** Runtime and language versions (`package.json` `engines`, `pyproject.toml` `requires-python`, the `go` line in `go.mod`, `rust-toolchain.toml`), strictness settings (`tsconfig.json`, mypy and ruff config, clippy lints), conventions (`AGENTS.md`, `CONTRIBUTING.md`, `rules/`), compatibility promises, performance budgets, and deploy or migration windows.

   **Check:** Each constraint in the plan cites the file it came from.

3. **Measure the blast radius with search.** Use `grep_search` for every symbol, route, table, config key and env var involved, and `find_by_name` for related tests and fixtures. Classify each hit: modify, caller to update, test to update, or read-only dependency.

   ```bash
   git grep -n "applyCoupon"                         # usages of a symbol
   git grep -n "coupons" -- "*.sql" "migrations/"    # schema touch points
   git log --oneline -15 -- src/checkout/            # recent churn in the area
   ```

   `git grep` behaves the same in PowerShell. If the area spans more than ~30 files or several packages, delegate the scan to the `codebase-explorer` subagent with the symbol list and ask for a `file:line | role` table.

   **Check:** Every file named in the plan is backed by a search hit; nothing is listed as "probably".

4. **Design contracts before steps.** Write the signatures, types, request and response shapes, schema diffs, events, CLI flags and error cases. Mark each `NEW`, `CHANGED` or `UNCHANGED`, and give every breaking change a migration path (expand-then-contract, versioned endpoint, feature flag).

   **Check:** Someone could write callers and tests against the contracts without seeing the implementation.

5. **Enumerate risks and the rollback.** For each risk give likelihood, impact, mitigation and how you would detect it. Always consider migrations on large or shared tables, concurrency, authorization on new endpoints, secrets and config, hot-path performance, third-party limits, and mixed-version deploys (old code with new schema). State the rollback: revert, flag off, or down-migration. Running a down-migration on a shared database requires explicit user confirmation.

   **Check:** Every HIGH risk maps to a mitigation step in the plan, not a footnote.

6. **Slice into atomic steps.** One behaviour per step, roughly 200 changed lines or fewer, build green after each. Every step names its test (file, test name, what it asserts) and a done-when. Order: contracts and types, then tests, core logic, wiring, migration, docs. Mark steps that can run in parallel and which subagent could take them.

   **Check:** No step says "implement X" without a test, and no step depends on a later one.

7. **Publish and stop at the approval gate.** Fill [the plan template](references/plan-template.md) into Antigravity's implementation-plan artifact. If the user wants the plan in the repo, write it to `docs/plans/<yyyy-mm-dd>-<slug>.md`. Ask "Approve, edit or reject?" and write no production code until the user approves.

   **Check:** The user explicitly approved or edited the plan, and you are executing the approved version.

8. **Keep the plan live while executing.** Tick steps in the task list. If reality diverges (a contract must change, a new risk appears, a step doubles in size), stop, update the plan, and re-confirm only the changed part.

   **Check:** At the end, the plan matches what shipped and lists every deviation.

## Patterns

**Depth by change size**

| Change | Blueprint depth |
| :--- | :--- |
| One file, no contract change | Skip; use `/tdd` |
| 2-5 files, internal only | Scope, affected files, 3-6 steps with tests |
| Any contract or schema change | Full template |
| Cross-service or multi-week | Full template, `code-architect` review, milestones that each ship independently |

**Splitting signals**

| Signal | Split by |
| :--- | :--- |
| Step touches more than 5 files | Layer (contract, logic, wiring) |
| Step title contains "and" | Behaviour |
| Step cannot be tested on its own | Introduce the seam or interface as its own step first |
| Schema change and code change together | Expand migration, then code, then contract migration |

**A good step**

```markdown
### Step 3: Reject expired coupons at checkout
- Files: `src/checkout/applyCoupon.ts`, `src/checkout/applyCoupon.test.ts`
- Test first: `applyCoupon > rejects a coupon whose expiresAt is in the past` expects `CouponExpiredError`
- Done when: new test passes, checkout suite green, `npx tsc --noEmit` clean
- Rollback: revert the commit (no data change)
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Plan from memory of the codebase | Search, then cite `file:line` | Assumed structure breaks at step 1 |
| Write steps like "build the backend" | One behaviour per step with a named test | Unverifiable steps hide scope |
| Start coding while the user reads the plan | Stop at the approval gate | Rework costs more than waiting |
| Design internals before contracts | Contracts first | Callers, tests and parallel work depend on them |
| Bury open questions as assumptions | List them and ask the blocking ones | Silent assumptions become bugs |
| One big migration step | Expand, migrate, contract | Keeps every step reversible |
| Treat the plan as frozen | Update and re-confirm on divergence | A stale plan misleads reviewers |

## Verification checklist

- [ ] Goal, in-scope, out-of-scope and testable acceptance criteria are written.
- [ ] Constraints cite files, and every affected file is backed by a search hit.
- [ ] Contracts are specified with NEW / CHANGED / breaking marks and migration paths.
- [ ] Every HIGH risk has a mitigation step and a rollback.
- [ ] Every step has a test and a done-when, and leaves the build green.
- [ ] The user approved the plan before any production code was written.

## Related

- Workflows: `/feature-dev` (runs this as gate 1), `/tdd`, `/codebase-onboard`, `/root-cause`, `/orchestrate`, `/deep-work`.
- Agents: `planner` (drafts large plans), `code-architect` (system-level review), `codebase-explorer` (blast-radius scans), `database-architect` (migrations), `security-guard` (risk review for auth and data changes).
- Knowledge: `software-architecture`, `api-design`, `database-design`, `subagent-delegation`.
