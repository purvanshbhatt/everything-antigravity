---
name: okrs
disable-model-invocation: true
description: >-
  Writes, reviews and scores OKRs: qualitative objectives, outcome key results
  with baselines and targets, committed versus aspirational goals, health
  metrics, cascading and cross-team alignment, weekly check-ins, end-of-cycle
  scoring and guarding against sandbagging and task-list key results. Use when
  the user is drafting quarterly OKRs, reviewing a team's OKRs, aligning team
  goals to company goals, or grading a finished cycle.
---

# OKRs

Objectives say where we want to go; key results say how we will know we got
there. A good OKR set is short, measurable, owned, and changes what the team
does this quarter.

## When to use

- "Help me write our Q*<n>* OKRs", "review these OKRs", "are these good key results?".
- Aligning team goals to company objectives, or untangling cross-team dependencies.
- Running weekly OKR check-ins or end-of-cycle scoring and retrospectives.
- Converting a strategy document into measurable goals.

## When not to use

- Deciding which projects deliver the key results: `roadmap-prioritization`.
- Individual performance goals and reviews: `people-operations` (keep OKRs separate from compensation).
- Defining and instrumenting the metrics themselves: `product-analytics`.
- Long-range strategy and business planning: `business-plan`.

## Workflow

1. **Start from strategy, not the backlog.** Gather company objectives, last cycle's scores and retrospective notes, and known constraints (headcount, launches, contracts).

   **Check:** Each draft objective traces to a company objective or strategy pillar.

2. **Write at most three objectives per team.** An objective is qualitative, memorable and bounded by the cycle. It contains no number.

   **Check:** Each objective reads clearly with the numbers removed, and the team would be proud to achieve it.

3. **Write two to four key results per objective.** Each KR is a metric moving from a baseline to a target by a date, phrased as an outcome ("from *X* to *Y*"), not an activity. Use placeholders where baselines are not yet measured, and make measuring them the first task.

   **Check:** Every KR passes the quality tests below.

4. **Label each OKR committed or aspirational.** Committed OKRs are expected to be fully delivered; resources and schedules are adjusted to hit them. Aspirational OKRs stretch, and partial delivery is expected. Google's published OKR guidance, a common reference, expects about 0.7 on average for aspirational OKRs and 1.0 for committed ones.

   **Check:** Every OKR carries a label, and the team agrees what a miss means for each.

5. **Separate health metrics.** Things that must stay healthy (uptime, CSAT, gross margin) are listed as health metrics with floors, not as OKRs, unless they are the focus of improvement this cycle.

   **Check:** No KR merely restates business-as-usual work.

6. **Cascade by alignment, not copying.** Teams propose OKRs that contribute to company objectives; leaders review for gaps and overlaps. Build an alignment sheet: company objective, team objective, KR, owner, dependencies. Shared KRs get one owner.

   **Check:** Every dependency has an acknowledgement from the other team.

7. **Red-team the drafts.** Compare each target to the current trend line: a target at or below the existing trajectory is a forecast, not a goal (sandbagging). Pair any gameable KR with a counter-metric. You can delegate a critique pass to a subagent with the rubric below.

   **Check:** Each target is above trend (for aspirational) or explicitly justified (for committed).

8. **Check in weekly.** Each owner updates current value, confidence (on track, at risk, off track) and one line on what changed. Targets change only through an explicit, logged decision.

   **Check:** The check-in sheet has an entry for every KR each week, and target changes appear in a change log.

9. **Score and learn at the end.** Score each KR 0.0 to 1.0, average to the objective, and write one learning per objective. Decide deliberately what carries over.

   **Check:** Scores, learnings and carry-over decisions are recorded before the next cycle's drafting starts.

## KR quality tests

| Test | Passes when | Fails, for example |
| :--- | :--- | :--- |
| Measurable | A number can be read from a named source | "Improve onboarding" |
| Outcome, not output | It describes a change in behaviour or results | "Launch new onboarding flow" |
| Baseline known | Starting value stated or scheduled to be measured | "Reach *<target>* signups" with no baseline |
| Within influence | The team's work can plausibly move it in the cycle | Company revenue as a single team's KR |
| Not gameable alone | A counter-metric guards against shortcuts | "Close *<N>* tickets" without a reopen-rate guard |
| Specific window | Measured over a defined period | "Increase retention" with no cohort or window |

## Rewrites

| Weak KR | Stronger KR |
| :--- | :--- |
| Launch the new onboarding | Raise week-1 activation from *<baseline>*% to *<target>*% for new signups |
| Write *<N>* blog posts | Grow organic signups from *<X>* to *<Y>* per month |
| Improve performance | Cut p95 checkout latency from *<X>* ms to *<Y>* ms |
| Hire engineers | Have *<N>* engineers onboarded and shipping to production by *<date>* |

## Scoring

```text
KR score        = clamp( (actual - baseline) / (target - baseline), 0, 1 )
Objective score = average of its KR scores
```

| Score | Reading |
| :--- | :--- |
| 0.0-0.3 | Little progress; examine the goal and the plan |
| 0.4-0.6 | Progress, but short; what blocked it? |
| 0.7-1.0 | Delivered (expected range for aspirational OKRs) |
| 1.0 on every aspirational KR | Targets were probably too low |

Google Sheets: with baseline in B, target in C and actual in D, `=MAX(0,MIN(1,(D2-B2)/(C2-B2)))`.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| List tasks as key results | Move tasks to the project plan; keep outcomes as KRs | Shipping tasks does not prove results moved |
| Set five objectives with five KRs each | At most three objectives, two to four KRs each | Too many OKRs means no focus |
| Tie OKR scores to pay or ratings | Keep OKRs separate from performance reviews | Linking them rewards sandbagging |
| Set and forget | Weekly check-ins with confidence | Problems surface too late to fix |
| Quietly lower targets mid-cycle | Log any change with the reason and approver | Silent edits make scoring meaningless |
| Turn every health metric into an OKR | Keep health metrics separate with floors | OKRs are for change, not maintenance |

## Verification checklist

- [ ] Each objective traces to a company objective and contains no number.
- [ ] Each KR has a metric, baseline (or measurement date), target, window and owner.
- [ ] Every OKR is labelled committed or aspirational.
- [ ] Targets were compared with the trend line; gameable KRs have counter-metrics.
- [ ] Cross-team dependencies are acknowledged.
- [ ] A weekly check-in sheet and change log exist.

## Related

- Knowledge: `roadmap-prioritization`, `product-analytics`, `people-operations`, `business-plan`, `meeting-facilitation`, `agile-project-management`, `spreadsheet-modeling`.
- Agents: `product-manager`, `chief-of-staff`.
