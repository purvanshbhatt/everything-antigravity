# OOXML Recipes for python-docx

Companion to the `docx-documents` skill. These helpers reach below python-docx's
public API into the WordprocessingML XML for features it does not cover: isolating
a phrase into its own run, tracked changes, fields, repeating table headers and
alt text. Underscore attributes such as `run._r` are internal to python-docx;
they have been stable for years, but re-run the verification step after upgrading.

Shared imports:

```python
import copy
from datetime import datetime, timezone

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.text.run import Run
```

## Isolate a phrase into its own run

Changing one phrase without touching neighbouring formatting starts by giving
that phrase its own run. This handles a phrase inside a single run; if it returns
`None`, the phrase spans runs, so inspect the paragraph's runs and decide by hand.

```python
def isolate_phrase(paragraph, phrase):
    """Split the run containing `phrase` into before / phrase / after runs.

    Returns the Run holding exactly `phrase`, or None if no single run contains it.
    """
    for run in paragraph.runs:
        start = run.text.find(phrase)
        if start < 0:
            continue
        before, after = run.text[:start], run.text[start + len(phrase):]
        r = run._r
        if after:
            tail = copy.deepcopy(r)
            r.addnext(tail)
            Run(tail, paragraph).text = after
        middle = copy.deepcopy(r)
        r.addnext(middle)
        Run(middle, paragraph).text = phrase
        if before:
            run.text = before
        else:
            r.getparent().remove(r)
        return Run(middle, paragraph)
    return None
```

The copies keep the original run properties (`w:rPr`), so bold, italics and fonts
carry over to all three pieces.

## Tracked replacement

Wraps the old run in `w:del` (its text becomes `w:delText`) and adds a `w:ins`
run with the new text right after it. Revision ids must be unique in the
document, so the helper starts above the highest id already present.

```python
class Revisions:
    def __init__(self, doc, author):
        ids = [int(v) for v in doc.element.body.xpath(".//@w:id") if v.lstrip("-").isdigit()]
        self.next_id = max(ids, default=0) + 1
        self.author = author

    def _mark(self, tag):
        el = OxmlElement(tag)
        el.set(qn("w:id"), str(self.next_id))
        self.next_id += 1
        el.set(qn("w:author"), self.author)
        el.set(qn("w:date"), datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
        return el

    def replace(self, run, new_text):
        r = run._r
        deletion = self._mark("w:del")
        r.addprevious(deletion)
        deletion.append(r)                      # moves the run inside w:del
        for t in r.findall(qn("w:t")):
            t.tag = qn("w:delText")
        insertion = self._mark("w:ins")
        new_r = OxmlElement("w:r")
        if r.rPr is not None:
            new_r.append(copy.deepcopy(r.rPr))
        t = OxmlElement("w:t")
        t.set(qn("xml:space"), "preserve")
        t.text = new_text
        new_r.append(t)
        insertion.append(new_r)
        deletion.addnext(insertion)
```

Usage:

```python
doc = Document("in.docx")
revs = Revisions(doc, author="Review (assistant)")
for paragraph in doc.paragraphs:
    run = isolate_phrase(paragraph, "utilise")
    if run is not None:
        revs.replace(run, "use")
doc.save("out/reviewed.docx")
```

A pure insertion is the second half of `replace` on its own; a pure deletion is
the first half. Do not wrap runs that are already inside `w:ins` or `w:del`: that
would nest one reviewer's change inside another's.

## Comments

python-docx 1.2 and later can anchor a comment to one or more runs:

```python
run = isolate_phrase(paragraph, "Q3 revenue")
doc.add_comment(run, text="Source for this figure?", author="Review (assistant)", initials="RA")
```

Check the signature on the installed version with
`python -c "from docx.document import Document; help(Document.add_comment)"`.
On older versions, upgrade in the project's environment rather than hand-writing
the comments part, which needs entries in several XML files to stay consistent.

## Page number field in the footer

```python
def add_page_number(paragraph):
    field = OxmlElement("w:fldSimple")
    field.set(qn("w:instr"), "PAGE")
    r = OxmlElement("w:r")
    t = OxmlElement("w:t")
    t.text = "1"                                # placeholder until Word computes it
    r.append(t)
    field.append(r)
    paragraph._p.append(field)

footer = doc.sections[0].footer.paragraphs[0]
footer.text = "Page "
add_page_number(footer)
```

## Table of contents field

```python
def add_toc(paragraph, levels="1-3"):
    def field_char(kind):
        el = OxmlElement("w:fldChar")
        el.set(qn("w:fldCharType"), kind)
        return el

    paragraph.add_run()._r.append(field_char("begin"))
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = f'TOC \\o "{levels}" \\h \\z \\u'
    paragraph.add_run()._r.append(instr)
    paragraph.add_run()._r.append(field_char("separate"))
    paragraph.add_run("Update fields to build the table of contents.")
    paragraph.add_run()._r.append(field_char("end"))
```

The switches: `\o` picks heading levels, `\h` makes entries hyperlinks, `\z` hides
page numbers in web layout, `\u` uses paragraph outline levels. Tell the user to
update fields in Word after opening.

## Repeat a table's header row on every page

```python
tr_pr = table.rows[0]._tr.get_or_add_trPr()
header = OxmlElement("w:tblHeader")
header.set(qn("w:val"), "true")
tr_pr.append(header)
```

## Alt text for an image

```python
doc.add_picture("out/chart.png")
doc.inline_shapes[-1]._inline.docPr.set("descr", "Bar chart: revenue by region, Q3 and Q4")
```

## Counting revisions and comments after a change

```python
import re
import zipfile

def review_counts(path):
    doc = Document(path)
    body = doc.element.body
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        comments = z.read("word/comments.xml").decode("utf-8") if "word/comments.xml" in names else ""
    return {
        "insertions": len(body.xpath(".//w:ins")),
        "deletions": len(body.xpath(".//w:del")),
        "comments": len(re.findall(r"<w:comment\b", comments)),
    }

before, after = review_counts("in.docx"), review_counts("out/reviewed.docx")
print(before, after)
```

Every count in `after` should be at least the count in `before`, plus exactly the
revisions and comments you added.

## Well-formedness check

```python
import zipfile
from xml.dom import minidom

with zipfile.ZipFile("out/reviewed.docx") as z:
    for name in z.namelist():
        if name.endswith(".xml"):
            minidom.parseString(z.read(name))
print("all XML parts parse")
```

Parsing proves the XML is well formed, not that Word accepts it. Opening the
file in Word or converting it with LibreOffice is the final test.
