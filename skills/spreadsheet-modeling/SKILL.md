---
name: spreadsheet-modeling
description: >-
  Builds robust spreadsheet models and dashboards in Excel and Google Sheets:
  inputs-calcs-outputs layout, named inputs with data validation, consistent
  formulas with XLOOKUP, SUMIFS, LET and FILTER, check cells, scenarios and
  sensitivity tables, pivot tables, dashboards, and generating workbooks from
  code. Use when designing a model, auditing a fragile spreadsheet, building
  a tracker or KPI dashboard, or turning data into a pivot-based report.
---

# Spreadsheet Modeling

A trustworthy spreadsheet separates inputs from calculations from outputs,
uses the same formula along every row, and checks itself. Most spreadsheet
errors are hard-coded numbers inside formulas, inconsistent formulas, and
broken ranges after someone inserts a row.

## When to use

- Building a forecast, budget, pricing calculator, tracker or KPI dashboard.
- Auditing a spreadsheet someone inherited before making decisions with it.
- Summarizing raw data with pivot tables and charts.
- Generating a workbook programmatically for a recurring report.

## When not to use

- Revenue builds and three-statement logic: use `financial-modeling` (it builds on this skill).
- Automating Sheets with scripts and triggers: use `google-apps-script`.
- Data too big or too messy for a sheet (hundreds of thousands of rows, joins): use `duckdb-analytics` or `bigquery`.
- Chart design for publications: use `data-visualization`.

## Workflow

1. **Start from the decision.** Write the question the model answers and sketch the output table or chart first (rows, columns, units, time grain).

   **Check:** The output sketch names every metric with its unit and period.

2. **Lay out the tabs.** `README` (purpose, owner, how to use, change log), `Inputs` (assumptions), `Data` (raw imports, never edited by hand), `Calc`, `Outputs` or `Dashboard`, `Checks`. Calculations flow left to right and top to bottom; time runs across columns consistently.

   **Check:** Every formula on `Outputs` points to `Calc` or `Inputs`, never to raw numbers.

3. **Make inputs explicit.** One assumption per cell, with a unit column and a source note. Style inputs distinctly (for example blue text or a pale fill) and name them (`TaxRate`, `ChurnMonthly`). Add data validation: lists for categories, numeric bounds for rates (0 to 1), dates within range.

   **Check:** Changing any input cell changes outputs; no assumption is typed inside a formula (search formulas for literals like `*1.2` or `/12`).

4. **Write consistent, readable formulas.** One formula per row or column, filled across. Prefer `XLOOKUP` (or `INDEX`/`MATCH`) over `VLOOKUP` with hard-coded column numbers; `SUMIFS` over helper columns; `LET` to name intermediate values. Use Excel Tables or bounded named ranges so inserts extend formulas. Avoid volatile functions (`OFFSET`, `INDIRECT`, `NOW`, `TODAY`, `RAND`) in large models.

   **Check:** Formula view (Ctrl+`) shows identical formula patterns along each row.

5. **Build checks.** A `Checks` tab with balance checks (totals equal the source), row-count checks against raw data, an error count (`=SUMPRODUCT(--ISERROR(Calc!A1:Z500))`), and a master flag shown on the dashboard. Avoid `IFERROR` around whole calculations; it hides real errors.

   **Check:** The master flag reads OK, and deliberately breaking one input makes it fail.

6. **Add scenarios and sensitivity.** A scenario table (Base, Low, High) with a selector cell and `XLOOKUP`/`CHOOSE` feeding the live inputs; a sensitivity grid (two inputs vs one output) via Excel's What-If Data Table or explicit formulas in Sheets.

   **Check:** Switching scenarios changes outputs in the expected direction and magnitude.

7. **Summarize and present.** Pivot tables for exploration; a dashboard with few KPIs (current value, change, target), one chart per question, conditional formatting for exceptions, slicers or dropdown filters. Freeze headers, protect formula ranges, and leave input cells editable.

   **Check:** A stakeholder can answer the original question from the dashboard in under a minute.

8. **Generate workbooks from code when the report recurs.** Python `openpyxl` writes values, formulas, styles, named ranges and validation, but does not calculate formulas; values appear after the file is opened and saved in Excel, Sheets or LibreOffice. For Sheets, use the Sheets API or Apps Script. Keep raw data as CSV alongside for reproducibility.

   **Check:** The generated file opens without repair prompts and the checks tab passes after recalculation.

## Formula reference

| Task | Excel 365 | Google Sheets |
| :--- | :--- | :--- |
| Lookup | `=XLOOKUP(A2, Prices[SKU], Prices[Price], "missing")` | Same function |
| Conditional sum | `=SUMIFS(Sales[Amt], Sales[Region], "EU", Sales[Date], ">="&Start)` | Same with ranges |
| Name intermediates | `=LET(rev, B2*C2, cost, D2, rev-cost)` | Same |
| Filter rows | `=FILTER(Orders, Orders[Status]="Open")` | `=FILTER(A2:D, D2:D="Open")` |
| Distinct sorted list | `=SORT(UNIQUE(Sales[Region]))` | Same |
| SQL-style summary | PivotTable or Power Query | `=QUERY(A1:D, "select A, sum(D) where B = 'EU' group by A", 1)` |
| Reusable function | `LAMBDA` in Name Manager | `LAMBDA` as a Named function |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Hard-code numbers in formulas | Named input cells with units and sources | Hidden assumptions never get updated |
| Different formulas along one row | One pattern filled across | Overrides hide inside "consistent" rows |
| `VLOOKUP(..., 3, FALSE)` | `XLOOKUP` or `INDEX`/`MATCH` | Inserting a column silently shifts results |
| Merged cells in data ranges | Center-across-selection or layout outside data | Breaks sorting, filters and references |
| `IFERROR(..., 0)` everywhere | Fix the cause; flag errors on a checks tab | Zeros masquerade as real values |
| Paste new data over formulas | Raw `Data` tab feeding `Calc` | Formulas get overwritten silently |

## Verification checklist

- [ ] README states purpose, owner, usage and change log.
- [ ] Inputs are named, styled, validated and sourced; no literals in formulas.
- [ ] Formulas are consistent along rows and columns.
- [ ] Checks tab passes and fails when deliberately broken.
- [ ] Scenarios and sensitivity behave as expected.
- [ ] Dashboard answers the original question; formula ranges are protected.

## Related

- Knowledge: `google-apps-script`, `financial-modeling`, `unit-economics`, `data-visualization`, `duckdb-analytics`, `exploratory-data-analysis`, `data-storytelling`.
- Agents: `data-analyst`.
