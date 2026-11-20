---
name: pricing-strategy
description: >-
  Designs pricing and packaging for SaaS, open-core, API and LLM-powered
  products: value metric selection, good/better/best tiers, freemium vs free
  trial, usage-based billing with model-cost pass-through, ethical price
  testing, pricing page anatomy, enterprise packaging and grandfathering. Use
  when the user asks how to price, what goes in each plan, how to bill AI
  usage, or how to change prices for existing customers.
---

# Pricing Strategy

Price on the unit of value customers recognise, package so each tier fits a
distinct buyer, and make sure the heaviest users cannot push gross margin
negative.

## When to use

- Setting prices for a new product, plan or AI feature.
- Deciding between freemium, free trial, open-core and usage-based models.
- LLM or API costs are eating margin, or one customer's usage is unbounded.
- Raising prices, restructuring tiers or moving existing customers.

## When not to use

- Positioning is unclear (who it is for, what it replaces): run `brand-discovery` first; price follows the alternative you are compared with.
- Implementing billing code (Stripe webhooks, metering pipelines): use `backend-patterns` and `api-design`, then come back for the model.
- Reducing model spend at the engineering level (routing, caching): `llm-cost-routing`.
- Tax, revenue recognition or contract law questions: refer the user to an accountant or lawyer.

## Workflow

1. **Gather unit economics and context.** Collect cost per unit of usage (infrastructure, model tokens, third-party APIs, support), the current plan mix and conversion rates, the competitive alternatives and their prices, and the go-to-market motion (self-serve, sales-led or both). Ask the user for numbers; label anything estimated.

   **Check:** You have cost per unit of the candidate value metric and the price of the main alternative.

2. **Choose the value metric** with the criteria table below. Score two or three candidates (seats, projects, API calls, compute minutes, tracked events, outcomes) against them.

   **Check:** The chosen metric scores well on alignment with value and predictability, and is measurable in your current data.

3. **Choose the acquisition model** (freemium, trial, reverse trial, open-core, sales-led) with the decision matrix.

   **Check:** The free offering has a defined upgrade trigger that users hit naturally when they get value.

4. **Design the tiers.** Good/better/best for self-serve plus an Enterprise tier. Each tier targets one persona and is separated by a fence (a limit or capability the next persona needs). Keep three or four tiers.

   **Check:** You can name the persona and the upgrade trigger for every tier, and no feature appears in a tier only "to fill the column".

5. **Model margins for usage and LLM features** with the cost formula below, at median and at P99 usage. Add guards: included quotas, overage rates, spend caps, alerts and hard limits.

   **Check:** A P99 user is margin-positive, or capped before becoming negative.

6. **Validate price points** with customers: willingness-to-pay interviews, a Van Westendorp survey (too cheap, a bargain, getting expensive, too expensive), sales-call reactions, and ethical tests only (see below).

   **Check:** Price points are backed by at least one source of customer evidence, not only competitor pages.

7. **Build the pricing page and FAQ** using the anatomy below, then hand the copy to `copywriting`.

   **Check:** A visitor can identify their tier, the full monthly cost and what happens at the limit without contacting sales.

8. **Plan migration for existing customers** (grandfathering options below) and a notice schedule. Price changes to existing customers need explicit user sign-off before any announcement.

   **Check:** Every existing plan maps to a new plan with a date, a notice message and a decision on grandfathering.

## Value metric criteria

| Criterion | Question | Bad sign |
| :--- | :--- | :--- |
| Aligned with value | Does the customer get more value as it grows? | Charging per seat for a tool one admin uses |
| Predictable | Can the buyer estimate next month's bill? | Pure per-token pricing for non-technical buyers |
| Scales with cost | Do your costs grow with it? | Flat price on unbounded compute |
| Measurable | Can you meter it reliably and show it in-app? | A metric you cannot reconcile with invoices |
| Hard to game | Will customers distort usage to avoid it? | Shared logins under per-seat pricing |

## Acquisition model matrix

| Model | Fits when | Watch out for |
| :--- | :--- | :--- |
| Freemium | Low marginal cost, network or content loop, large top of funnel | Free tier so generous nobody upgrades |
| Free trial (14 or 30 days) | Value is visible within days; sales assist available | Trials that expire before setup is finished |
| Reverse trial | Paid features drive the aha moment; then fall back to free | Must clearly say what will be removed and when |
| Open-core | Developer adoption of an OSS core; buyers pay for team, scale and compliance features | Moving existing OSS features behind a paywall breaks trust |
| Usage-based | Value and cost scale with consumption (APIs, compute, AI) | Bill shock; needs caps, alerts and a dashboard |
| Sales-led only | ACV high enough to fund a sales cycle | Hiding all prices filters out self-serve developers |

## Tier design

| | Free / Hobby | Pro (individual) | Team | Enterprise |
| :--- | :--- | :--- | :--- | :--- |
| Persona | Evaluator, side project | Professional user | Team lead | Procurement, security |
| Fence | Usage limit, 1 project | Commercial use, higher limits | Collaboration, shared billing, roles | SSO/SAML, SCIM, audit logs, SLA, DPA |
| Price shape | $0 | Flat monthly | Per seat or per workspace + usage | Annual contract, custom |

- Highlight one recommended tier. Annual billing discounts are commonly framed as "two months free" (about 17%).
- Open-core: keep anything a single developer needs in the OSS core; charge for what organisations need.
- Enterprise packaging usually includes SSO/SAML, SCIM provisioning, audit logs, data residency, uptime SLA, support response targets, DPA and security questionnaire support, invoicing and annual terms. Gating SSO only at the top tier is widely criticised ("SSO tax"); consider including basic SSO in Team.

## Usage and LLM cost model

```text
cost_per_request = (input_tokens * input_price + output_tokens * output_price) / 1,000,000
                   + retrieval/tool/infra cost per request
loaded_cost      = cost_per_request * (1 + overhead)   # retries, failed calls, evals, logging
min_price        = loaded_cost / (1 - target_gross_margin)
```

Illustrative example (made-up prices; check the provider's current pricing page): 6,000 input and 800 output tokens at $0.30 and $2.50 per million tokens cost $0.0038; with 20% overhead $0.0046; at a 75% gross-margin target the price floor is about $0.018 per request.

- Include a monthly quota in each tier, then overage per unit or prepaid credits with auto top-up off by default.
- Enforce per-account spend caps and rate limits in code, alert at 50/80/100% of quota, and show usage in-app in real time.
- Pass model price changes through only with notice; reserve the right in the terms, and re-run this model when providers change prices.
- Cache, route to cheaper models and batch where quality allows (`llm-cost-routing`) before raising prices.

## Pricing page anatomy

1. Monthly/annual toggle showing the discount.
2. Three or four tier cards: name, persona line, price, primary CTA, 4-6 key inclusions, recommended badge on one.
3. Usage explainer or calculator for metered pricing, including what happens at the limit.
4. Full feature comparison table below the cards.
5. Enterprise block with "Contact sales" and its key inclusions.
6. FAQ: billing cycle, seat changes and proration, overages, refunds, currency and tax, cancellation, open-source license.
7. Trust signals: security page, compliance reports actually held, uptime history.

## Price testing ethics

- Test on new visitors or new signups only, never by changing an existing customer's price silently.
- Prefer testing packaging, plan names, anchors and trial length over showing different prices for the same plan at the same time.
- If a customer finds they were shown a higher price in a test, honour the lower one.
- Never set prices using protected characteristics or inferred vulnerability. Where personalised pricing is used, disclose it if the law requires it (the EU requires disclosure of prices personalised by automated decision-making); check local rules.

## Grandfathering

| Option | Use when |
| :--- | :--- |
| Permanent grandfathering | Small base, strong community expectations, OSS goodwill matters |
| Time-limited (6-12 months), then migrate | Costs changed materially; give a clear date |
| Grandfather plus incentive to move | The new plan is better for most; offer a discount or added limits |

Give notice well ahead (often 30-90 days; check contract terms and local law), explain why, show each customer's new bill, and never remove paid features mid-term.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Copy a competitor's price list | Start from your value metric and costs | Their costs, segment and strategy differ |
| Offer unlimited AI usage on a flat plan | Include quotas, caps and overage | One heavy user can erase the margin of hundreds |
| Hide all prices behind "Contact us" | Publish self-serve prices; reserve custom for Enterprise | Developers leave rather than book a call |
| Move OSS features behind a paywall | Add new paid features for organisations | Re-licensing or removal triggers forks and backlash |
| Change prices without a migration plan | Grandfather or give notice with each customer's new bill | Surprise increases drive churn and public complaints |

## Verification checklist

- [ ] Cost per unit and the main alternative's price are documented.
- [ ] The value metric was scored against the criteria table.
- [ ] Every tier has a persona, a fence and an upgrade trigger.
- [ ] Median and P99 usage are margin-positive or capped.
- [ ] Price points have customer evidence behind them.
- [ ] The pricing page shows the full cost and what happens at the limit.
- [ ] Changes for existing customers have a grandfathering decision, notice dates and user sign-off.

## Related

- Knowledge: `brand-discovery`, `copywriting`, `growth-marketing`, `llm-cost-routing`, `api-design`, `backend-patterns`.
- Workflows: `/marketing-launch` (pricing page as a launch asset), `/blueprint` (metering and billing implementation plan).
- Agents: `marketing-strategist` (competitive pricing research), `gemini-ai-engineer` (token usage estimates).
