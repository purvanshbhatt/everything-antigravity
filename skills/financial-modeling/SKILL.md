---
name: financial-modeling
description: >-
  Builds startup and small-business financial models in Google Sheets or
  Excel: tab layout and formula conventions, driver-based revenue builds,
  cohort and funnel models, headcount and cost plans, base, upside and
  downside scenarios, burn and runway, three-statement basics with linked P&L,
  balance sheet and cash flow, and integrity checks. Use when the user asks for
  a financial model, revenue forecast, budget, runway or scenario analysis.
  Not financial advice.
---

# Financial Modeling

A good model is a set of explicit, sourced assumptions wired to outputs by
simple, consistent formulas. Anyone should be able to change a driver and see
what happens, and trace any output back to its inputs. This is not financial
advice: models are estimates, and decisions on tax, accounting treatment,
fundraising or investment belong with a qualified accountant or adviser.

## When to use

- "Build a financial model", "forecast revenue for the next three years", "how long is our runway?".
- Creating an operating budget or a hiring plan with cost impact.
- Testing scenarios (slower growth, higher churn, a delayed round).
- Auditing an existing spreadsheet model for errors.

## When not to use

- Per-customer economics (CAC, LTV, payback): `unit-economics`, then feed the results in here.
- Spreadsheet mechanics in general (validation, pivots, dashboards): `spreadsheet-modeling`.
- Setting prices and packaging: `pricing-strategy`.
- Bookkeeping, tax filings and statutory accounts: a qualified accountant.

## Workflow

1. **Define purpose, horizon and granularity.** A fundraising model usually runs monthly for the first one to two years and annually after that; an operating budget runs monthly for twelve months. List the questions the model must answer.

   **Check:** The README tab lists purpose, horizon, granularity, owner and the questions to answer.

2. **Lay out tabs and conventions.** README, Inputs, Revenue, Headcount, Costs, P&L, Cash flow, Balance sheet (if needed), Scenarios, Checks, Dashboard. Time runs across columns; each row holds one formula copied across. Blue text for inputs, black for formulas, green for links to other tabs. No hard-coded numbers inside formulas.

   **Check:** Every constant lives on the Inputs tab with a source or a note marking it as an assumption.

3. **Build revenue from drivers** (table below), choosing the build that matches the business. For subscriptions, track customers and MRR as a roll-forward.

   **Check:** Revenue reconciles to customers multiplied by price (or volume multiplied by rate) in every period.

4. **Build costs.** Headcount plan (role, start month, salary, on-cost percentage for taxes and benefits), cost of revenue (hosting, model and API usage, payment fees, support), operating expenses (sales and marketing, R&D, G&A). Link per-unit costs from `unit-economics`.

   **Check:** Gross margin is computed every period and compared with actuals where they exist.

5. **Link the statements when needed.** Use the linkage table below. Model deferred revenue if customers prepay annually: cash arrives before revenue is recognized.

   **Check:** The balance sheet balances (assets minus liabilities minus equity equals zero) in every period.

6. **Add scenarios.** One selector cell switches base, upside and downside; scenarios differ in a few key drivers (growth, churn, price, hiring pace), not in dozens of tweaks.

   **Check:** Switching the selector changes the outputs, and the downside scenario's runway is shown on the dashboard.

7. **Build the checks tab.** Balance check, cash never negative without a financing event, revenue reconciliation, growth rates compared with history, headcount against budget.

   **Check:** All checks return TRUE, and the dashboard shows a single "all checks pass" flag.

8. **Audit and document.** Delegate a formula audit to a subagent: inconsistent formulas within a row, hard-coded numbers, broken links, circular references, units mismatches. Update the README with key assumptions and a version log.

   **Check:** Audit findings are fixed or documented, and the version log has today's entry.

## Revenue builds

| Business | Driver chain |
| :--- | :--- |
| Self-serve SaaS | Visitors x signup rate x paid conversion x ARPA; retained by cohort |
| Sales-led SaaS | Ramped reps x quota x attainment, or qualified pipeline x win rate, x ACV |
| Usage or API | Active accounts x usage per account x price per unit |
| Marketplace | Gross merchandise value x take rate |
| E-commerce | Sessions x conversion rate x average order value; repeat purchase by cohort |
| Services | Billable staff x utilization x hours x rate |

Subscription roll-forward:

```text
MRR(t)       = MRR(t-1) + new MRR + expansion MRR - contraction MRR - churned MRR
Customers(t) = Customers(t-1) + new customers - churned customers
```

## Three-statement linkage

| Item | P&L | Cash flow (indirect) | Balance sheet |
| :--- | :--- | :--- | :--- |
| Net income | Bottom line | First line of operating cash flow | Added to retained earnings |
| Depreciation | Expense | Added back | Reduces fixed assets |
| Receivables, payables, deferred revenue | | Changes adjust operating cash flow | Working-capital balances |
| Capital expenditure | | Investing outflow | Increases fixed assets |
| Equity raised, debt drawn or repaid | | Financing flows | Equity and debt balances |
| Ending cash | | Closing balance | Cash line |

## Useful formulas (Google Sheets)

```text
Scenario pick       =CHOOSE(Inputs!$C$2, Inputs!D10, Inputs!E10, Inputs!F10)
Monthly from annual =(1+annual_rate)^(1/12)-1
Runway (months)     =cash / AVERAGE(net_burn_last_3_months)
Row consistency     select the row, then compare formulas with Ctrl+` (show formulas)
```

Use named ranges for key inputs (`churn_rate`, `price_pro`) so formulas read like sentences.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Size revenue as a share of the market | Build from drivers you can influence and measure | Top-down revenue is not testable |
| Type numbers into formulas | Reference the Inputs tab | Hidden constants are the most common model error |
| Mix monthly and annual periods in one row | Separate timelines and roll up | Mixed periods break sums and growth rates |
| Draw a hockey stick with no driver change | Tie each inflection to a named driver | Unexplained growth is not credible |
| Rely on circular references for interest | Calculate interest on opening balances | Circularity makes models unstable |
| Show cents in a five-year forecast | Round to a sensible unit | False precision implies false certainty |

## Verification checklist

- [ ] README states purpose, horizon, owner and version.
- [ ] All constants live on the Inputs tab with sources or assumption labels.
- [ ] Revenue reconciles to its drivers every period.
- [ ] The balance sheet balances and all checks pass.
- [ ] Base, upside and downside scenarios run from one selector.
- [ ] A formula audit was completed and findings resolved.
- [ ] The output states that it is an estimate, not financial advice, and recommends review by a qualified professional for decisions.

## Related

- Knowledge: `unit-economics`, `spreadsheet-modeling`, `pricing-strategy`, `pitch-deck`, `investor-updates`, `business-plan`, `finops-cost`, `google-apps-script`.
- Agents: `data-analyst`.
