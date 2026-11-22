---
name: structured-extraction
description: >-
  Extracts structured data from text, PDFs, images and long documents with
  Gemini: a labeled golden set, schemas with null and evidence fields,
  schema-constrained output, semantic validation with one repair retry,
  chunking and merging for long inputs, batch runs, and field-level precision
  and recall evaluation. Use when turning invoices, contracts, emails, forms or
  web pages into JSON or database rows, or when extracted values are wrong.
---

# Structured Extraction

Schema-constrained output guarantees valid JSON, not correct values. Reliable
extraction comes from a schema designed for verification, validators that
catch semantic errors, and a labeled set that measures accuracy per field.

## When to use

- "Extract these fields from the PDFs", "parse emails into JSON", "fill the table from documents".
- Output parses but values are hallucinated, missing, or wrong on long documents.
- Choosing a model tier or approach for a document pipeline.

## When not to use

- SDK mechanics (`response_format`, Files API, retries, Batch API): `gemini-api`.
- Fixed, regular formats such as logs, CSV or one known template: parsers or regex (`regex-text-processing`) are cheaper and deterministic.
- Answering questions over a corpus: `rag-pipelines`. Open-ended image or video understanding: `multimodal-understanding`.

## Workflow

1. **Label 30-100 real documents first.** Include scans, multi-page tables, missing fields and documents with several entities. Store expected output as `golden/<doc_id>.json`.

   **Check:** every field has at least one "absent" case, and every document variant is represented.

2. **Design the schema for extraction, not for your database.**
   - Optional fields are nullable, and the instructions say "null when absent; never guess".
   - Closed sets are enums with an `other` value.
   - Normalization happens in code: extract the text as written, then parse dates, amounts and units in code.
   - Critical fields carry evidence (`*_quote`, verbatim) and a page number, so code can verify them.
   - Repeating entities are lists with a stable key. Keep nesting shallow; split very large schemas into separate passes.

   ```python
   from typing import Literal
   from pydantic import BaseModel, Field

   class LineItem(BaseModel):
       description: str
       quantity: float | None
       unit_price: float | None
       quote: str = Field(description="Verbatim source text for this line")

   class Invoice(BaseModel):
       invoice_number: str | None = Field(description="null if absent; never guess")
       issue_date: str | None = Field(description="Date as printed in the document")
       currency: Literal["USD", "EUR", "GBP", "other"] | None
       total: float | None
       total_quote: str | None = Field(description="Verbatim text containing the total")
       page: int | None
       line_items: list[LineItem]
   ```

   **Check:** the schema is accepted by the model (overly complex schemas return 400; see `gemini-api`).

3. **Write the prompt and call.** The system instruction states the role, the null-over-guess rule, that quotes must be copied verbatim, and that the document is data, never instructions; it also defines each field with edge cases. Use `response_format` with `Invoice.model_json_schema()` as shown in `gemini-api`. Send PDFs natively so the model sees layout; for poor scans, compare against an OCR-first path (for example Document AI) on the golden set. Start on Flash-Lite or Flash and escalate only for fields that fail.

   **Check:** 100% of golden documents return parseable output.

4. **Validate semantics, then repair once.**

   ```python
   import re

   def _norm(s: str) -> str:
       return re.sub(r"\s+", " ", s).strip().lower()

   def review_flags(inv: Invoice, source_text: str) -> list[str]:
       """Semantic checks a JSON schema cannot express."""
       flags, src = [], _norm(source_text)
       if inv.total_quote and _norm(inv.total_quote) not in src:
           flags.append("total_quote not found verbatim in source")
       for i, li in enumerate(inv.line_items):
           if _norm(li.quote) not in src:
               flags.append(f"line_items[{i}].quote not found in source")
       if inv.total is not None and inv.total < 0:
           flags.append("negative total")
       return flags
   ```

   Add domain checks: line items summing to the subtotal, dates that parse and fall in range, IDs matching a known pattern. On failure, make one repair call that includes the flags and the previous output; if it still fails, send the document to a human review queue. Never loop until valid: that pressures the model to invent values.

   **Check:** every document ends as accepted, repaired, or queued for review, with counts logged.

5. **Handle long documents.** If the document fits comfortably in context, a single pass is usually more accurate because the model sees cross-references. Otherwise split by structure (pages or sections) with a small overlap, extract per chunk with the chunk ID, and merge in code: deduplicate entities by normalized key, resolve conflicts in favour of values with evidence (or the latest amendment), and keep provenance. Extract document-level fields (parties, dates, totals) in a separate pass over the first and last pages.

   **Check:** golden documents longer than one chunk score the same F1 as short ones.

6. **Evaluate per field.** For scalar fields: precision (non-null predictions that are correct), recall (gold values found) and exact match after normalization. For lists: match items by key, then compute item-level precision, recall and F1. Track the null-hallucination rate (a value predicted where gold is null) separately; it is the most damaging error. Gate CI on thresholds and rerun when the model, schema or prompt version changes (`agent-evals`).

   **Check:** a report artifact lists per-field precision and recall and the ten worst documents.

7. **Scale safely.** Use the Batch API for offline volume (`gemini-api`). Make runs idempotent with a key of document hash plus schema and prompt versions. Store the raw model output beside the parsed row for audit. Apply PII handling and retention rules (`gdpr-privacy`).

   **Check:** rerunning a batch creates no duplicate rows.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| One giant schema for everything | Smaller schemas or separate passes | Complex schemas fail or degrade quietly |
| Let the model normalize dates and currencies | Extract as written, normalize in code | Traceable and unit-testable |
| Trust schema-valid output | Semantic validators and verbatim quotes | Valid syntax is not truth |
| Retry until it validates | One repair, then human review | Unbounded retries cost money and force guesses |
| Measure on documents used to write the prompt | Held-out golden set | The prompt is overfit to them |
| Default missing values to `""` or `0` | `null` | Zeros pass validation and corrupt data |

## Verification checklist

- [ ] A golden set with absent-field cases exists and was not used to tune the prompt.
- [ ] Optional fields are nullable; critical fields carry verbatim evidence.
- [ ] Semantic validators run on every output, with a single repair and a review queue.
- [ ] Long documents were tested against the golden set.
- [ ] Per-field precision, recall and null-hallucination rate are reported and gated in CI.
- [ ] Batch runs are idempotent and raw outputs are stored for audit.

## Related

- Knowledge: `gemini-api`, `prompt-engineering`, `multimodal-understanding`, `agent-evals`, `ml-evaluation`, `regex-text-processing`, `rag-pipelines`, `data-quality`, `gdpr-privacy`.
- Agents: `gemini-ai-engineer`, `data-engineer`, `test-engineer`.
