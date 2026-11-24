---
name: runbooks-oncall
disable-model-invocation: true
description: >-
  Designs on-call that people can sustain: symptom-based alerts with SLO
  burn-rate thresholds, page versus ticket routing, runbooks with diagnosis and
  safe mitigation steps, escalation policies, rotations and handoffs, alert
  reviews and toil reduction. Use when setting up or fixing on-call, when
  alerts are noisy or unactionable, when an alert has no runbook, or when
  writing a runbook for a service.
---

# Runbooks and On-call

Every page must be urgent, actionable and tied to user impact, and every page
must link a runbook that a tired engineer can follow at 3 a.m. Anything else is
a ticket, a dashboard or deleted.

## When to use

- Creating alerting and on-call for a new service, or onboarding a team to a rotation.
- Pager fatigue: many pages, many ignored, or pages with no clear action.
- An alert fires and nobody knows what to do; a runbook is missing or stale.
- Monthly or quarterly on-call health reviews and toil reduction planning.

## When not to use

- An incident is happening now: use `incident-response`.
- Writing up a finished incident: use `/postmortem`.
- Instrumenting metrics, traces and logs: use `observability-otel` first; alerts need good signals.
- Building self-service tooling to remove toil at scale: use `platform-engineering`.

## Workflow

1. **Inventory alerts.** Export every alert policy with its query, threshold, notification channel and last 90 days of firings (Cloud Monitoring: `gcloud monitoring policies list`, which some gcloud versions expose under `alpha` or `beta`). Put them in a table artifact.

   **Check:** Each alert row has an owner, a firing count and an "action taken" column from the incident or pager history.

2. **Classify each alert.** Page only if a human must act within minutes to prevent or end user impact. Ticket if it can wait for working hours. Delete if no one acted on it in the last 90 days, or if it duplicates another alert.

   **Check:** Every alert is marked page, ticket or delete, with a one-line reason.

3. **Alert on symptoms with burn rates.** Replace cause alerts (CPU, pod restarts) with SLO alerts on what users feel: availability, latency, freshness. Use multi-window burn rates so short spikes do not page and slow leaks still do.

   | Budget consumed | Long window | Short window | Burn rate | Route |
   | :--- | :--- | :--- | :--- | :--- |
   | 2% | 1 h | 5 min | 14.4 | Page |
   | 5% | 6 h | 30 min | 6 | Page |
   | 10% | 3 days | 6 h | 1 | Ticket |

   The alert fires only when both the long and short windows exceed the burn rate. Keep cause signals on dashboards for diagnosis.

   **Check:** Every paging alert maps to an SLO, and a replay of the last month's data would have paged only for real incidents.

4. **Write a runbook per paging alert** using the template below, in the repo (`docs/runbooks/<alert>.md`), and link it from the alert's documentation field. Draft it from the code, dashboards and past incidents: delegate the reading to the `sre-engineer` subagent, then review every command yourself.

   **Check:** Every paging alert's notification contains a working runbook link.

5. **Test the runbook.** Walk through it in staging or during a game day with someone who did not write it. Every command must run as written, and every mitigation must name its approval rule.

   **Check:** The tester completed it without asking the author a question; gaps were fixed.

6. **Set rotation and escalation.** Primary and secondary on-call, a shift no longer than a week, at least six to eight people per rotation for sustainable load, and automatic escalation when a page is not acknowledged (for example 5 minutes to secondary, 15 minutes to the manager).

   **Check:** A test page escalates correctly through every level.

7. **Hand off every shift.** A short written note: open incidents, ongoing mitigations to undo, noisy alerts seen, risky changes scheduled.

   **Check:** The incoming engineer acknowledges the handoff note.

8. **Review monthly and cut toil.** Track the metrics below; fix or delete the top noisy alerts and automate the most repeated manual step every cycle.

   **Check:** Pages per shift and off-hours pages trend down quarter over quarter.

## Reference

### Runbook template

```markdown
# <Alert name>
**Severity / route:** page | ticket. **Owner:** <team>. **Last tested:** <date>.

## What it means
<One paragraph: which SLO is burning and what users experience.>

## Dashboards and logs
- <link to service dashboard> · <saved log query> · <trace search>

## Diagnose (read-only)
1. Check recent deploys: `gcloud run revisions list --service=<svc> --region=<region>`
2. Check dependency health: <links to status pages and dependency dashboards>
3. <Specific query or command> → if X, go to Mitigation A; if Y, Mitigation B.

## Mitigate (needs incident commander approval)
- A. Roll back: <exact command>. Expected effect: <metric> recovers within <N> min.
- B. Turn off flag `<flag>`: <how>.
- C. Scale out: <exact command and safe upper bound>.

## Escalate
- <Team or person> via <channel> if not mitigated in <N> minutes, or if data loss is suspected.

## Verify
- <SLI> back under threshold for 15 minutes; backlog <metric> draining.
```

### On-call health metrics

| Metric | Healthy target |
| :--- | :--- |
| Pages per 12-hour shift | Two incidents or fewer on average |
| Actionable pages | Above 90 percent |
| Off-hours pages | Trending down; each one reviewed |
| Time to acknowledge | Under 5 minutes for pages |
| Paging alerts with a tested runbook | 100 percent |
| Toil share of on-call time | Under 50 percent, falling |

### Toil checklist

Toil is manual, repetitive, automatable, reactive and grows with load. For each
item record frequency times duration per month, then automate the largest one
each cycle: a script first, then a self-service button, then removal of the cause.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Page on CPU, memory or single errors | Page on SLO burn rate; chart causes on dashboards | Cause alerts fire without user impact and miss impact without causes |
| Alerts with no runbook | Runbook link in every paging alert | Responders improvise under stress |
| Runbooks full of prose | Numbered commands with expected results and branches | Nobody reads paragraphs during an outage |
| Mitigations without approval rules | Mark which steps need IC approval | Unlogged production changes confuse the incident |
| Silencing noisy alerts indefinitely | Fix or delete them in the monthly review | Muted alerts hide the next real incident |
| A two-person rotation | Six to eight people, or follow-the-sun | Burnout and slow responses |

## Verification checklist

- [ ] Every alert is classified page, ticket or delete with a reason.
- [ ] Every paging alert is symptom-based, tied to an SLO and uses multi-window burn rates.
- [ ] Every paging alert links a runbook that was tested by someone else.
- [ ] Escalation was tested end to end with a test page.
- [ ] A monthly review owner and the health metrics are in place.

## Related

- Agents: `sre-engineer`, `incident-commander`, `doc-updater`.
- Workflows: `/postmortem`, `/root-cause`.
- Knowledge: `incident-response`, `observability-otel`, `platform-engineering`, `chaos-engineering`, `documentation-writing`.
