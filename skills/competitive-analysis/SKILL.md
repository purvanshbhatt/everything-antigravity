---
name: competitive-analysis
disable-model-invocation: true
description: >-
  Analyzes competitors and alternatives from sourced, ethically gathered public
  information: competitive sets (direct, indirect, do-nothing), capability and
  pricing matrices, positioning maps, messaging teardowns, win/loss
  interviews, sales battlecards and ongoing monitoring. Use when the user asks
  who the competitors are, how to position against them, to build a
  battlecard, or to run a win/loss analysis.
---

# Competitive Analysis

Understand the alternatives the buyer actually weighs, including doing
nothing, and describe them accurately enough that a sales rep could defend
every claim in front of the competitor's customer. Sourced, dated and fair
analysis is more useful, and less risky, than a matrix where you win every
row.

## When to use

- "Who are our competitors?", "how do we compare to X?"
- Positioning or messaging work that needs a view of the landscape.
- Building or refreshing sales battlecards.
- Understanding why deals are won or lost.
- Setting up ongoing competitor monitoring.

## When not to use

- Sizing the overall market: `market-research`.
- Defining your own positioning and brand from scratch: `brand-discovery`.
- Setting your prices: `pricing-strategy` (use this skill's pricing matrix as an input).
- Sales sequences and outreach: `sales-outreach`.

## Workflow

1. **Define the competitive set.** List direct competitors, indirect ones (different product, same job), substitutes (spreadsheets, agencies, in-house builds) and the status quo. Use lost-deal notes, CRM fields and customer interviews, not only web searches.

   **Check:** The set includes at least one substitute or the status quo, and each entry cites where it came up (deals, interviews, search).

2. **Collect evidence ethically.** Use public sources: websites, docs, pricing pages, changelogs and release notes, job postings, public reviews, filings, conference talks, community forums. Sign up for trials under your real identity and within the terms of service. Never misrepresent who you are, use pretexting, or ask former employees or customers for confidential information. For several competitors, delegate one subagent per competitor with the same evidence template, then merge. Record source link and date for every fact.

   **Check:** Every fact in the evidence sheet has a link and a date captured.

3. **Build the capability and pricing matrix.** Rows are the jobs and criteria buyers use to choose (from interviews and win/loss), not every feature. Cells are `Yes`, `Partial` or `No` with a source. Normalize pricing to one or two reference customers (for example "10 seats, annual billing") and note what is excluded.

   **Check:** Every cell has a source, and rows include at least one where a competitor is stronger.

4. **Draw a positioning map.** Pick two axes buyers actually trade off (for example "self-serve to high-touch" and "general to specialized"), place each alternative with a short justification, and look for valuable space no one owns well.

   **Check:** Each placement has a one-line rationale tied to evidence.

5. **Tear down messaging.** For each competitor: homepage headline, target persona, core promise, proof points, pricing model and calls to action. Note repeated claims across the category; those are table stakes, not differentiators.

   **Check:** The teardown identifies category table stakes and each competitor's distinct claim.

6. **Run win/loss interviews.** Interview recent decision makers from won and lost deals within a few weeks of the decision, ideally with a neutral interviewer. Ask how they found the need, which options they considered, how they evaluated, what decided it and what nearly changed their mind. Code reasons into themes. Contact customers or prospects only after explicit user confirmation.

   **Check:** Themes are counted across interviews, with separate won and lost tallies.

7. **Write battlecards** (template below), reviewed by sales and product. Keep claims factual, sourced and dated; comparative claims in public advertising must be truthful and substantiated.

   **Check:** Every competitor claim on the card has a source and a "last verified" date.

8. **Monitor.** Set a cadence (monthly light check, quarterly refresh): pricing pages, changelogs, job postings, review sites and lost-deal notes. Note changes in the evidence sheet with dates.

   **Check:** Each battlecard shows a last-verified date within the past quarter.

## Battlecard template

```markdown
# <Competitor> battlecard (last verified <date>)
**Who they are:** <one line, target customer, pricing model>
**When we win:** <situations, with evidence from win/loss>
**When we lose:** <situations, honestly>
**Their strengths:** <sourced>  **Their weaknesses:** <sourced>
**Landmines to set:** <questions that surface our strengths>
**Objection handling:** "<objection>" -> <response with proof>
**Proof points:** <customer stories, public benchmarks with links>
**Do not say:** <unsubstantiated or disparaging claims>
```

## Evidence template (per competitor)

| Field | Content |
| :--- | :--- |
| Target segment | Who they sell to, with source |
| Core promise | Headline claim, quoted from their site |
| Pricing | Plans and normalized price for the reference customer |
| Key capabilities | Rows from the matrix, with links |
| Recent changes | Changelog or release items in the last two quarters |
| Hiring signals | Roles posted that hint at strategy |
| Customer sentiment | Themes from public reviews, with counts |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| A matrix where you win every row | Honest rows chosen by buyer criteria | Sales loses credibility the moment a buyer checks |
| Unsourced claims about competitors | Link and date every fact | Stale or false claims create legal and trust risk |
| Pretexting, fake accounts or confidential leaks | Public sources and honest trials | Unethical and potentially unlawful |
| Ignore the status quo | Treat "do nothing" as a competitor | Many deals are lost to no decision |
| Build cards once | Monthly checks, quarterly refresh | Competitors change pricing and features often |
| Copy competitor messaging | Find unclaimed, valuable positions | Me-too messaging makes you interchangeable |

## Verification checklist

- [ ] The competitive set includes substitutes and the status quo.
- [ ] Every fact has a source link and capture date; nothing was gathered unethically.
- [ ] The matrix uses buyer criteria and admits competitor strengths.
- [ ] Win/loss themes are counted, and customers were contacted only after explicit user confirmation.
- [ ] Battlecards are sourced, dated and reviewed by sales and product.
- [ ] A monitoring cadence is scheduled.

## Related

- Knowledge: `market-research`, `brand-discovery`, `pricing-strategy`, `sales-outreach`, `crm-pipeline`, `copywriting`, `product-discovery`.
- Workflows: `/research-synthesis`.
- Agents: `deep-researcher` (per-competitor evidence gathering), `marketing-strategist` (positioning review).
