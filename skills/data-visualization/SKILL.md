---
name: data-visualization
disable-model-invocation: true
description: >-
  Designs and builds charts and dashboards: choosing the chart for the
  question, honest scales, colour and labelling rules, library choice among
  D3, Recharts, ECharts, Vega-Lite, Observable Plot and Chart.js, SVG vs canvas
  vs WebGL by data size, accessible charts with text alternatives and data
  tables, and performance for large or live data. Use when adding a chart,
  building a dashboard, or reviewing a visualization for clarity or
  accessibility.
---

# Data Visualization

Every chart answers one question for one audience. Pick the encoding that
makes the answer obvious, label it so it stands alone, render it with a
library sized to the data, and give non-visual users the same answer.

## When to use

- Adding a chart, sparkline, KPI tile or dashboard to an app.
- Choosing a charting library or renderer for a data size.
- A chart is misleading, cluttered, slow, or inaccessible.

## When not to use

- Narrative reports and executive summaries: use `data-storytelling`.
- Exploring a dataset to find patterns: use `exploratory-data-analysis`.
- Internal BI over warehouse tables: Looker Studio or Looker on top of `bigquery` is usually cheaper than custom code.
- Maps and spatial layers: use `geospatial-gis`.

## Workflow

1. **Write the question and audience first.** "Which region missed its Q3 target, and by how much?" for regional managers. Pick the chart from the table below.

   **Check:** Each chart has a one-sentence question and a named audience.

2. **Shape data at the right grain.** Aggregate on the server (SQL or BigQuery) to exactly what is drawn; never ship raw events to the browser to sum. Use tidy rows (one observation per row), decide how nulls render (gap vs zero), fix one time zone, and sort categorical bars by value unless the categories have a natural order.

   **Check:** Payload size is proportional to the marks drawn, not to the raw table.

3. **Choose the library and renderer.** See the library table. Rule of thumb: SVG up to a few thousand marks, canvas to the hundreds of thousands, WebGL beyond.

   **Check:** The renderer choice is justified by mark count measured on real data.

4. **Encode honestly.** Bars start at zero; small multiples share scales; avoid dual y-axes, 3D and pie charts with more than five slices. Use at most six or seven categorical colours, grey for context and one accent for the point. Label directly instead of using legends where possible, put units and source in the subtitle, and format numbers with `Intl.NumberFormat` (for example `notation: 'compact'`).

   **Check:** A colleague can state the chart's answer in five seconds without the legend.

5. **Make it accessible.**
   - Give each chart a title, a one-sentence takeaway and a data table (visible or behind a toggle).
   - For SVG, use `role="img"` with `aria-labelledby` pointing at the title and takeaway, or wrap it in `<figure>` with `<figcaption>`.
   - Never rely on colour alone: add direct labels, shapes or patterns; use colour-blind-safe palettes (Okabe-Ito, viridis).
   - Marks need 3:1 contrast against the background (WCAG 1.4.11); text needs 4.5:1.
   - Interactive tooltips must also be reachable by keyboard, or the data table must contain the same values.
   - Disable animated transitions under `prefers-reduced-motion`.

   **Check:** A screen reader announces the takeaway; a grayscale screenshot still distinguishes series.

6. **Engineer for performance.** Downsample long time series (LTTB or min/max per pixel), aggregate or window live streams, batch real-time updates to a few per second, resize with a debounced `ResizeObserver`, move heavy transforms to a Web Worker, and virtualize large data tables.

   **Check:** Interactions stay responsive with production-sized data on a throttled CPU.

7. **Lay out dashboards for scanning.** Most important KPIs top-left with comparison (vs target or prior period), global filters at the top, one consistent time range, per-tile loading, empty and error states, a last-updated timestamp, and drill-down rather than more tiles.

   **Check:** Each tile shows a sensible state when its query is slow, empty or failing.

8. **Review visually.** Use the browser subagent to screenshot each chart at mobile and desktop widths, in light and dark themes. Add visual regression for stable charts and unit tests for data transforms.

   **Check:** Screenshots reviewed; transform tests pass.

## Patterns

### Chart choice

| Question type | Chart |
| :--- | :--- |
| Compare categories | Bar (horizontal for long labels) |
| Change over time | Line; column for few periods |
| Part of a whole | Stacked or 100% bar; pie only for 2 to 5 parts |
| Distribution | Histogram, box plot, violin, strip plot |
| Relationship | Scatter (add a trend line if justified) |
| Ranking | Sorted bar, dot plot, slope chart |
| Flow between stages | Funnel, Sankey |
| Single KPI | Big number with delta and sparkline |
| Spatial | Choropleth normalized per capita or per area |

### Library choice

| Library | Renderer | Best for |
| :--- | :--- | :--- |
| Recharts | SVG (React) | Standard business charts with modest data |
| ECharts | Canvas or SVG | Large datasets, rich interaction, dashboards |
| Vega-Lite | Canvas or SVG | Declarative specs, quick exploration, spec stored as JSON |
| Observable Plot | SVG | Concise exploratory and editorial charts |
| D3 | Your choice | Custom visuals; use its scales and shapes with your framework's rendering |
| Chart.js | Canvas | Simple charts, small bundle |
| uPlot | Canvas | Very large time series |
| deck.gl | WebGL | Massive point and geo layers |

### Accessible wrapper

```html
<figure>
  <figcaption id="wau-title">Weekly active users rose 18% over the last 12 weeks</figcaption>
  <div role="img" aria-labelledby="wau-title"><!-- chart canvas or SVG --></div>
  <details>
    <summary>Show data table</summary>
    <table><!-- same values as the chart --></table>
  </details>
</figure>
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Truncated bar axes | Start bars at zero (lines may zoom) | Exaggerates differences |
| Dual y-axes | Two aligned charts | Implies false correlation |
| Rainbow palettes for ordered data | Sequential palette | Hue has no order |
| Legend-only identification | Direct labels | Forces eye ping-pong |
| Ship raw rows to the browser | Aggregate server-side | Slow, costly, may leak data |
| Tooltip-only values | Data table alternative | Inaccessible to keyboard and screen readers |

## Verification checklist

- [ ] Each chart states its question; the chart type fits it.
- [ ] Scales are honest; colours are limited and colour-blind safe.
- [ ] Title, takeaway and data table exist; contrast meets 3:1 for marks.
- [ ] Data is aggregated server-side; performance holds at production size.
- [ ] Dashboard tiles handle loading, empty and error states.
- [ ] Screenshots reviewed at mobile and desktop, light and dark.

## Related

- Knowledge: `data-storytelling`, `exploratory-data-analysis`, `bigquery`, `accessibility-a11y`, `web-performance`, `svg-graphics`, `geospatial-gis`.
- Workflows: `/a11y-audit`, `/ui-polish`.
- Agents: `data-analyst`, `frontend-engineer`, `accessibility-auditor`.
