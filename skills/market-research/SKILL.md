---
name: market-research
disable-model-invocation: true
description: >-
  Researches and sizes markets: decision framing, secondary research with
  source grading, TAM, SAM and SOM built bottom-up and checked top-down,
  survey design and sample sizes, customer interviews, and a sourced findings
  memo with confidence levels and assumptions. Use when the user asks how big a
  market is, to validate demand, design a survey, or summarize research for a
  decision.
---

# Market Research

Research exists to inform a decision, so start from the decision and the
answers that would change it. Every number carries a source, a date and a
method; every estimate shows its formula; and the final memo says how
confident it is. Never invent a figure to fill a gap: label it an assumption
and show how sensitive the conclusion is to it.

## When to use

- "How big is this market?", "is there demand for X?"
- Sizing for a business plan, pitch deck or product bet.
- Designing a survey or a customer interview round.
- Summarizing secondary research into a decision memo.

## When not to use

- Analysing specific competitors in depth: `competitive-analysis`.
- Validating a problem with a handful of users before building: `product-discovery`.
- Usability and design research: `ux-research`.
- Open-ended research on any question with citations: `/research-synthesis`.

## Workflow

1. **Frame the decision.** Write the decision this informs, the three to five questions it depends on, and for each question the answer that would change the decision.

   **Check:** Each research question links to the decision and has a "this would change our mind" threshold.

2. **Gather secondary research.** Collect figures from the highest-grade sources available (table below). Record value, unit, geography, year, source link and method for every figure in a Google Sheet. For broad gathering, delegate to the `deep-researcher` subagent with the question list and the rule that every figure needs a link; spot-check its sources yourself.

   **Check:** No figure in the sheet lacks a source, a date or a unit.

3. **Size the market.** Build bottom-up first (customers × adoption × price) and cross-check top-down (a published category total × the share that fits your segment). Show formulas in the sheet, not pasted values. Definitions and a template follow below.

   **Check:** The two methods land within a range you can explain, or the gap is explained.

4. **Run primary research where gaps remain.** Interview 8-15 target customers about current behaviour, spend and alternatives. Survey for quantification (Google Forms works for simple surveys). Include a short privacy notice with what you collect and why; get consent; contact people and send surveys only after explicit user confirmation.

   **Check:** The interview guide and survey were piloted with at least three people and revised.

5. **Analyse.** Clean responses (remove speeders, failed attention checks, duplicates), report sample sizes next to every percentage, and give margins of error. Do not report segment cuts with too few responses to mean anything.

   **Check:** Every percentage in the output shows its n.

6. **Write the findings memo** (template below) and a one-slide summary if needed. Separate facts, estimates and assumptions.

   **Check:** The memo answers each question from step 1 with a confidence level.

## Source grading

| Grade | Examples | Use |
| :--- | :--- | :--- |
| A | Government statistics, census and trade data, regulatory filings, audited company reports | Anchor numbers |
| B | Industry associations, peer-reviewed studies, established analyst firms (check the method) | Supporting numbers |
| C | Reputable press, vendor-commissioned reports with disclosed method | Context; corroborate before relying on them |
| D | Blog posts, undisclosed-method "market will reach $X" press releases | Leads to follow, never anchors |

## Market sizing

- **TAM**: total demand for the job your product does, if every possible customer bought.
- **SAM**: the part of TAM your product and business model can serve (segment, geography, channel).
- **SOM**: the share of SAM you can realistically win in a set period, given competition and capacity.

```text
Bottom-up SAM = <number of target accounts in segment> × <% with the problem> × <annual price>
Top-down check = <published category spend> × <% of spend in your segment and geography>
SOM (year 3) = SAM × <share justified by sales capacity, conversion rates and competitor shares>
```

State every input's source or label it an assumption, and add a sensitivity row showing SOM when each key assumption is halved and doubled.

## Survey design

- One idea per question, neutral wording, balanced scales, and an "other" or "not applicable" option.
- Ask about past behaviour and current spend, not hypothetical purchase intent; stated intent overstates real buying.
- Screen for the target respondent first; add an attention check; keep it under about ten minutes.
- Sample size for a proportion at 95% confidence (large population, worst case p = 0.5):

| Margin of error | Responses needed |
| :--- | :--- |
| ±10 pt | ~97 |
| ±5 pt | ~385 |
| ±3 pt | ~1,068 |

The margin applies to each segment you report, so a ±5 pt result for three segments needs about 385 per segment.

## Findings memo

```markdown
# <Research question> - findings (<date>)
**Decision informed:** <decision>
**Answer:** <one paragraph>  **Confidence:** High / Medium / Low, because <reason>
**Key evidence:** <fact, source, date> ...
**Estimates:** <TAM/SAM/SOM with formulas and sheet link>
**Assumptions:** <assumption, sensitivity>
**What would change our mind:** <evidence>
**Open questions and next research:** <list>
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Quote a huge TAM from a press release | Build bottom-up from countable customers | Inflated TAMs are ignored by investors and mislead planning |
| Fill gaps with made-up numbers | Label assumptions and show sensitivity | Fabricated figures corrupt every later decision |
| Ask "would you buy this?" | Ask what they do and spend today | Hypothetical intent overstates demand |
| Leading questions | Neutral wording, piloted | Bias produces the answer you wanted |
| Percentages without n | Show n and margin of error | Small samples look precise when they are not |
| Mix facts and estimates | Separate facts, estimates and assumptions | Readers need to know what is known |

## Verification checklist

- [ ] The decision and its change-our-mind thresholds are written down.
- [ ] Every figure has a source, date, unit and grade.
- [ ] TAM, SAM and SOM show formulas; bottom-up and top-down are reconciled.
- [ ] Surveys and interviews had consent, a privacy notice and user confirmation before sending.
- [ ] Every percentage shows its n; small segments are not over-interpreted.
- [ ] The memo states confidence, assumptions and what would change the answer.

## Related

- Knowledge: `competitive-analysis`, `product-discovery`, `ux-research`, `business-plan`, `financial-modeling`, `spreadsheet-modeling`, `pitch-deck`.
- Workflows: `/research-synthesis`.
- Agents: `deep-researcher` (source gathering), `data-analyst` (survey analysis).
