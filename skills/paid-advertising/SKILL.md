---
name: paid-advertising
description: >-
  Plans, launches and optimizes paid campaigns on Google Ads, Meta and
  LinkedIn: target CPA from unit economics, conversion tracking and consent,
  account structure, targeting limits, creative testing, budgets and pacing,
  attribution versus incrementality, and weekly reporting. Use when the user
  asks to plan or audit ad campaigns, write ad creative, set budgets, or judge
  whether ads work. Any spend needs explicit user approval.
---

# Paid Advertising

Paid ads buy attention; whether that attention is profitable depends on
tracking, economics and creative, in that order. Set the cost you can afford
per customer before spending anything, make conversions measurable, test
creative angles deliberately, and prove incrementality before scaling.

## When to use

- Planning a first campaign or a channel test.
- Auditing an existing account that "isn't working".
- Writing ad copy and creative briefs for a test.
- Setting or changing budgets, bids and pacing.
- Deciding whether ads are actually driving revenue.

## When not to use

- Unclear positioning or audience: `brand-discovery` first.
- Organic social posting: `social-media`.
- Landing page copy: `copywriting`.
- Customer acquisition cost targets and payback math in depth: `unit-economics`.
- Product launch sequencing across channels: `/marketing-launch`.

## Workflow

1. **Start from economics.** Derive the maximum affordable cost per acquisition from gross-margin lifetime value and the payback period the business accepts (see `unit-economics`). Set a capped test budget, a time window and a decision rule ("scale if CPA is under target with at least N conversions; stop if not").

   **Check:** Target CPA, test budget cap and decision rule are written before any campaign exists.

2. **Make conversions measurable.** Define one primary conversion (purchase, qualified signup, demo booked) and a few secondary ones. Install the platform tags (Google tag, Meta Pixel, LinkedIn Insight Tag) and server-side signals (Meta Conversions API, Google enhanced conversions) where available. For EEA and UK users, implement a consent banner and Google Consent Mode so tags respect choices. Fire a test conversion and confirm it registers once.

   **Check:** A test conversion appears once in each platform and matches your backend record.

3. **Choose channels by intent** (table below). Start with one or two.

   **Check:** Each channel has a reason tied to audience intent and budget.

4. **Structure the account simply.** Few campaigns with enough budget each to exit the learning phase, a consistent naming convention (`<channel>_<goal>_<audience>_<geo>_<date>`), negative keywords for search, and exclusions for existing customers and employees where appropriate.

   **Check:** Every campaign name parses with the convention and every search campaign has a negative keyword list.

5. **Respect targeting limits.** Meta's special ad categories (housing, employment, financial products and services, and social issues, elections or politics) and Google's personalized-advertising policies (for example housing, employment and credit in the US and Canada) restrict targeting. Never target or exclude by sensitive traits.

   **Check:** Campaigns in restricted categories are declared as such and use only permitted targeting.

6. **Test creative angles.** Each variant tests a different message (pain, outcome, proof, objection), not tiny wording changes. Keep message match between ad and landing page. Substantiate every claim, follow each platform's ad policies, and label AI-generated media where required.

   **Check:** Each ad set has two to four distinct angles and a matching landing page.

7. **Get approval, then launch.** Present a launch summary: campaigns, audiences, creatives, daily budget, maximum total spend, start and end dates, and the decision rule. Enable campaigns, raise budgets or change bids only after explicit user confirmation. Set account-level or campaign spending limits where the platform supports them.

   **Check:** The user approved this exact spend, and spending limits are set.

8. **Optimize weekly, prove incrementality before scaling.** Review the metrics below. Change one major variable at a time and wait for enough conversions before judging. Before a large budget increase, run an incrementality test: a holdout audience, a geographic split, or the platform's lift study.

   **Check:** The weekly report compares platform-reported conversions with backend data, and scaling decisions cite an incrementality result.

## Channel fit

| Channel | Strength | Consider when |
| :--- | :--- | :--- |
| Google Search | Captures existing intent | People already search for the problem or category |
| Performance Max, YouTube, Display | Reach across Google inventory | Search alone cannot spend the budget; strong creative assets exist |
| Meta (Facebook, Instagram) | Demand creation, visual products, broad consumer reach | A visual hook and a clear offer exist |
| LinkedIn | Targeting by job title, company and industry | B2B with high contract values that justify higher click costs |
| Reddit, X, niche networks | Specific communities | The audience clusters in those communities; creative fits the culture |

## Metrics

| Metric | Formula | Watch for |
| :--- | :--- | :--- |
| CTR | Clicks / impressions | Creative relevance; low CTR raises costs |
| CPC | Spend / clicks | Auction pressure |
| Conversion rate | Conversions / clicks | Landing page and message match |
| CPA | Spend / conversions | Compare with target CPA from step 1 |
| ROAS | Revenue / spend | Use gross margin, not revenue, for profitability |
| Frequency | Impressions / reach | Creative fatigue when rising with falling CTR |
| Incremental CPA | Spend / incremental conversions from a lift test | The number that justifies scaling |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Launch before tracking works | Fire and verify a test conversion | Unmeasured spend cannot be optimized |
| Trust platform-reported conversions alone | Reconcile with backend data and run lift tests | Platforms over-count and overlap each other |
| Many tiny campaigns | Consolidate so each gets enough conversions | Fragmented budgets never exit learning |
| Test button colours | Test distinct message angles | Small tweaks rarely produce detectable differences |
| Change five things at once | One major change per cycle | You cannot learn what worked |
| Scale on a good week | Scale after an incrementality result | Regression to the mean and attribution inflation |
| Enable spend without sign-off | Explicit user approval with a cap | Ad spend is real money and hard to recover |

## Verification checklist

- [ ] Target CPA, test budget cap and decision rule were set before launch.
- [ ] Conversions fire once and match backend records; consent handling is in place.
- [ ] Restricted categories are declared and targeting complies with policy.
- [ ] Creative variants test distinct angles with substantiated claims.
- [ ] Spend, budget increases and bid changes were explicitly approved by the user, with limits set.
- [ ] Scaling decisions cite an incrementality test.

## Related

- Knowledge: `unit-economics`, `ab-testing`, `copywriting`, `growth-marketing`, `product-analytics`, `ai-image-generation`, `gdpr-privacy`, `brand-discovery`.
- Workflows: `/marketing-launch`.
- Agents: `marketing-strategist` (channel plan and account audit).
