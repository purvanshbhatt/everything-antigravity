---
name: partnerships
disable-model-invocation: true
description: >-
  Plans and runs partnerships and business development: partner types, ideal
  partner profiles and scorecards, integration partnerships, referral,
  reseller, co-sell and marketplace deal structures, rules of engagement,
  co-marketing and joint business plans. Use when the user asks who to partner
  with, how to structure a partner deal or revenue share, how to launch an
  integration partnership, or how to run co-marketing. Not legal advice.
---

# Partnerships

A partnership works when both sides get a measurable benefit, someone senior on
each side owns it, and there is a written plan for the first 90 days. Most
partnerships fail from neglect, not from bad terms.

## When to use

- "Who should we partner with?", "how do we structure a referral or reseller deal?".
- Launching an integration with another product or a marketplace listing.
- Planning co-marketing (joint webinar, launch post, case study) with a partner.
- Reviewing an underperforming partner program.

## When not to use

- Reviewing the partner agreement text: `contract-review`, then a qualified lawyer.
- Direct outbound to end customers: `sales-outreach`.
- Building the integration itself: `api-design` and `webhooks`.
- Developer community and advocacy programs: `developer-relations`.

## Workflow

1. **Define what partnering must achieve.** Pick one primary goal (distribution, product completeness, credibility, revenue, retention) and the metric that proves it.

   **Check:** The goal and metric fit in one sentence, for example "*<N>* partner-sourced qualified opportunities per quarter".

2. **Choose partner types** that serve the goal, using the table below.

   **Check:** Each type chosen maps to the primary goal; no type is pursued "because competitors do it".

3. **Build an ideal partner profile and a scored longlist.** Look for shared customers (account mapping with the partner, under an agreement covering data sharing), complementary products and aligned incentives. Score candidates with the scorecard.

   **Check:** Each top candidate has a score and a written "what is in it for them".

4. **Design the value exchange and deal structure.** Pick a structure from the table and model the economics in a Sheet: expected volume, payouts, your margin after payouts (see `unit-economics`).

   **Check:** Both sides' benefits are quantified with placeholders or estimates, and your margin after partner payouts is positive.

5. **Approach the partner.** Prepare a one-page brief: the joint customer problem, the integration or offer concept, what you bring, what you ask for and proposed next steps. Draft the outreach; send nothing until the user confirms recipient and text.

   **Check:** The brief is approved by the user and names a target contact with a reason.

6. **Agree terms.** Summarize terms in a short term sheet: scope, exclusivity, fees and payment terms, lead registration and ownership, IP and brand use, data sharing and privacy, support responsibilities, term and termination. Run `contract-review` for a first pass and send the agreement to a qualified lawyer. The agent never signs or accepts terms.

   **Check:** Counsel has reviewed the agreement before the user signs.

7. **Write a joint business plan and launch.** Owners on both sides, the integration build plan (API scopes, auth, listing requirements), sales enablement (one-pager, battlecard, training), a co-marketing calendar and milestones at 30, 60 and 90 days.

   **Check:** The plan is a shared Doc with named owners and dates on both sides.

8. **Review quarterly.** Measure partner-sourced and partner-influenced pipeline, integration adoption, retention of customers using the integration, and co-marketing results. Invest in partners that perform, rework or retire the rest.

   **Check:** Each partner has a quarterly review record and a continue, change or exit decision.

## Partner types

| Type | Serves | Typical mechanics |
| :--- | :--- | :--- |
| Technology / integration | Product completeness, retention | Integration, joint listing in each other's directories or marketplaces |
| Referral | Lead flow | Referral fee per closed customer |
| Reseller / distributor | Reach in markets or segments you cannot serve directly | Partner buys at a discount and resells |
| Agency / systems integrator | Implementation capacity, services-led buyers | Referral fees, partner discounts, certification |
| Cloud marketplace and co-sell | Enterprise procurement access | Listing on a marketplace such as Google Cloud Marketplace; private offers; co-sell programs (check current program terms) |
| OEM / white label | Embedded distribution | Wholesale or license fees |
| Affiliate / creator | Long-tail awareness | Commission per sale, tracked links |

## Deal structures

| Structure | How it pays | Watch for |
| :--- | :--- | :--- |
| Referral fee | One-time payment or a percentage of first-year revenue | Attribution disputes; define lead registration rules |
| Revenue share | Percentage of recurring revenue for a fixed period | Long tails of payouts; cap duration |
| Reseller margin | Partner's discount off list price | Channel conflict with your direct sales |
| Marketplace | Marketplace fee deducted from transactions | Fee levels and payout timing; check current terms |
| Co-marketing | Shared costs or market development funds | Unclear ownership of leads generated |

## Partner scorecard

| Criterion | Weight | Score 1-5 |
| :--- | :--- | :--- |
| Customer overlap or complementary audience | *<w>* | |
| Strategic fit (product, segment, region) | *<w>* | |
| Commitment (named executive sponsor, resources) | *<w>* | |
| Effort to integrate or enable | *<w>* | |
| Revenue potential | *<w>* | |
| Brand and reputational risk (inverse) | *<w>* | |

## Rules of engagement (write these down)

- Who owns a lead that both sides touched, and how leads are registered.
- How conflicts with direct sales are resolved.
- Who supports joint customers for which issues, with response targets.
- How each side may use the other's name and logo (written approval each time).
- How either side announces the partnership; both sides approve copy before anything is published.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Sign many partners with no plan | Focus on a few with a joint business plan | Unmanaged partners produce nothing and cost goodwill |
| Partner without executive sponsors | Name a sponsor on each side | Partnerships lose priority without senior owners |
| Ship an integration nobody maintains | Assign an owner, versioning and support terms | Broken integrations damage both brands |
| Leave lead ownership vague | Agree registration and attribution rules up front | Disputes over credit end partnerships |
| Use a partner's logo without approval | Get written approval for each use | Brand misuse can breach the agreement |
| Grant exclusivity early | Avoid it, or time-box it with performance conditions | Exclusivity blocks better options for years |

## Verification checklist

- [ ] One primary goal and metric are defined.
- [ ] Candidates were scored, each with a "what is in it for them".
- [ ] Deal economics were modelled and margin after payouts is positive.
- [ ] Outreach was sent only after user confirmation.
- [ ] A qualified lawyer reviewed the agreement before signing.
- [ ] A joint business plan with owners and dates exists, with quarterly reviews scheduled.

## Related

- Knowledge: `contract-review`, `unit-economics`, `crm-pipeline`, `sales-outreach`, `developer-relations`, `content-marketing`, `competitive-analysis`, `api-design`, `webhooks`.
- Agents: `marketing-strategist`, `chief-of-staff`.
