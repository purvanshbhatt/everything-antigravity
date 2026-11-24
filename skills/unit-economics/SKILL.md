---
name: unit-economics
disable-model-invocation: true
description: >-
  Calculates unit economics: gross margin with full cost of revenue, blended,
  paid and fully loaded CAC, churn, LTV, CAC payback, contribution margin by
  segment, NRR and GRR, and AI cost per user from token and infrastructure
  usage at median and heavy-user percentiles. Use when the user asks whether
  customers or channels are profitable, how to compute LTV or payback, or
  whether AI features erode margin. Not financial advice.
---

# Unit Economics

Unit economics answer one question: does each additional customer (or order,
or seat) make money, and how long does it take to earn back what it cost to
acquire? Use gross margin, not revenue; segment, do not average; and measure AI
costs from logs, not guesses. This is not financial advice; confirm accounting
treatment with a qualified accountant.

## When to use

- "What is our CAC, LTV and payback?", "is this channel profitable?".
- Deciding where to spend acquisition budget or which segment to focus on.
- AI features are live and the user asks what each user costs to serve.
- Preparing unit-economics slides for a board or investors.

## When not to use

- Company-wide forecasts, budgets and runway: `financial-modeling`.
- Setting prices, tiers and quotas: `pricing-strategy` (use this skill's numbers as input).
- Reducing model spend through routing and caching: `llm-cost-routing`.
- Cloud bill analysis and rightsizing: `finops-cost`.

## Workflow

1. **Define the unit.** Customer, account, seat, order or subscription. Use the same unit across every metric.

   **Check:** The unit and the period (monthly or annual) are written at the top of the analysis.

2. **Gather data for one consistent period.** Revenue per customer from billing, sales and marketing costs by channel, cost of revenue by component, customer counts with start and churn dates, expansion and contraction. Label estimates.

   **Check:** Every input has a source and a period, and estimates are marked.

3. **Compute gross margin with complete cost of revenue.** Include production hosting, model and API usage, third-party services per customer, payment processing, customer support and onboarding (see the cost table).

   **Check:** The cost-of-revenue list was compared against the table and each item classified.

4. **Compute CAC three ways.** Blended (all sales and marketing costs over all new customers), paid (paid channel spend over customers attributed to it) and fully loaded (including salaries, tools and agencies). Shift spend by the typical lag between spend and conversion.

   **Check:** CAC is reported by channel where attribution allows, not only blended.

5. **Measure retention and compute LTV.** Use cohort retention curves where available. Cap lifetime at a fixed horizon (for example 3-5 years) when churn is very low, so LTV does not explode.

   **Check:** LTV uses gross-margin-adjusted revenue and a stated lifetime cap.

6. **Compute payback and ratios** by segment (plan, company size, channel).

   **Check:** Payback months are reported per segment, with the segment sizes.

7. **Measure AI cost per user from logs.** Pull per-request token counts and costs from tracing (`llm-observability`), aggregate per user per month, and report P50, P90 and P99 by plan.

   **Check:** The P99 user's margin on each plan is computed; if negative, quotas or caps are proposed (`pricing-strategy`).

8. **Compute contribution margin by segment and channel.** Find segments that lose money after variable costs.

   **Check:** Negative-contribution segments are listed with the main cost driver.

9. **Present with sensitivity.** Show a table of the key metrics and how they move if churn, CAC or AI cost per user changes by a stated amount. Use `data-storytelling` for the narrative.

   **Check:** Each headline number has a definition footnote and a sensitivity range.

## Formulas

```text
ARPA (monthly)         = MRR / paying customers
Gross margin %         = (revenue - cost of revenue) / revenue
CAC (blended)          = total sales and marketing cost / new customers         (same period, lag-adjusted)
CAC (paid)             = paid channel spend / customers attributed to that channel
Logo churn (monthly)   = customers lost in month / customers at start of month
Revenue churn          = MRR lost to churn and contraction / MRR at start of month
LTV                    = ARPA x gross margin % / monthly revenue churn          (cap the lifetime)
CAC payback (months)   = CAC / (ARPA x gross margin %)
LTV : CAC              = LTV / CAC
Contribution margin    = revenue - cost of revenue - other variable costs (payment fees, variable support, per-unit fulfilment)
NRR (12 months)        = (starting MRR + expansion - contraction - churn) / starting MRR     same cohort
GRR (12 months)        = (starting MRR - contraction - churn) / starting MRR
```

Rules of thumb such as "LTV:CAC of 3:1" circulate widely; treat them as prompts for questions, not targets. Compare against your own cohorts, segment and stage.

## AI cost per user

```text
cost_per_request  = input_tokens x input_price / 1e6
                  + output_tokens x output_price / 1e6
                  + embeddings, retrieval, tool and API calls, GPU or infrastructure share
ai_cost_per_user  = sum over features of (requests per user per month x cost_per_request)
ai_margin_p99     = plan price - (non-AI cost to serve + P99 ai_cost_per_user)
```

Prices change; read current provider pricing and the actual billed amounts rather than list prices from memory. Include retries, failed calls, evaluation runs and logging overhead.

## Cost classification

| Cost | Usually | Note |
| :--- | :--- | :--- |
| Production hosting and databases | Cost of revenue | Exclude development and staging environments |
| Model and API usage serving customers | Cost of revenue | Track per feature and per plan |
| Payment processing fees | Cost of revenue or variable cost | Be consistent across periods |
| Customer support and onboarding | Cost of revenue | Often omitted, which inflates margin |
| Sales commissions, ads, marketing tools | Sales and marketing (CAC) | Include salaries for fully loaded CAC |
| R&D salaries and tools | Operating expense | Not part of gross margin |

Classification differs between companies and accounting frameworks; confirm with an accountant.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Compute LTV on revenue | Use gross-margin-adjusted revenue | Revenue-based LTV overstates value by a factor of 1 / gross margin |
| Report only blended CAC | Split by channel and segment | Blended CAC hides channels that lose money |
| Extrapolate early low churn forever | Use cohort curves and cap lifetime | Early cohorts rarely represent later ones |
| Use average AI cost per user | Report P50, P90 and P99 | A few heavy users drive most cost |
| Leave support and onboarding out of cost of revenue | Include them | Gross margin looks better than it is |
| Count spend and customers in mismatched periods | Lag-adjust spend to conversions | Payback and CAC swing with timing |

## Verification checklist

- [ ] The unit and period are defined and used consistently.
- [ ] Every input has a source; estimates are labelled.
- [ ] Gross margin includes complete cost of revenue.
- [ ] CAC is reported by channel; LTV uses margin and a lifetime cap.
- [ ] AI cost per user is measured from logs at P50, P90 and P99.
- [ ] Results include sensitivity ranges and a not-financial-advice note.

## Related

- Knowledge: `financial-modeling`, `pricing-strategy`, `llm-cost-routing`, `llm-observability`, `product-analytics`, `finops-cost`, `crm-pipeline`, `paid-advertising`, `spreadsheet-modeling`, `data-storytelling`.
- Agents: `data-analyst`, `gemini-ai-engineer`.
