---
name: editing
disable-model-invocation: true
description: >-
  Edits and proofreads prose in separate passes: structural edit (purpose,
  audience, order), line edit (clarity, concision, active voice, plain
  language), copy edit (style-guide consistency, terminology, numbers) and
  proofread, returning changes with reasons while keeping the author's voice.
  Use when the user asks to edit, tighten, proofread, simplify or make
  consistent a document, post, README, email or docs set.
---

# Editing

Make the text clearer and more correct without making it someone else's.
Each pass has one job; mixing them produces edits that fix commas while the
argument is still in the wrong order.

## When to use

- "Edit this", "tighten", "proofread", "make this clearer", "make it consistent with our style guide".
- Before publishing a post, spec, README, release notes or a customer email.
- Docs-as-code repositories that need consistent terminology and automated prose linting.

## When not to use

- Writing from scratch: `technical-blogging`, `documentation-writing`, `copywriting`.
- Translating: `translation`.
- Changing what the document claims: that is the author's call; flag it, don't rewrite it.

## Workflow

1. **Agree the brief.** Audience, purpose, style guide (house guide, Google developer documentation style guide, Microsoft Writing Style Guide, Chicago, AP), edit depth (proofread only, light, heavy) and output mode (suggestions list, or edited text plus change log). Note voice constraints ("keep it informal", "British spelling").

   **Check:** Depth and output mode are stated; you know which style guide wins in conflicts.

2. **Read once without editing.** Write a two-sentence summary of what the piece says and who it is for. If you cannot, the problem is structural.

   **Check:** Your summary matches the author's stated purpose; if not, raise it first.

3. **Structural edit.** Is the main point in the first paragraph? Does each section earn its place? Is the order the reader's order (task sequence, question order), not the writer's discovery order? Propose moves and cuts as a list; don't rewrite yet.

   **Check:** The heading outline alone reads as a coherent argument or procedure.

4. **Line edit.** Per sentence: cut filler and hedges, prefer active voice and concrete verbs, split sentences over ~25 words, one idea per paragraph, define jargon on first use, replace nominalizations ("perform an installation of" -> "install").

   **Check:** The text is shorter, and no sentence changed its meaning.

5. **Copy edit against a style sheet.** Build a short style sheet as you go: spelling variants, capitalization of product names, serial comma, number style, date format, units, terminology choices ("sign in", not "log in"). Apply it everywhere.

   **Check:** Every term on the style sheet is used one way throughout.

6. **Proofread last.** Names, numbers, dates, links, code identifiers, headings, list parallelism, punctuation. Never "correct" code, commands, API names or quoted error text; they are payload.

   **Check:** Links resolve and every code span is byte-identical to the original.

7. **Deliver with reasons and confirm meaning changes.** Return the change log (format below). Any edit that may alter meaning is a question to the author, not a silent change.

   **Check:** The author can accept or reject each change individually.

## Patterns

Change log format:

| Location | Original | Suggested | Reason |
| :--- | :--- | :--- | :--- |
| Intro, para 1 | "In order to be able to deploy" | "To deploy" | Concision |
| Step 3 | "The config is validated by the CLI" | "The CLI validates the config" | Active voice |
| Section 2 | "log in" / "sign in" | "sign in" throughout | Style sheet: one term |
| Para 4 | "This always works" | QUESTION: always, or in the tested setups? | Possible meaning change |

Plain-language quick rules:

| Instead of | Write |
| :--- | :--- |
| utilize, leverage | use |
| in order to | to |
| prior to | before |
| a number of | several, or the number |
| it should be noted that | (delete) |
| is able to | can |

Automate consistency in docs-as-code repositories:

```bash
vale sync                         # download style packages listed in .vale.ini
vale docs/                        # prose lint (styles such as Google, Microsoft, write-good)
npx markdownlint-cli2 "docs/**/*.md"
npx cspell "docs/**/*.md"         # spelling with a project word list
```

These run unchanged in PowerShell. Treat readability scores (Flesch-Kincaid and similar) as hints, not targets.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Rewrite in your own voice | Keep the author's voice; fix clarity | Authors reject edits that don't sound like them |
| Do all passes at once | Structure, then lines, then copy, then proof | Polishing paragraphs you later cut wastes effort |
| Silently change claims | Ask a QUESTION in the change log | Meaning belongs to the author |
| "Fix" code or error strings | Leave payload byte-identical | One changed character breaks a command |
| Apply rules mechanically | Use judgment: passive voice is fine when the actor is unknown | Style rules serve the reader, not the reverse |

## Verification checklist

- [ ] Brief agreed: audience, purpose, style guide, depth, output mode.
- [ ] Structural issues raised before line edits.
- [ ] Style sheet applied consistently.
- [ ] Code, commands and quoted errors unchanged.
- [ ] Every meaning-changing edit is a question, not a change.
- [ ] Change log delivered with reasons.

## Related

- Knowledge: `technical-blogging`, `documentation-writing`, `copywriting`, `translation`, `knowledge-management`, `i18n-localization`.
- Agents: `technical-writer`, `doc-updater`.
