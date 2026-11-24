---
name: agile-project-management
disable-model-invocation: true
description: >-
  Plans and runs delivery with Scrum or Kanban: backlog shaping and slicing,
  definitions of ready and done, estimation and Monte Carlo throughput
  forecasts, sprint planning, WIP limits, reviews and retros, risk and
  dependency logs, and RAG status reports. Use when the user asks to plan a
  sprint, estimate or forecast a date, set up a board, track risks, or write a
  status update.
---

# Agile Project Management

Deliver in small, finished increments, forecast from measured throughput
instead of hope, and surface risk early enough to act on it. The method
matters less than three habits: a visible board, limited work in progress,
and honest status.

## When to use

- Planning a sprint or iteration, or setting up a Scrum or Kanban board.
- "When will this be done?": estimation, forecasting and date ranges.
- Keeping a risk, dependency or decision log for a project.
- Writing a weekly status update for stakeholders.

## When not to use

- Choosing what to build across quarters: `roadmap-prioritization`, `okrs`.
- Writing the requirements for an item: `product-requirements` or `/write-spec`.
- Triage of an incoming bug queue: `/issue-triage`.
- Running the retro or review meeting itself: `meeting-facilitation`.

## Workflow

1. **Choose the method.** Use the table below. Write the choice and the cadence (iteration length, review and retro dates) into the team's project doc.

   **Check:** Everyone can name the cadence and where the board lives.

2. **Shape the backlog.** Each item states an outcome and acceptance criteria. Slice large items vertically (one workflow step, one data variation, happy path first) until each fits in a few days. Agree a definition of ready (clear outcome, criteria, dependencies known) and a definition of done (reviewed, tested, deployed or releasable, docs updated).

   **Check:** The top items for the next iteration meet the definition of ready.

3. **Estimate and forecast.** Either use relative points or simply count items once they are similarly sized. For dates, run a Monte Carlo forecast from recent weekly throughput (script below, or the same logic in Google Sheets) and report P50, P85 and P95 dates. Never report a single date without its confidence.

   **Check:** The forecast states the history window used and gives a date range.

4. **Plan the iteration.** Compute capacity after holidays, on-call and meetings. Agree one sprint goal; the commitment is the goal, not every ticket. Leave slack for unplanned work based on past interrupt rates.

   **Check:** Planned work fits within measured throughput and capacity.

5. **Run the board.** Set WIP limits per column (start near team size and lower them over time). In the daily stand-up, walk the board right to left and focus on finishing work. Escalate blockers the same day and flag items whose age exceeds the usual cycle time.

   **Check:** No column exceeds its WIP limit, and every blocked item has an owner and a next action.

6. **Log risks and dependencies.** Keep the log in a shared Sheet (format below). Review it weekly. Every high risk needs an owner, a mitigation and a trigger date for escalating.

   **Check:** No high-scoring risk lacks an owner or a mitigation.

7. **Review and retro.** Demo working software to stakeholders, not slides. In the retro, review last time's actions first, then agree one to three new actions with owners.

   **Check:** Retro actions appear on the board as work items.

8. **Report status.** Use the template and RAG definitions below, weekly, at a fixed time. Draft it as an artifact for the user; send it only after explicit user confirmation.

   **Check:** The RAG colour matches the definitions, and every Amber or Red item has a recovery plan or a decision request.

## Method choice

| Situation | Use | Why |
| :--- | :--- | :--- |
| Product work with a stable team and goal-based increments | Scrum (1-2 week sprints) | Fixed cadence for planning, review and improvement |
| Interrupt-heavy work (support, ops, platform) | Kanban | Continuous flow; WIP limits and cycle time instead of commitments |
| Product team with frequent interrupts | Scrumban | Sprint cadence for reviews, Kanban flow and WIP limits inside |

## Monte Carlo forecast

```python
import random

weekly = [4, 6, 3, 5, 7, 2, 5, 6]  # items finished per week, recent history (must include non-zero weeks)
remaining, runs = 40, 10_000
results = []
for _ in range(runs):
    done = weeks = 0
    while done < remaining:
        done += random.choice(weekly)
        weeks += 1
    results.append(weeks)
results.sort()
for p in (50, 85, 95):
    print(f"P{p}: {results[int(runs * p / 100) - 1]} weeks")
```

Run it with `run_command` (`python forecast.py`, or `py forecast.py` on Windows). Re-run weekly as history and scope change; scope growth is the usual reason forecasts slip.

## Risk log format

| ID | Risk (cause, event, effect) | Probability 1-5 | Impact 1-5 | Score | Owner | Mitigation | Trigger date | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| R1 | Because <cause>, <event> may happen, causing <effect> | 3 | 4 | 12 | <name> | <action> | <date> | Open |

## Status report

```markdown
**Project:** <name> | **Week of:** <date> | **Status:** Green / Amber / Red
**Forecast:** P50 <date>, P85 <date> (was <previous>)
**Done this week:** <outcomes, not activities>
**Next week:** <outcomes>
**Risks and blockers:** <ID, one line, owner, ask>
**Decisions needed:** <decision, from whom, by when>
```

RAG: **Green** on track for scope and date; **Amber** at risk, and the team has a recovery plan; **Red** will miss without a decision or help from outside the team.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Promise a single date | Give P50/P85 ranges from throughput | Single dates hide uncertainty and become commitments |
| Compare velocity across teams | Use it only for a team's own planning | Points are relative per team; comparison invites inflation |
| Start more work when blocked | Swarm on the blocker or finished-but-unreviewed work | More WIP lengthens every item's cycle time |
| Watermelon status (green outside, red inside) | Apply RAG definitions literally | Late bad news removes options |
| Retro actions that vanish | Put them on the board with owners | Unowned actions repeat the same retro |
| Horizontal slices (all backend, then all UI) | Vertical slices that deliver a working path | Nothing is releasable until the end |

## Verification checklist

- [ ] Method and cadence are written down.
- [ ] Next-iteration items meet the definition of ready.
- [ ] Forecasts are ranges from measured throughput.
- [ ] WIP limits exist and blocked items have owners.
- [ ] Every high risk has an owner, mitigation and trigger date.
- [ ] Status report follows the RAG definitions and was sent only after explicit user confirmation.

## Related

- Knowledge: `roadmap-prioritization`, `okrs`, `product-requirements`, `meeting-facilitation`, `spreadsheet-modeling`.
- Workflows: `/issue-triage`, `/release-management`, `/write-spec`.
- Agents: `planner`, `product-manager`, `chief-of-staff`.
