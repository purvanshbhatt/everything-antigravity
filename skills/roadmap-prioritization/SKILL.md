---
name: roadmap-prioritization
description: >-
  Builds and communicates product roadmaps and ranks backlogs: one intake list,
  capacity allocation, RICE, ICE, cost of delay and WSJF scoring in a sheet,
  logged overrides, now-next-later and outcome-based roadmaps, stakeholder
  alignment and saying no. Use when the user asks what to build next, how to
  score or rank features, how to structure or present a roadmap, or how to
  decline stakeholder requests.
---

# Roadmap Prioritization

A roadmap is a statement of intent tied to outcomes, not a release calendar.
Scoring frameworks make trade-offs visible and arguable; they do not make the
decision for you.

## When to use

- "What should we build next?", "rank this backlog", "score these features with RICE".
- Building a quarterly or half-year roadmap, or restructuring one that is a dated feature list.
- Many stakeholders are asking for different things and the team needs a defensible order.
- Preparing a roadmap review for leadership, the company or customers.

## When not to use

- Setting the goals the roadmap serves: `okrs` first.
- Validating whether a single idea is worth doing: `product-discovery`.
- Detailing one chosen item: `product-requirements`, then `/write-spec`.
- Sprint-level planning and estimation: `agile-project-management`.

## Workflow

1. **Anchor on outcomes.** Collect the current objectives (OKRs or strategy pillars) and the metrics they target. Each roadmap theme must serve one.

   **Check:** Every theme on the draft roadmap names the objective or outcome it moves.

2. **Build one intake list.** Pull from the issue tracker, support tags, sales requests, discovery briefs and the tech-debt register into a single Sheet. Deduplicate, phrase each item as a problem, and record source, requester count and evidence link.

   **Check:** No duplicates; each row has an evidence link or is marked "no evidence".

3. **Agree capacity allocation before scoring.** With the engineering lead, set explicit percentages for buckets such as new bets, improvements, tech debt and reliability, and bugs. Score items only against others in the same bucket.

   **Check:** Buckets sum to 100%, and the engineering lead has agreed to them.

4. **Score with one framework, consistently.** Use RICE by default, ICE for fast early-stage triage, and cost of delay or WSJF when deadlines and time sensitivity dominate. Calibrate first by scoring three well-understood past items together.

   **Check:** Each score has a one-line rationale; any item with confidence at 50% or below is flagged for discovery.

5. **Sanity-pass the ranking.** Adjust for dependencies, sequencing, strategic bets, team skills and commitments already made. Log every override with the reason and who decided.

   **Check:** The override log explains every place where the final order differs from the score order.

6. **Lay out now, next, later.** Now: committed, staffed and scoped for this cycle. Next: shaped and likely in the following one or two cycles. Later: directions phrased as problems. Give dates only for Now, or where a contract requires them.

   **Check:** Now fits the agreed capacity; Later contains problems, not detailed features.

7. **Align stakeholders.** Pre-wire key stakeholders one-to-one before the group review, share the scored sheet and the override log, and publish a "not now, and why" list. Draft the communications; send or post them only after the user confirms.

   **Check:** Every declined request has a reason and a named person who told the requester.

8. **Review on a cadence.** Re-score monthly as evidence changes and reset quarterly. Keep a changelog of what moved and why.

   **Check:** The roadmap has a "last reviewed" date and a changelog entry for each move.

## Scoring reference

```text
RICE  = (Reach x Impact x Confidence) / Effort
  Reach      users or events per period (per quarter), from data where possible
  Impact     3 massive, 2 high, 1 medium, 0.5 low, 0.25 minimal
  Confidence 100% high, 80% medium, 50% low
  Effort     total person-weeks or person-months across all disciplines

ICE   = Impact x Confidence x Ease        (each 1-10; or the average, but be consistent)

WSJF  = Cost of Delay / Job Size
  Cost of Delay = business value + time criticality + risk reduction or opportunity enablement
  (relative estimates, for example on a 1, 2, 3, 5, 8, 13 scale)
```

Google Sheets: with Reach in B, Impact in C, Confidence in D and Effort in E, use `=IFERROR(B2*C2*D2/E2,"")` and sort a copy of the range, never the source rows.

| Framework | Best for | Weakness |
| :--- | :--- | :--- |
| RICE | Growth-stage products with usage data | Reach dominates; can starve infrastructure work (use buckets) |
| ICE | Fast triage of many early ideas | Highly subjective; scores drift between scorers |
| Cost of delay / WSJF | Deadlines, regulatory dates, seasonal windows | Needs a shared value scale and discipline |
| Kano (must-have, performance, delighter) | Deciding what a release must include | Requires customer survey data |
| Opportunity scoring (importance vs satisfaction) | Finding underserved needs | Survey effort; not a ranking by itself |

## Roadmap formats

| Format | Audience | Content |
| :--- | :--- | :--- |
| Now / next / later by theme | Leadership, whole company | Themes, outcomes, the problems each solves |
| Release plan | Engineering, support, sales | Dated scope for Now only |
| External roadmap | Customers, community | Themes without dates, plus a "subject to change" note |

Saying no, in a form you can adapt: "Thanks for *<request>*. We scored it against *<objective>* and it ranked below *<items>* this cycle because *<reason>*. We will revisit at *<review date>*. If *<condition>* changes, tell us and we will re-score."

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Publish a feature list with dates twelve months out | Use now / next / later with dates only for Now | Long-range dates become broken promises |
| Score after deciding, to justify the choice | Score first, then log overrides openly | Reverse-engineered scores destroy trust in the process |
| Let the loudest customer or executive set the order | Count requesters and weigh evidence | One voice is rarely representative |
| Rank tech debt against features in one list | Protect it with a capacity bucket | Features always win single-list comparisons until reliability fails |
| Treat scores as precise | Treat close scores as ties and discuss | Inputs are estimates; false precision ends debate early |
| Keep the roadmap private to product | Share the scoring sheet and the "not now" list | Transparency reduces escalations |

## Verification checklist

- [ ] Every theme ties to an objective or outcome.
- [ ] Capacity buckets were agreed with engineering before scoring.
- [ ] All items were scored with one framework, each with a rationale.
- [ ] Overrides are logged with reasons.
- [ ] Now fits capacity, and only Now carries dates.
- [ ] Declined requests have reasons and an owner who communicated them; communications were sent only after user confirmation.

## Related

- Knowledge: `okrs`, `product-discovery`, `product-requirements`, `product-analytics`, `tech-debt`, `agile-project-management`, `spreadsheet-modeling`, `meeting-facilitation`.
- Workflows: `/write-spec`, `/issue-triage`.
- Agents: `product-manager`, `planner`.
