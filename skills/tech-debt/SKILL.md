---
name: tech-debt
disable-model-invocation: true
description: >-
  Manages technical debt as a ranked, owned register: finding debt from churn
  and complexity hotspots, TODOs, incidents and developer surveys, scoring
  interest against principal, choosing a paydown strategy (boy scout, pay
  before feature work, capacity allocation, dedicated projects), and explaining
  its cost to product and leadership. Use when asked what to refactor first,
  to build a debt backlog, or to justify cleanup time.
---

# Technical Debt

Debt matters when it charges interest: slower changes, more incidents, harder
onboarding in code that people actually touch. Find the debt in hot code,
price it in time and risk, pay it down in small steps alongside feature work,
and stop taking on debt by accident.

## When to use

- "What should we refactor first?" or "Where is our codebase hurting us?"
- Building or grooming a debt backlog, or preparing a quarterly plan.
- Justifying cleanup time to product managers or leadership.
- After incidents that trace back to fragile code.

## When not to use

- Executing one specific refactor safely: use `safe-refactor`.
- Replacing or strangling a whole legacy system: use `legacy-modernization`.
- Removing dead code and unused dependencies: use `/refactor-clean`.
- Upgrading outdated dependencies: use `/dependency-upgrades`.

## Workflow

1. **Collect signals.** Combine change frequency with complexity; debt in code nobody touches is cheap.

   ```bash
   git log --since="12 months ago" --name-only --format= | grep -v '^$' | sort | uniq -c | sort -rn | head -30
   lizard src/ -C 15 -w                  # functions with cyclomatic complexity above 15
   ```

   PowerShell churn: `git log --since="12 months ago" --name-only --format= | Where-Object { $_ } | Group-Object | Sort-Object Count -Descending | Select-Object -First 30 Count, Name`. Language-specific complexity: `radon cc -s -n C src/` (Python), `gocyclo -over 15 .` (Go). Add `grep_search` for `TODO|FIXME|HACK|XXX`, incident and postmortem links, slow or flaky tests, build times, outdated dependencies, and a five-question developer survey ("Which area do you dread changing, and why?"). Delegate the repo scans to the `codebase-explorer` subagent and keep only its summary.

   **Check:** You have a list of hotspots (high churn and high complexity) with evidence for each.

2. **Write the register** as an artifact, one row per item (template below). Describe the consequence, not the code smell: "Adding a payment method takes 2 weeks because logic is duplicated in 4 places", not "PaymentService is messy".

   **Check:** Every row has an owner, a measurable interest and an effort estimate.

3. **Score and rank.** Priority = (Interest + Risk) x Change frequency / Effort, each on a 1-5 scale (effort S=1, M=3, L=5). Sanity-check the top ten with the team.

   **Check:** The top items are hotspots people recognise, not just the ugliest code.

4. **Choose a strategy per item.**

   | Strategy | Use for |
   | :--- | :--- |
   | Boy scout | Small fixes in files already being changed |
   | Pay before the feature | Refactor the area the next feature touches ("make the change easy, then make the easy change") |
   | Capacity allocation | Steady 10-20 percent of each iteration for ranked items |
   | Dedicated project | Large items with clear milestones and an exit criterion |
   | Strangle or replace | Whole subsystems: hand over to `legacy-modernization` |
   | Accept | Low interest or code slated for deletion; record the decision |

   **Check:** Each top-ten item has a strategy and a trigger or date.

5. **Agree the plan.** Present the top items with their business cost and expected payoff, and get the user's agreement on capacity before scheduling.

   **Check:** The agreed capacity and the first items are recorded in the plan.

6. **Pay down in small, verified steps.** Each change is a separate, reviewable pull request with tests guarding behaviour (`safe-refactor`). Measure the interest metric before and after.

   **Check:** The metric moved: lead time for that area, incident count, test time or complexity score.

7. **Stop accidental debt.** Deliberate shortcuts get an ADR or ticket with a payback trigger; TODOs must reference an issue; lint and static-analysis gates prevent known bad patterns from returning.

   **Check:** New TODOs without an issue reference fail review or lint.

8. **Review quarterly.** Re-run the signals, close paid items, re-rank, and report the trend.

   **Check:** The register is current and the trend report shows items closed versus added.

## Reference

### Register template

| ID | Area | Consequence | Interest | Risk | Effort | Change freq. | Score | Owner | Strategy / trigger |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TD-12 | `billing/invoice.py` | New tax rules take ~5 days; 2 incidents last quarter | 4 | 4 | M (3) | 5 | 13.3 | team-billing | Pay before Q1 tax feature |
| TD-07 | Test suite | CI takes 38 min; devs batch changes | 5 | 2 | L (5) | 5 | 7.0 | platform | 15% capacity until under 15 min |

### Kinds of debt

| | Prudent | Reckless |
| :--- | :--- | :--- |
| **Deliberate** | "Ship now, refactor after launch" with a ticket | "No time for tests" |
| **Inadvertent** | "Now we know how it should have been designed" | "What is layering?" |

Prudent deliberate debt is a valid tool when it is recorded and has a payback trigger. Reckless debt needs a process fix, not just a code fix.

### Translating debt for stakeholders

Use their units: "This costs about 30 engineer-hours a month and caused 2 SEV2 incidents this quarter. Fixing it takes 3 weeks for one engineer, so it pays back in about 4 months and lowers incident risk on checkout." Show before and after numbers when the work is done.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Rank by how ugly code looks | Rank by interest times change frequency | Ugly code nobody changes costs almost nothing |
| Ask for a "refactoring quarter" | Steady capacity plus pay-before-feature | Big-bang cleanups get cancelled and rarely finish |
| Describe debt in code-smell jargon | Describe hours, incidents and risk | Stakeholders fund outcomes, not smells |
| Bundle debt fixes into feature PRs | Separate, small refactor PRs | Mixed diffs hide regressions |
| Keep an unowned TODO graveyard | Owned register with triggers | Lists without owners never shrink |
| Rewrite instead of refactor by default | Incremental refactor; rewrite only with evidence | Rewrites lose hidden behaviour and stall delivery |

## Verification checklist

- [ ] Hotspots come from churn and complexity data, not opinion alone.
- [ ] Every register item has consequence, owner, effort and score.
- [ ] Top items have a strategy, a trigger and agreed capacity.
- [ ] Paydown PRs are small, tested and measured before and after.
- [ ] Rules exist to stop accidental new debt.

## Related

- Agents: `codebase-explorer`, `refactor-cleaner`, `code-architect`, `migration-specialist`.
- Workflows: `/refactor-clean`, `/dependency-upgrades`, `/architecture-decision`, `/explain-code`.
- Knowledge: `safe-refactor`, `legacy-modernization`, `software-architecture`, `static-analysis`, `roadmap-prioritization`.
