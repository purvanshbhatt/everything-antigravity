---
name: product-analytics
description: >-
  Designs product analytics: question-driven tracking plans, event naming
  taxonomy, identity and consent, North Star and input metrics, activation,
  funnels, retention cohorts, engagement ratios, dashboards and data QA in GA4
  and BigQuery, Amplitude, Mixpanel or PostHog. Use when the user asks what to
  track, how to name events, why a funnel drops, how to measure retention or
  activation, or which metric should be the North Star.
---

# Product Analytics

Instrument the decisions you need to make, not every click. A small, well-named,
verified event set with clear metric definitions beats a large autocaptured
stream that nobody trusts.

## When to use

- "What should we track?", "write a tracking plan", "how should we name events?".
- Defining a North Star metric, activation, retention or engagement.
- Investigating a funnel drop or a retention change.
- Choosing an analytics tool, or cleaning up an inconsistent event schema.

## When not to use

- Testing whether a change caused an effect: `ab-testing`.
- Revenue per customer, CAC and LTV: `unit-economics`.
- Warehouse modelling, pipelines and table design: `bigquery` and `data-warehouse-modeling`.
- Open-ended exploration of a dataset: `exploratory-data-analysis`.

## Workflow

1. **List the questions first.** Write the 5-10 decisions the team needs data for (for example "which onboarding step loses the most new users?").

   **Check:** Every event in the eventual plan answers at least one listed question.

2. **Choose the North Star and input metrics.** The North Star reflects value delivered to customers, leads revenue, and can be influenced by the team. Break it into input metrics: breadth (how many users), depth (how much), frequency (how often) and efficiency (how fast).

   **Check:** The North Star has a precise definition: unit, time window, filters, and what counts as "active".

3. **Write the tracking plan.** Keep it in a Sheet or a versioned YAML file in the repo. Name events as Object plus past-tense Action ("Project Created"), properties in `snake_case`, one event per meaningful action, with variants as properties rather than new events.

   **Check:** No synonyms (Signup, Sign Up, Registered); every event has a trigger, typed properties and an owner.

4. **Handle identity and consent.** Merge anonymous IDs to a user ID at signup or login; add an account or group ID for B2B. Gate collection on consent where required (for example Google Consent Mode for GA4). Keep emails, names and free text out of event properties.

   **Check:** A privacy review per `gdpr-privacy` is recorded, and consent gating was tested in staging.

5. **Implement behind one module, then QA.** Send business-critical facts (signup, payment, plan change) from the server after the database commit; send UI interactions from the client. Wrap the SDK in one typed module so event names come from a single definition. Use the tool's debugger (GA4 DebugView or the live event views in Amplitude, Mixpanel and PostHog).

   **Check:** Each event fires exactly once per action in staging with the right properties, and daily counts reconcile with database ground truth within an agreed tolerance.

6. **Build the core analyses.** Activation, the main funnel, retention cohorts and engagement, each with a definition note under the chart.

   **Check:** Each chart states its population, window and definition; someone else can reproduce the number.

7. **Publish a dashboard and a review rhythm.** One owner, metric definitions on the dashboard, release annotations, and a weekly review. Use `data-storytelling` for leadership summaries.

   **Check:** The dashboard has an owner, definitions and annotations for the last few releases.

8. **Maintain the schema.** Version the tracking plan, deprecate events explicitly, and add automated checks for volume drops and schema drift (`data-quality`).

   **Check:** Every change to the plan has a date, an author and a migration note.

## Tracking plan example

| Event | Trigger | Properties (type) | Questions answered |
| :--- | :--- | :--- | :--- |
| `Account Created` | Server, after user row commit | `signup_method` (enum), `referrer` (string), `plan` (enum) | Signup sources, funnel entry |
| `Project Created` | Server, after project commit | `project_id` (string), `template` (string or null), `source` (enum: blank, template, import) | Activation, template value |
| `Invite Sent` | Server | `project_id`, `invitee_role` (enum) | Collaboration depth |
| `Subscription Started` | Billing webhook, after verification | `plan`, `interval` (enum), `trial` (bool) | Conversion, revenue funnel |

## Metric definitions

| Metric | Definition to write down |
| :--- | :--- |
| Activation rate | Share of new signups who reach the value action (the "aha" event) within *N* days of signup |
| Funnel conversion | Ordered steps within a time window; report step-to-step and overall |
| N-day retention | Share of a cohort active exactly on day (or week) *N*; unbounded retention counts on or after *N*; say which |
| Stickiness | DAU / MAU (or WAU / MAU for weekly products) |
| Feature adoption | Share of active users who used the feature in the period |
| Revenue retention | NRR and GRR by cohort; see `unit-economics` |

## Weekly retention from the GA4 BigQuery export

```sql
-- Replace <project> and <dataset>; restrict _TABLE_SUFFIX to control scan cost.
WITH events AS (
  SELECT user_pseudo_id, event_name, PARSE_DATE('%Y%m%d', event_date) AS d
  FROM `<project>.<dataset>.events_*`
  WHERE _TABLE_SUFFIX BETWEEN '20260101' AND '20260331'
),
cohorts AS (
  SELECT user_pseudo_id, DATE_TRUNC(MIN(d), WEEK) AS cohort_week
  FROM events WHERE event_name = 'first_visit' GROUP BY 1
),
activity AS (
  SELECT DISTINCT user_pseudo_id, DATE_TRUNC(d, WEEK) AS active_week FROM events
)
SELECT c.cohort_week,
       DATE_DIFF(a.active_week, c.cohort_week, WEEK) AS week_n,
       COUNT(DISTINCT a.user_pseudo_id) AS active_users
FROM cohorts c JOIN activity a USING (user_pseudo_id)
WHERE a.active_week >= c.cohort_week
GROUP BY 1, 2
ORDER BY 1, 2;
```

Divide each row by the week-0 count for the same cohort to get retention rates. Swap `first_visit` for your own signup event when users must register.

## Tool choice

| Tool | Fits when |
| :--- | :--- |
| GA4 with BigQuery export | Web and app marketing analytics; raw events in your warehouse |
| Amplitude or Mixpanel | Behavioural cohorts, funnels and retention for product teams |
| PostHog | Open source or self-hosted, with session replay and feature flags in one tool |
| Warehouse-native (BigQuery, dbt, Looker Studio) | One source of truth joined with billing and CRM data |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Rely on autocapture alone | Define explicit events for key actions | Autocaptured clicks break when the UI changes |
| Name events after UI ("Blue Button Clicked") | Name the user action ("Report Exported") | UI-named events lose meaning after redesigns |
| Put emails or names in properties | Use IDs; keep PII out of analytics | Privacy exposure and deletion requests become hard |
| Report cumulative signups or pageviews as progress | Report rates, active users and retention | Cumulative curves always rise |
| Track revenue events only in the browser | Send them from the server after commit | Ad blockers and retries make client revenue unreliable |
| Change a metric definition silently | Version definitions and annotate the dashboard | Trend breaks get misread as real changes |

## Verification checklist

- [ ] Every event maps to a listed question.
- [ ] The North Star and input metrics have written definitions.
- [ ] The tracking plan has consistent naming, typed properties and owners.
- [ ] Consent and PII handling passed a privacy review.
- [ ] Events were verified in staging and reconciled with database counts.
- [ ] Dashboards show definitions, owners and release annotations.

## Related

- Knowledge: `ab-testing`, `okrs`, `unit-economics`, `bigquery`, `data-quality`, `data-warehouse-modeling`, `data-visualization`, `data-storytelling`, `exploratory-data-analysis`, `gdpr-privacy`.
- Agents: `data-analyst`, `data-engineer`.
