---
name: pdf-toolkit
disable-model-invocation: true
description: >-
  Works with PDFs end to end using open tools: inspects with pdfinfo and qpdf,
  extracts text and tables with pdftotext and pdfplumber, OCRs scans with
  ocrmypdf, merges, splits, rotates and stamps with qpdf or pypdf, reads and
  fills form fields, generates PDFs from HTML or Markdown, redacts properly,
  and renders pages to images to verify every result. Use for any task that
  reads, edits or produces a PDF file.
---

# PDF Toolkit

PDFs look simple and are not: a page can hold real text, a picture of text, form widgets, or all three, and a tool that handles one kind silently mangles another. This skill inspects the file first, picks the tool that fits the file and the task, writes to a new file, and then looks at the rendered pages before calling the job done.

**Safety rule.** Never write over the input. Put results in an `out/` folder, never pass the same path as input and output, and never use qpdf's `--replace-input`. Ask before any step that removes content (redaction, flattening, page deletion) on a document the user cares about.

## When to use

- Extracting text or tables from a PDF, or OCRing a scanned one.
- Merging, splitting, reordering, rotating, compressing, stamping or watermarking pages.
- Listing or filling form fields.
- Generating a PDF report, invoice or document from HTML, Markdown or code.
- Redacting sensitive text before sharing a PDF.

## When not to use

- Turning documents into validated JSON fields with a model: `structured-extraction`.
- Asking a model to interpret charts, photos or layouts in a PDF: `multimodal-understanding`.
- Word files: `docx-documents`. Slide decks: `presentation-slides`.
- Judging what a contract says: `contract-review`.

## Workflow

1. **Inspect before touching.**

   ```bash
   pdfinfo in.pdf              # pages, page size, encryption, producer, PDF version
   pdffonts in.pdf             # no fonts listed means no text layer: scanned pages
   pdfimages -list in.pdf      # large page-sized images also point to a scan
   qpdf --check in.pdf         # structural damage
   ```

   Classify the file: born-digital, scanned, mixed, form (AcroForm or XFA), encrypted, or damaged. Note the page count. If the poppler tools are missing, `python -c "from pypdf import PdfReader; r=PdfReader('in.pdf'); print(len(r.pages), r.is_encrypted)"` gives the basics.

   **Check:** You know the page count, whether a text layer exists, and whether there are form fields or encryption.

2. **Pick the tool** from the matrix below. Prefer CLI tools for whole-file operations and Python for per-page logic. Note licenses: poppler and Ghostscript are GPL or AGPL programs that are fine to run as tools; PyMuPDF is AGPL, so check before shipping it inside a product.

   **Check:** The chosen tool handles this file's class (a text extractor on a scan returns nothing).

3. **Run the operation into `out/`.** Use the recipes below; per-page Python recipes (tables, forms, watermarks, OCR confidence) are in [Python recipes](references/python-recipes.md).

   **Check:** The command exited 0, the output file exists, and the input file's modification time is unchanged.

4. **Verify visually.** Render the pages that changed and look at them with `view_file`:

   ```bash
   pdftoppm -png -r 80 -f 1 -l 3 out/result.pdf out/preview     # writes out/preview-<page>.png
   ```

   Also compare page counts (`pdfinfo`), spot-check text (`pdftotext out/result.pdf - | head`), and run `qpdf --check out/result.pdf`. If poppler is missing, `pypdfium2` renders pages from Python.

   **Check:** The rendered pages show what the user asked for: right order, orientation, stamps, filled values and no clipped text.

5. **Report.** State the output path, page count, what changed, and anything not preserved: bookmarks, links, form fields, digital signatures (any edit invalidates a signature), PDF/A conformance, or OCR pages with low confidence.

   **Check:** The user can tell from the report alone whether the output is safe to send.

## Tool matrix

| Task | First choice | Alternative | Watch for |
| :--- | :--- | :--- | :--- |
| Plain text | `pdftotext -layout` | pypdf `extract_text()` | Column order in multi-column layouts |
| Tables | pdfplumber `extract_tables()` | camelot (ruled tables) | Merged cells, tables split across pages |
| Scanned pages | ocrmypdf | Tesseract per page | Language packs, skew, low confidence |
| Merge, split, rotate, reorder | qpdf `--pages` | pypdf `PdfWriter` | Bookmarks and links may not carry over |
| Stamp or watermark | qpdf `--overlay` / `--underlay` | pypdf `merge_page` | Stamp page size must match |
| Compress | Ghostscript `pdfwrite` | qpdf `--object-streams=generate` | Image quality loss with Ghostscript |
| Forms | pypdf | qpdf for appearances and flattening | XFA forms, checkbox export values |
| Generate from HTML | WeasyPrint | Headless Chromium, Playwright `page.pdf()` | JavaScript needs Chromium |
| Generate from Markdown | `pandoc --pdf-engine=weasyprint` | Typst, a LaTeX engine | Fonts for non-Latin scripts |
| Render for checking | `pdftoppm -png` | pypdfium2 | Use a low resolution for quick checks |

## Recipes

**Extract text and OCR.**

```bash
pdftotext -layout -f 1 -l 5 in.pdf out/text.txt
ocrmypdf --skip-text -l eng --sidecar out/ocr.txt in.pdf out/ocr.pdf
```

`--skip-text` leaves pages that already have text alone. Add `--deskew` and `--rotate-pages` for crooked or sideways scans. `--force-ocr` rasterizes existing text and loses quality; use it only when the existing text layer is garbage. ocrmypdf writes PDF/A by default; pass `--output-type pdf` if conversion fails. Install languages for Tesseract and list them with `tesseract --list-langs`.

**Merge, split, reorder, rotate.**

```bash
qpdf --empty --pages a.pdf b.pdf -- out/merged.pdf
qpdf in.pdf --pages . 1-3,7 -- out/subset.pdf
qpdf --split-pages=1 in.pdf out/page-%d.pdf
qpdf --empty --pages in.pdf z-1 -- out/reversed.pdf
qpdf in.pdf out/rotated.pdf --rotate=+90:2,4
qpdf in.pdf --overlay stamp.pdf -- out/stamped.pdf
```

**Compress or repair.**

```bash
gs -sDEVICE=pdfwrite -dPDFSETTINGS=/ebook -dNOPAUSE -dBATCH -sOutputFile=out/small.pdf in.pdf
qpdf --linearize --object-streams=generate in.pdf out/web.pdf
qpdf in.pdf out/repaired.pdf
```

On Windows the Ghostscript binary is `gswin64c`.

**Forms.** List fields first, fill with pypdf (see [Python recipes](references/python-recipes.md)), and keep the form editable unless the user asks for a flat copy. Checkbox and radio values must be one of the field's export states (often `/Yes` or `/On`), not `True`. If the AcroForm dictionary has an `/XFA` entry, pypdf cannot fill the dynamic form reliably; say so and ask how to proceed. To flatten on request:

```bash
qpdf --generate-appearances --flatten-annotations=all out/filled.pdf out/filled-flat.pdf
```

**Generate.**

```bash
weasyprint report.html out/report.pdf
pandoc notes.md -o out/notes.pdf --pdf-engine=weasyprint
typst compile report.typ out/report.pdf
```

Set page size and margins with CSS `@page { size: A4; margin: 2cm; }`. Afterwards, `pdffonts out/report.pdf` should show every font as embedded.

**Encrypted files.** Ask the user for an unlocked copy, or have them create a password file and use `qpdf --decrypt --password-file=<file> in.pdf out/unlocked.pdf`. Never place a password on the command line, where shell history keeps it, and delete the password file afterwards.

**Redaction.** A black rectangle drawn over text is not redaction: the text stays selectable and extractable. Remove the content itself (for example PyMuPDF redaction annotations followed by applying them, mindful of its AGPL license), or rasterize the affected pages after covering them, accepting the loss of the text layer. Also strip metadata, attachments and annotations. Then prove it:

```bash
pdftotext out/redacted.pdf - | grep -i -c "jane doe"     # must print 0
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Write over the input file | Write to `out/` and keep the original | One bad run destroys the only copy |
| Extract text without checking for a text layer | Run `pdffonts` first; OCR scans | Empty output looks like an empty document |
| Report OCR text as exact | State confidence and flag weak pages | OCR misreads digits and names silently |
| Draw boxes over sensitive text | Remove the content and verify with `pdftotext` | Covered text is still in the file |
| Flatten forms by default | Keep fields editable unless asked | Flattening is irreversible for the recipient |
| Trust exit code 0 alone | Render the pages and look at them | Rotations, overlays and fills fail visually |
| Edit a signed PDF without saying so | Warn that edits invalidate signatures | The recipient may reject the document |

## Verification checklist

- [ ] The input was inspected and classified, and it is unchanged.
- [ ] The output's page count matches expectations.
- [ ] Changed pages were rendered to PNG and checked visually.
- [ ] Extracted text and tables were spot-checked against the rendered page.
- [ ] OCR confidence was reported, with weak pages named.
- [ ] Filled forms were re-read and show the intended values; XFA limits were reported.
- [ ] Redactions were proven with a text search that returns nothing.
- [ ] Fonts are embedded in generated PDFs.

## Related

- Knowledge: `structured-extraction`, `multimodal-understanding`, `docx-documents`, `presentation-slides`, `contract-review`, `browser-automation`, `gdpr-privacy`, `python-patterns`.
- Agents: `technical-writer` (document content), `security-guard` (redaction review before sharing).
