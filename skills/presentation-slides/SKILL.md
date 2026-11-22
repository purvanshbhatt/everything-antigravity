---
name: presentation-slides
description: >-
  Builds presentation decks that land: audience and goal framing, storyline
  written as action titles before any slide exists, slide layout and type
  rules, data slides with one message per chart, speaker notes, accessible
  slides, and tooling from Google Slides and PowerPoint to Marp, Slidev,
  reveal.js and python-pptx. Use when drafting or reviewing a deck, turning a
  document or analysis into slides, or generating slides from code.
---

# Presentation Slides

A deck is an argument delivered in sequence. Decide the one thing the audience
should do or believe, write the storyline as a list of headline sentences,
then design each slide to prove its headline. Visual polish comes last.

## When to use

- Drafting a deck for a review, all-hands, customer pitch, training or talk.
- Turning a report, spec or analysis into slides.
- Reviewing a deck that is too long, too dense or has no clear ask.
- Generating slides from Markdown or code for repeatable reports.

## When not to use

- Fundraising decks: use `pitch-deck` (it applies this skill to investors).
- Conference talk narrative, CFPs and live demos: use `conference-talks`.
- Narrative and chart choice for analysis results: use `data-storytelling`.
- Brand system and templates: use `visual-identity`.

## Workflow

1. **Frame it.** Write down audience (who, what they already know), goal (decision, approval, understanding, behaviour change), constraints (time slot, live or async, projector or laptop) and the key message as one sentence.

   **Check:** The key message is one sentence a listener could repeat afterwards.

2. **Write the storyline as action titles.** Before opening a slide tool, list slide headlines as full-sentence claims ("Checkout errors fell 62 % after the retry fix"), not topics ("Results"). Use a simple arc: situation → complication → resolution → ask, or problem → insight → proposal → next steps. Budget about 1-2 minutes per slide. Put the answer first for executives.

   **Check:** Reading only the titles in order tells the whole story and ends with the ask.

3. **Choose the tool.**

   | Tool | Best for | Agent-friendly path |
   | :--- | :--- | :--- |
   | Google Slides, PowerPoint, Keynote | Corporate templates, co-editing | python-pptx or the Slides API to generate a draft |
   | Marp | Markdown decks to PDF, HTML or PPTX | `npx @marp-team/marp-cli deck.md --pdf` |
   | Slidev | Developer talks with code and live components | `npx slidev`, then `npx slidev export` |
   | reveal.js | HTML decks hosted on the web | Static site build |

   Marp's PPTX export renders slides as images by default; check the Marp CLI docs if editable output is required.

4. **Lay out each slide.** 16:9; one idea per slide; title at the top in the same position every time; text at least 24 pt for projected decks (18 pt absolute minimum); at most two typefaces; one accent colour for emphasis; generous margins on a grid; no more than about 30 words of body text. Detail goes in speaker notes or an appendix.

   **Check:** The "glance test": each slide's point is clear within about 5 seconds.

5. **Design data slides.** The title states the takeaway; one chart per slide; highlight the series that matters and grey the rest; label directly instead of legends; round numbers to what matters; show the source in small text at the bottom. Prefer bars for comparison and lines for time.

   **Check:** Each chart has a takeaway title, a highlighted focus, labels and a source line.

6. **Write speaker notes.** For each slide: the point in one line, 2-4 talking points, the transition sentence to the next slide, and a time marker. Notes keep slides clean and make the deck usable when sent async.

   **Check:** A colleague could present the deck from the notes alone.

7. **Make it accessible.** Unique slide titles, alt text on informative images and charts, reading order checked, contrast at least 4.5:1 for body text, no meaning carried by colour alone, captions on embedded video. PowerPoint's Accessibility Checker catches many issues.

   **Check:** The accessibility checker reports no errors and every chart has alt text describing its takeaway.

8. **Render, review and rehearse.** Export to PDF or images and review every slide (open the export in the Antigravity browser or `view_file` the images); fix overflow, orphans and misalignment. Rehearse with a timer; cut slides when over time.

   **Check:** The rehearsal fits the slot with a 10 % buffer and no slide overflows.

## Marp example

```markdown
---
marp: true
theme: default
paginate: true
---

# Checkout errors fell 62 % after the retry fix

![w:900](charts/checkout-errors.png)

<!-- Notes: incident in October; fix shipped 3 Nov; ask for approval to roll out to EU next. -->

---

# Rolling out to EU needs one decision today

- Approve the EU rollout for 10 Dec
- Risk: payment provider limits (mitigated by rate caps)
```

HTML comments in Marp become presenter notes.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Topic titles ("Q3 Results") | Claim titles ("Q3 revenue beat plan by 8 %") | The audience gets the point without decoding |
| Paragraphs on slides | Short phrases on slides, detail in notes | People read or listen, not both |
| Several charts per slide | One chart, one takeaway | Attention splits; no message lands |
| Rainbow colours | Grey everything, highlight one thing | Emphasis needs contrast |
| Ending on "Questions?" | End on the ask or next steps | The last slide stays on screen longest |
| Build slides before the storyline | Action-title outline first | Saves redesigning slides that get cut |

## Verification checklist

- [ ] Key message and ask are explicit; titles alone tell the story.
- [ ] One idea per slide; text is large enough to read when projected.
- [ ] Data slides have takeaway titles, highlights, labels and sources.
- [ ] Speaker notes exist for every slide.
- [ ] Accessibility checks pass; alt text present.
- [ ] Rendered export reviewed; rehearsal fits the time slot.

## Related

- Knowledge: `data-storytelling`, `conference-talks`, `pitch-deck`, `data-visualization`, `copywriting`, `visual-identity`, `accessibility-a11y`.
- Agents: `technical-writer`, `data-analyst`.
