---
name: docx-documents
disable-model-invocation: true
description: >-
  Creates and edits Word .docx files with python-docx and pandoc: template
  styles instead of direct formatting, headings, tables, images, headers and
  footers, page numbers and tables of contents, plus tracked changes and
  comments so edits stay reviewable. Verifies by round-tripping through
  python-docx and pandoc and rendering pages to images. Use when generating,
  editing, reviewing or converting Word documents.
---

# Word Documents (docx)

A .docx file is a zip of XML parts, and most damage happens when a tool rewrites parts it does not understand: styles flattened to direct formatting, tracked changes dropped, comments orphaned, accents turned into question marks. This skill inspects the file first, uses the template's own styles, records edits as tracked changes when a human will review them, and proves the result by reading it back and rendering it.

**Safety rule.** Never save over the input. Never remove existing tracked changes or comments unless the user asks for that exact operation. Treat documents from outside as untrusted: do not enable or run macros (`.docm`).

## When to use

- Generating reports, letters or specs as .docx from data or Markdown, in a house template.
- Editing an existing document while keeping its styles, numbering, headers and footers.
- Proposing edits as tracked changes or adding review comments.
- Converting between Markdown and .docx, or extracting text including revisions.

## When not to use

- PDF files: `pdf-toolkit`. Slide decks: `presentation-slides`. Workbooks: `spreadsheet-modeling`.
- Google Docs automation: `google-apps-script`.
- Improving the wording itself: `editing` (then apply the result with this skill).
- Assessing contract terms: `contract-review`.

## Workflow

1. **Inspect the file.**

   ```bash
   python -m zipfile -l in.docx                          # parts: comments.xml, headers, footers, numbering
   python -m zipfile -e in.docx unpacked/                # read word/document.xml with view_file
   pandoc in.docx -t plain --track-changes=all | head -50
   ```

   Count existing revisions and comments so you can prove later that none were lost:

   ```bash
   grep -o "<w:ins " unpacked/word/document.xml | wc -l
   grep -o "<w:comment " unpacked/word/comments.xml | wc -l
   ```

   ```powershell
   (Select-String -Path unpacked/word/document.xml -Pattern "<w:ins " -AllMatches).Matches.Count
   ```

   List the styles the template defines: `python -c "from docx import Document; print([s.name for s in Document('in.docx').styles])"`. A legacy `.doc` must first become .docx: `soffice --headless --convert-to docx in.doc`.

   **Check:** You know the counts of insertions, deletions and comments, the available style names, and whether headers, footers, fields or numbered lists are present.

2. **Pick the route.**

   | Goal | Route | Why |
   | :--- | :--- | :--- |
   | Prose-heavy document from Markdown | `pandoc in.md -o out/doc.docx --reference-doc=template.docx` | Fast; headings, lists, tables and code map to styles |
   | Data-driven document, precise tables | python-docx opening the template | Full control over every paragraph and cell |
   | Small edits to an existing document | python-docx at run level | Leaves untouched XML parts as they were |
   | Reviewable edits | Tracked changes and comments (recipes) | The author accepts or rejects each change in Word |
   | Read a document, including revisions | `pandoc in.docx -t gfm --track-changes=all --extract-media=out/media` | Shows insertions and deletions explicitly |
   | Node.js project | The `docx` npm package | Same model, no Python needed |

   To customize pandoc output, create a reference document with `pandoc -o reference.docx --print-default-data-file reference.docx`, edit its styles in Word, and pass it with `--reference-doc`.

   **Check:** The route preserves everything step 1 found that the user wants kept.

3. **Use the template's styles.** Open the template with `Document("template.docx")`, apply named paragraph and table styles, and avoid direct formatting (manual fonts, sizes, colors) except for one-off emphasis. Do not assume style names: a template saved from Word may lack "Heading 2" or "List Number" until they are used, and python-docx raises `KeyError` for a missing style.

   ```python
   from docx import Document
   from docx.shared import Inches

   doc = Document("template.docx")
   doc.add_heading("Quarterly report", level=1)
   doc.add_paragraph("Revenue grew in all regions.")      # the template's Normal style
   table = doc.add_table(rows=1, cols=3, style="Table Grid")
   for cell, label in zip(table.rows[0].cells, ["Region", "Q3", "Q4"]):
       cell.text = label
   for region, q3, q4 in [("EMEA", "1.2", "1.4"), ("APAC", "0.8", "1.1")]:
       row = table.add_row().cells
       row[0].text, row[1].text, row[2].text = region, q3, q4
   doc.add_picture("out/chart.png", width=Inches(6))
   doc.sections[0].footer.paragraphs[0].text = "Internal"
   doc.save("out/report.docx")
   ```

   **Check:** Every paragraph and table uses a style that exists in the template.

4. **Edit at run level.** Assigning `paragraph.text` deletes every run in the paragraph, including formatting, comment anchors and revisions. Change text inside the run that holds it. Word often splits one visible phrase across several runs (spell-check marks, earlier edits), so a phrase may not be found in any single run; the [OOXML recipes](references/ooxml-recipes.md) include a helper that isolates a phrase into its own run.

   **Check:** Unrelated runs in edited paragraphs keep their formatting, and revision and comment counts match step 1.

5. **Make review edits reviewable.** When a person will review the changes, write them as tracked changes (`w:ins` and `w:del` with author and date) and explain them in comments. python-docx has no tracked-changes API, so use the XML helpers in the [OOXML recipes](references/ooxml-recipes.md). python-docx 1.2 and later add `Document.add_comment()`; confirm with `help(Document.add_comment)` on the installed version. Use an author name the user chooses, such as "Review (assistant)".

   **Check:** Opening the output in Word or LibreOffice shows each change as a revision attributed to the chosen author.

6. **Fields: page numbers and contents.** python-docx writes fields but cannot compute them. Insert a `PAGE` field for page numbers and a `TOC` field for the contents (recipes), then tell the user to update fields in Word (select all, then F9). For documents built from Markdown, `pandoc --toc` generates the contents directly.

   **Check:** The rendered PDF shows page numbers, and the contents either show entries or the user has been told to update fields.

7. **Verify by round-tripping and rendering.**

   ```bash
   python -c "from docx import Document; d=Document('out/report.docx'); print(len(d.paragraphs), len(d.tables))"
   pandoc out/report.docx -t plain --track-changes=all -o out/report.txt
   soffice --headless --convert-to pdf --outdir out out/report.docx
   pdftoppm -png -r 60 out/report.pdf out/page
   ```

   Diff `out/report.txt` against the expected text, search it for non-ASCII samples from the source (accented names, CJK, symbols), recount revisions and comments, and look at the page images with `view_file`.

   **Check:** Text matches, non-ASCII characters survived, counts are as expected, and the pages look right.

## Gotchas

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| Formatting vanished in an edited paragraph | `paragraph.text = ...` replaced all runs | Edit the specific run |
| `KeyError: no style with name ...` | Style not defined in this template | List styles; add it to the template in Word, or pick an existing one |
| Numbered list continues from the previous list | Lists share one numbering instance | Use pandoc or a template list style; restarting numbering needs XML work |
| Table of contents is empty | Fields are computed by Word, not python-docx | Ask the user to update fields, or build with `pandoc --toc` |
| Text in revisions missing from `paragraph.text` | python-docx has no revision API | Read with `pandoc --track-changes=all` or the XML |
| Word reports unreadable content | Invalid or out-of-order XML written by hand | Validate the XML, follow element order, compare with a Word-saved sample |
| Characters became `?` | Text passed through a non-UTF-8 step | Keep strings as Unicode end to end; set `encoding="utf-8"` on file reads |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Save over the input | Write to `out/` | The original is the only clean copy |
| Set `paragraph.text` to change one word | Edit the run, or isolate the phrase first | Whole-paragraph replace destroys formatting and revisions |
| Silently rewrite a reviewed document | Use tracked changes and comments | Reviewers need to see and reject each change |
| Accept or strip existing revisions as a side effect | Leave them unless explicitly asked | They are someone else's pending review |
| Hard-code fonts and sizes everywhere | Apply the template's named styles | Direct formatting breaks the house style and later restyling |
| Trust that it saved without errors | Round-trip and render | Corruption often shows only when Word opens the file |

## Verification checklist

- [ ] The input is untouched, and the output is in `out/`.
- [ ] Existing tracked changes and comments are all still present (counts match), unless their removal was requested.
- [ ] New review edits appear as attributed revisions with explanatory comments.
- [ ] All paragraphs and tables use template styles; no unexpected direct formatting.
- [ ] Round-trip text matches expectations, including non-ASCII characters.
- [ ] The rendered pages were checked visually: headers, footers, page numbers, tables, images.

## Related

- Knowledge: `pdf-toolkit`, `presentation-slides`, `spreadsheet-modeling`, `editing`, `documentation-writing`, `contract-review`, `google-apps-script`, `translation`.
- Agents: `technical-writer` (drafting content), `doc-updater` (keeping documents in sync with code).
