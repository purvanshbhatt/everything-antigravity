---
name: customer-support
description: >-
  Sets up and runs customer support operations: channel and volume mapping,
  ticket taxonomy and triage, priority matrices, SLAs, macros and saved
  replies, drafting replies for human approval, escalation to engineering,
  knowledge base articles, quality review, CSAT and the feedback loop from
  tickets to the roadmap. Use when the user is working a support inbox,
  drafting customer replies, designing SLAs or help-center content, or turning
  tickets into product insight.
---

# Customer Support

Support is a product surface and a research channel. Answer fast and
accurately, fix the causes behind repeat contacts, and route what customers
say back to the people who decide what to build.

## When to use

- "Help me answer these support emails", "draft a reply", "triage this inbox".
- Designing ticket categories, priorities, SLAs or escalation paths.
- Writing macros, saved replies or help-center articles.
- Producing a weekly report of customer issues for product and engineering.

## When not to use

- A live outage affecting many customers: `incident-response` first, then support comms.
- Turning a bug report into an engineering ticket: `/issue-triage`.
- Running a community forum or Discord: `community-management`.
- Automated product emails (receipts, password resets): `transactional-email`.

## Workflow

1. **Map channels and volume.** List channels (email, chat, in-app, forum, social) and export recent tickets. Categorize a sample by reason to find the top contact drivers.

   **Check:** Volume per channel and the top ten contact reasons come from data, not guesses.

2. **Define the taxonomy and priorities.** Create a small set of reason tags (bug, how-to, billing, account access, feature request, outage, other) and the priority matrix below.

   **Check:** Two people tagging the same 20 tickets mostly agree; merge tags they confuse.

3. **Set SLAs you can staff.** Define first response, update cadence and resolution targets per priority and plan, with business hours stated. Publish only targets the current team can meet.

   **Check:** Every SLA target is covered by the staffing schedule, including weekends and holidays if promised.

4. **Build macros.** Each macro has variables for personalization, the policy or article it relies on, and a "do not use when" note. Store them in the help desk (Zendesk, Freshdesk, Help Scout, Intercom) or as Gmail templates for small teams.

   **Check:** No macro goes out without at least one personalized line.

5. **Triage and draft with human approval.** Read the queue through the connected Gmail or help-desk tools, classify each ticket, and draft replies as Gmail drafts or internal notes. Never send, close, refund or promise dates on the user's behalf; present drafts and wait for explicit approval. Never ask customers for passwords or full card numbers; redact sensitive data in notes.

   **Check:** Each draft cites the article or policy it relies on, and nothing was sent without the user's confirmation.

6. **Escalate to engineering with a complete report.** Include steps to reproduce, account or workspace ID, environment, expected versus actual, frequency, number of affected customers and business impact. Hand off through `/issue-triage` and agree an update cadence with the customer.

   **Check:** Every escalated ticket links to an issue, and the customer has a date for the next update.

7. **Write knowledge-base articles from the top contact reasons.** Use the template below and review articles after every relevant product change.

   **Check:** Each of the top contact reasons has a current article, linked from the matching macro.

8. **Close the loop weekly.** Report tag counts and trends, top themes with example tickets, feature requests with requester counts (and revenue where available), and CSAT comments. When a fix or feature ships, draft notifications to affected customers for the user to approve.

   **Check:** The report reached product and engineering, and requests are linked to roadmap items or marked declined.

9. **Review quality.** Score a weekly sample of tickets per agent against the rubric (accuracy, completeness, tone, policy, next step).

   **Check:** Review findings feed macro and article updates.

## Priority matrix

| Priority | Definition | Examples |
| :--- | :--- | :--- |
| P1 Urgent | Many customers blocked, data loss, security, payments failing | Login down, data exposure, charges failing |
| P2 High | Major function broken for a customer, no workaround | Export fails for an account, integration broken |
| P3 Normal | Minor bug with workaround, or how-to question | Formatting issue, "how do I...?" |
| P4 Low | Feedback, feature requests, cosmetic | "It would be nice if..." |

SLA template (fill with targets you can staff):

| Priority | First response | Update cadence | Resolution target | Coverage |
| :--- | :--- | :--- | :--- | :--- |
| P1 | *<target>* | *<target>* | *<target>* | *<hours>* |
| P2 | *<target>* | *<target>* | *<target>* | *<hours>* |
| P3 | *<target>* | As needed | *<target>* | Business hours |
| P4 | *<target>* | None | Logged, no fix commitment | Business hours |

## Reply structure

1. Acknowledge the specific situation in one line (not "We apologise for any inconvenience").
2. Give the answer or next step first.
3. Number the steps if there are several; link the article.
4. Set an expectation: what happens next and by when.
5. Ask at most one question, only if needed to proceed.

## Knowledge-base article template

```markdown
# <Task phrased as the customer would search it, e.g. "Reset two-factor authentication">
Applies to: <plans, platforms>    Last reviewed: <date>
## Before you start   <permissions or prerequisites>
## Steps              1. ... 2. ... (one action per step, with UI labels in bold)
## What you should see
## Troubleshooting    <symptom: fix> pairs for the top failure modes
## Related articles
```

## Metrics

| Metric | Watch for |
| :--- | :--- |
| First response time, time to resolution (median and 90th percentile) | Averages hide long tails |
| CSAT and its comments | Low response rates; read the comments |
| Reopen rate | Closing tickets to meet SLAs |
| Backlog age | Old tickets nobody owns |
| Contacts per active customer | Rising contact rate signals product problems |
| Self-service resolution (article views without tickets) | Articles that are viewed but still produce tickets |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Send drafted replies without review | Draft, then send only after approval | Wrong answers and promises are hard to retract |
| Close tickets to hit SLA | Track reopens; measure resolution honestly | Customers come back angrier |
| Let feature requests vanish | Tag, count and link them to roadmap items | Product loses its best source of demand signals |
| Promise fix dates | Promise the next update time | Engineering dates slip; update commitments do not have to |
| Ask for passwords or card numbers | Use secure verification flows | It creates security and PCI exposure |
| Write robotic macros | Personalize at least one line | Customers notice and escalate |

## Verification checklist

- [ ] Top contact reasons and volumes come from ticket data.
- [ ] Priorities and SLAs are defined and staffable.
- [ ] Every drafted reply cites its source and was sent only after user approval.
- [ ] Escalations link to issues with complete reproduction details.
- [ ] Top contact reasons have current articles.
- [ ] A weekly feedback report reaches product and engineering.

## Related

- Knowledge: `knowledge-management`, `documentation-writing`, `product-analytics`, `roadmap-prioritization`, `incident-response`, `community-management`, `transactional-email`, `gdpr-privacy`.
- Workflows: `/issue-triage`.
- Agents: `chief-of-staff`, `technical-writer`.
