---
name: crm-pipeline
description: >-
  Designs and maintains a sales CRM and pipeline: stages defined by buyer
  commitments with exit criteria, BANT and MEDDICC or MEDDPICC qualification,
  required fields, forecast categories, weighted and coverage forecasting,
  pipeline velocity, deal reviews and data hygiene in HubSpot, Salesforce,
  Pipedrive or a Google Sheet. Use when the user sets up pipeline stages,
  qualifies deals, builds a sales forecast, cleans CRM data or prepares a
  pipeline review.
---

# CRM and Pipeline

A pipeline is only as useful as its definitions. Stages that reflect what the
buyer has committed to, required fields enforced at each gate, and a weekly
hygiene routine turn the CRM into a forecast instead of a wish list.

## When to use

- "Set up our sales pipeline", "what stages should we use?", "qualify this deal".
- Building or reviewing a forecast for the month or quarter.
- The CRM is full of stale deals, missing close dates or inconsistent stages.
- Preparing a pipeline or deal review meeting.

## When not to use

- Generating new leads and writing outreach: `sales-outreach`.
- Customer profitability, CAC and LTV: `unit-economics`.
- Company-level revenue models and budgets: `financial-modeling`.
- Automating Sheets-based CRMs with scripts: `google-apps-script`.

## Workflow

1. **Map the buying process before naming stages.** Interview reps and review won deals: what did the buyer do at each step (agree a problem, involve the economic buyer, run an evaluation, start procurement)?

   **Check:** Each proposed stage maps to an observable buyer action.

2. **Define stages with exit criteria** using the table below as a starting point.

   **Check:** Two reps independently put the same five deals into the same stages.

3. **Pick a qualification framework.** BANT suits transactional and SMB sales; MEDDICC (or MEDDPICC, adding paper process) suits complex enterprise deals. Turn its elements into CRM fields.

   **Check:** The fields required for each stage are enforced at the stage gate, not left optional.

4. **Set required fields and ownership.** For every deal: amount, close date, stage, next step with a date, source, forecast category, primary competitor, one owner. Document field definitions where reps can find them.

   **Check:** The field dictionary exists, and every open deal has an owner and a dated next step.

5. **Build the forecast.** Use forecast categories for the rep call, weighted pipeline for a cross-check and coverage for sufficiency. Derive stage probabilities from your own historical stage-to-win rates; label them as assumptions if history is thin.

   **Check:** The forecast shows commit, best case and pipeline separately, and the source of each stage probability is stated.

6. **Run the weekly hygiene routine.** Query or filter for the issues in the hygiene table and produce a report per owner. Propose fixes as a change list; apply bulk updates in the CRM only after the user approves that list.

   **Check:** The hygiene report was produced, and no bulk edit happened without approval.

7. **Run deal reviews.** For each commit and large best-case deal, walk the qualification fields and the questions below. Record risks and the next action.

   **Check:** Every commit deal has a confirmed economic buyer and a known paper process with dates.

8. **Analyze conversion, velocity and losses.** Track stage-to-stage conversion, cycle length, average deal size and categorized loss reasons. Review monthly.

   **Check:** Loss reasons use fixed categories (price, timing, competitor, no decision, fit) plus a free-text note.

## Stages (B2B example)

| Stage | Exit criteria (buyer action) |
| :--- | :--- |
| Discovery | Meeting held; buyer confirmed a problem worth solving |
| Qualified | Meets the ICP and the framework minimum: pain, access to the buyer, a timeline |
| Evaluation | Buyer agreed success criteria and the evaluation plan |
| Proposal | Buyer received pricing; decision process and decision makers are mapped |
| Commit | Verbal selection; procurement, legal or security review has started |
| Closed won | Contract signed |
| Closed lost | Lost, with a categorized reason |

## Qualification frameworks

| MEDDPICC element | Question to answer |
| :--- | :--- |
| Metrics | What measurable outcome does the buyer expect, and from what baseline? |
| Economic buyer | Who can approve the spend, and have we met them? |
| Decision criteria | What will they judge options on, technically and commercially? |
| Decision process | What steps, people and dates lead to a decision? |
| Paper process | What does procurement, legal and security review involve, and how long? |
| Identify pain | What happens if they do nothing? |
| Champion | Who inside sells for us, and have they shown it by acting? |
| Competition | What else are they considering, including building it or doing nothing? |

BANT: **B**udget (is money allocated or can it be?), **A**uthority (who decides?), **N**eed (is the problem real and urgent?), **T**imeline (when must it be solved?).

## Forecast and velocity formulas

```text
Weighted pipeline = sum(amount x stage probability)
Coverage ratio    = open pipeline closing in period / (target - closed won to date)
Pipeline velocity = (qualified opportunities x win rate x average deal size) / average cycle length in days
                    -> expected revenue per day
```

Google Sheets: `=SUMPRODUCT(D2:D200, F2:F200)` for weighted pipeline, where D is amount and F is stage probability.

## Hygiene checks

| Issue | Filter |
| :--- | :--- |
| Past close date | Open deals with close date earlier than today |
| No next step | Next step empty or its date has passed |
| Stale | No activity logged in *<N>* days |
| Stuck | Days in current stage more than twice the median for that stage |
| Missing amount | Amount empty or zero beyond Discovery |
| Orphaned | Owner left the company or is inactive |

## Deal review questions

1. What has the buyer done (not said) since the last review?
2. Who is the economic buyer, and what did they say directly?
3. What is the compelling event, and what happens if they miss it?
4. What could make this slip, and what are we doing about it?
5. What is the next step, with whom, and on what date?

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Name stages after seller activity ("Demo given") | Define stages by buyer commitments | Seller activity does not predict buying |
| Default close dates to quarter end | Set dates from the buyer's decision process | Clustered dates make forecasts meaningless |
| Keep dead deals open | Close them lost with a reason | Zombie deals inflate coverage and hide risk |
| Guess stage probabilities | Use historical rates, or label them as assumptions | Gut probabilities bias forecasts upward |
| Bulk-edit the CRM silently | Propose a change list and get approval | Bulk errors are hard to reverse and erode trust |
| Forecast from enthusiasm | Tie categories to qualification evidence | Optimism is not a buyer commitment |

## Verification checklist

- [ ] Each stage has buyer-action exit criteria that reps apply consistently.
- [ ] Required fields are enforced at stage gates and documented.
- [ ] Forecast categories, weighted pipeline and coverage are shown with probability sources.
- [ ] A weekly hygiene report exists; bulk changes were approved by the user.
- [ ] Commit deals have a confirmed economic buyer and paper process.
- [ ] Loss reasons are categorized and reviewed.

## Related

- Knowledge: `sales-outreach`, `partnerships`, `unit-economics`, `financial-modeling`, `spreadsheet-modeling`, `google-apps-script`, `customer-support`, `data-visualization`.
- Agents: `data-analyst`, `chief-of-staff`.
