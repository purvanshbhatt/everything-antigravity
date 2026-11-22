---
name: data-storytelling
description: >-
  Turns analysis into decisions: frames the question and audience, picks the
  chart that matches the comparison, strips clutter, annotates the takeaway on
  the chart, builds a narrative arc and writes executive summaries that lead
  with the answer. Use when presenting data to stakeholders, turning analysis
  into a report or deck, or when a chart is accurate but nobody acts on it.
---

# Data Storytelling

An analysis is finished when the audience knows what to do next. This skill
shapes findings into a short narrative with honest charts, one highlighted
message per chart and an explicit recommendation.

## When to use

- "Make this analysis presentable", "write the exec summary", "what chart should I use?".
- Quarterly reviews, experiment readouts, incident impact summaries, board or investor metrics.
- A dashboard exists but meetings still end with "so what?".

## When not to use

- Building interactive dashboards or chart components: `data-visualization`.
- Doing the analysis itself: `exploratory-data-analysis`, `ab-testing`, `product-analytics`.
- Slide design beyond data slides: `presentation-slides`.

## Workflow

1. **Name the audience and the decision.** Who reads this, what they already know, and what decision or action it should drive. Write the big idea in one sentence with a point of view: "Churn doubled after the March price change, concentrated in annual plans; we should restore the old annual price for existing customers."

   **Check:** The big idea is one sentence, contains a "so what", and could be wrong.

2. **Select the evidence.** Keep only the analyses that support, qualify or challenge the big idea. Move the rest to an appendix. Note caveats: sample sizes, data gaps, confounders.

   **Check:** Each remaining chart answers a question the audience would ask.

3. **Pick the chart from the comparison** using the table below. Default to sorted bars and lines.

   **Check:** You can say the comparison type of each chart in two words ("change over time", "ranking").

4. **Declutter and highlight.** Remove borders, heavy gridlines, legends you can replace with direct labels, 3D and decorative colour. Use one accent colour for the data that carries the message and grey for context. Write an action title that states the finding.

   **Check:** A viewer can state the takeaway within five seconds without reading the body text.

5. **Annotate.** Mark events (launches, outages, price changes) on the chart, label the key value directly, and show uncertainty (confidence intervals, ranges) when decisions hinge on small differences.

   **Check:** Every annotation is factual and sourced from the data or a dated event log.

6. **Structure the narrative.** Use SCQA (Situation, Complication, Question, Answer) or context, tension, resolution. Put the answer and the recommendation first for executives (bottom line up front); supporting charts follow in the order the audience's questions arise.

   **Check:** The first paragraph alone gives the answer, the evidence strength and the ask.

7. **Check honesty and accessibility.** Bars start at zero; dual axes are avoided; time ranges are not cherry-picked; colour-blind-safe palettes with sufficient contrast; alt text states the takeaway, not "chart of data".

   **Check:** Someone who disagrees with the conclusion would accept the charts as fair.

## Reference

| Comparison | Chart | Avoid |
| :--- | :--- | :--- |
| Ranking | Sorted horizontal bar | Unsorted bars, pie |
| Change over time | Line (bars for few discrete periods) | Area stacks with many series |
| Part-to-whole | Stacked or 100% bar; pie only for 2-3 parts | Donuts with 8 slices |
| Distribution | Histogram, box or violin plot | Mean-only bars |
| Relationship | Scatter with trend line | Dual-axis line charts |
| Before vs after | Slope chart or dumbbell | Two separate pies |
| Geography (location matters) | Choropleth or dot map | Maps when a ranked bar would do |

Executive summary template:

```markdown
**Bottom line:** <answer + recommendation in two sentences>
**Evidence:** <the 2-3 numbers that matter, with comparison and timeframe>
**Confidence and caveats:** <sample size, known gaps, what would change our mind>
**Ask:** <decision needed, by whom, by when>
```

Action title and annotation in matplotlib:

```python
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(8, 4))
ax.plot(months, churn_pct, color="#9e9e9e")
ax.plot(months[-4:], churn_pct[-4:], color="#c62828", linewidth=2.5)
ax.axvline(price_change_month, color="#616161", linestyle="--", linewidth=1)
ax.annotate("Price change", xy=(price_change_month, max(churn_pct)), xytext=(5, 0),
            textcoords="offset points", fontsize=9)
ax.set_title("Monthly churn doubled after the March price change", loc="left", fontsize=13)
ax.spines[["top", "right"]].set_visible(False)
ax.set_ylabel("Churn (%)")
fig.savefig("churn.png", dpi=200, bbox_inches="tight")
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Title charts "Revenue by month" | Title with the finding | The title is the only text many people read |
| Show every analysis you ran | Appendix the rest | Volume hides the message and signals uncertainty |
| Truncate bar axes | Start bars at zero; use lines for small changes | Truncated bars exaggerate differences |
| Rainbow palettes | Grey plus one accent | Colour should point to the message |
| Bury the recommendation at the end | Lead with it | Executives often stop after the first paragraph |
| Present point estimates as certain | Show intervals and caveats | Overconfidence costs trust when results shift |

## Verification checklist

- [ ] The big idea is one sentence with a recommendation.
- [ ] Each chart matches its comparison type and has an action title.
- [ ] Key values are labelled directly; context is grey; one accent colour.
- [ ] Uncertainty and caveats are visible where decisions depend on them.
- [ ] Axes, ranges and baselines are honest; alt text states the takeaway.
- [ ] The executive summary stands alone.

## Related

- Knowledge: `data-visualization`, `exploratory-data-analysis`, `presentation-slides`, `product-analytics`, `ab-testing`, `accessibility-a11y`, `editing`.
- Agents: `data-analyst`.
