# PDF Python Recipes

Companion to the `pdf-toolkit` skill. Every recipe reads an input and writes a new
file under `out/`. APIs below match current pypdf, pdfplumber and pypdfium2
releases; if a call fails, check the installed version (`python -m pip show pypdf`)
against that library's changelog before changing the code.

Install into the project's virtual environment:

```bash
python -m pip install pypdf pdfplumber pypdfium2
python -m pip install pytesseract reportlab     # only for OCR confidence and stamps
```

`pytesseract` needs the Tesseract binary on `PATH`.

## Tables to CSV (pdfplumber)

```python
import csv
from pathlib import Path

import pdfplumber

Path("out").mkdir(exist_ok=True)
with pdfplumber.open("in.pdf") as pdf:
    for number, page in enumerate(pdf.pages, start=1):
        for index, table in enumerate(page.extract_tables(), start=1):
            target = Path(f"out/p{number}-t{index}.csv")
            with target.open("w", newline="", encoding="utf-8") as fh:
                csv.writer(fh).writerows(table)
```

- Borderless tables: pass settings that use text alignment instead of ruling lines,
  `page.extract_tables({"vertical_strategy": "text", "horizontal_strategy": "text"})`.
- One region only: `page.crop((x0, top, x1, bottom)).extract_tables()`. Find the
  coordinates with `page.to_image(resolution=100).draw_rects(page.rects).save("out/debug.png")`
  and look at the image.
- Tables that continue on the next page come back as two tables; join them by
  matching the header row.

## Text with layout (pypdf)

```python
from pypdf import PdfReader

reader = PdfReader("in.pdf")
text = "\n".join(page.extract_text(extraction_mode="layout") for page in reader.pages)
```

`extraction_mode="layout"` keeps columns aligned in recent pypdf releases; drop the
argument on older ones.

## Merge (pypdf)

```python
from pypdf import PdfWriter

writer = PdfWriter()
for path in ["a.pdf", "b.pdf"]:
    writer.append(path)
writer.write("out/merged.pdf")
```

## Watermark or stamp (reportlab + pypdf)

```python
from pypdf import PdfReader, PdfWriter
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

c = canvas.Canvas("out/stamp.pdf", pagesize=A4)
c.setFont("Helvetica", 48)
c.setFillGray(0.5, 0.3)
c.saveState()
c.translate(A4[0] / 2, A4[1] / 2)
c.rotate(45)
c.drawCentredString(0, 0, "DRAFT")
c.restoreState()
c.save()

stamp = PdfReader("out/stamp.pdf").pages[0]
writer = PdfWriter(clone_from="in.pdf")
for page in writer.pages:
    page.merge_page(stamp, over=True)
writer.write("out/watermarked.pdf")
```

Check that the stamp's `mediabox` matches each target page's `mediabox`; letter
and A4 pages need different stamps.

## Form fields (pypdf)

List first, so you use the real field names and checkbox states:

```python
from pypdf import PdfReader

reader = PdfReader("form.pdf")
acro = reader.trailer["/Root"].get("/AcroForm")
print("XFA present:", acro is not None and "/XFA" in acro.get_object())
for name, field in (reader.get_fields() or {}).items():
    print(name, field.get("/FT"), field.get("/V"), field.get("/_States_", ""))
```

Fill, keeping the form editable:

```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("form.pdf")
writer = PdfWriter(clone_from=reader)
values = {"full_name": "Ada Example", "agree_terms": "/Yes"}
for page in writer.pages:
    writer.update_page_form_field_values(page, values)
writer.set_need_appearances_writer(True)
writer.write("out/filled.pdf")

filled = PdfReader("out/filled.pdf").get_fields() or {}
for key, expected in values.items():
    actual = filled.get(key, {}).get("/V")
    assert str(actual) == expected, f"{key}: expected {expected}, got {actual}"
```

- `/FT` is `/Tx` for text, `/Btn` for checkboxes and radios, `/Ch` for choices.
- A checkbox value must be one of the states printed in `/_States_`.
- Some viewers ignore `NeedAppearances`; if values do not show, regenerate
  appearances with `qpdf --generate-appearances` and render the page to check.

## OCR confidence per page (pypdfium2 + pytesseract)

```python
import pypdfium2 as pdfium
import pytesseract

pdf = pdfium.PdfDocument("in.pdf")
for number in range(len(pdf)):
    image = pdf[number].render(scale=300 / 72).to_pil()
    data = pytesseract.image_to_data(image, lang="eng", output_type=pytesseract.Output.DICT)
    confs = [float(c) for c, word in zip(data["conf"], data["text"]) if word.strip() and float(c) >= 0]
    mean = sum(confs) / len(confs) if confs else 0.0
    weak = sum(1 for c in confs if c < 60)
    print(f"page {number + 1}: mean confidence {mean:.0f}, words below 60: {weak}")
```

Report pages with a low mean or many weak words, and say which fields (amounts,
dates, names) a human should re-check. Pick the threshold with the user; 60 is a
starting point, not a standard.

## Render pages for visual checks (pypdfium2)

```python
import pypdfium2 as pdfium

pdf = pdfium.PdfDocument("out/result.pdf")
for number in range(len(pdf)):
    pdf[number].render(scale=1).to_pil().save(f"out/preview-{number + 1}.png")
```

Open the PNGs with `view_file`. Use `scale=2` when checking small text or form values.
