---
name: de-slop-prose
disable-model-invocation: true
description: >-
  Finds and rewrites the recognizable tells of machine-generated writing:
  inflated significance, brochure adjectives, reflexive triplets, manufactured
  "not X but Y" contrasts, stacked hedges, vague attributions, filler
  transitions, chat residue and echo conclusions. Tags each instance, rewrites
  toward specific prose in the author's voice, and never invents facts. Use
  when text reads generic, robotic or "AI-sounding".
---

# De-slop Prose

Generated drafts share a set of habits that readers now spot in a sentence or two, and once they spot them they stop trusting the rest. This skill names each habit, tags every instance in the text, and rewrites toward plain, specific prose in the author's own voice. Facts, numbers, quotes and meaning survive unchanged; vagueness is cut or answered with real detail, never with invented detail.

## When to use

- The user says a draft "sounds like AI", "reads generic", "is too salesy" or "has no voice".
- Before publishing a README, release note, blog post, email or doc that an assistant drafted.
- Reviewing generated documentation or commit and PR descriptions for padding.
- Building a house style guide that bans specific patterns.

## When not to use

- General structural and line editing, proofreading or consistency passes: `editing`.
- Writing new marketing copy from a brief: `copywriting`.
- Restructuring docs around user tasks: `documentation-writing`.
- Making text pass an AI detector where assisted writing is not allowed (coursework, journals with disclosure rules). This skill improves writing; it does not hide authorship.

## Workflow

1. **Fix the brief.** Record the audience, the purpose, and the voice. If the author has other writing (earlier posts, the project README, their emails), read two or three samples with `view_file` and note sentence length, formality, use of "I" or "we", and humour. List the frozen spans that must not change: numbers, names, quotes, code, links, legal or contractual wording, and terms of art.

   **Check:** You can describe the target voice in one sentence, and the frozen spans are listed.

2. **Run a lexical pass.** Save the starter word list from [the tell catalog](references/tell-catalog.md) to a scratch file and search for it:

   ```bash
   rg -n -i -w -f slop-words.txt draft.md
   ```

   ```powershell
   Select-String -Path draft.md -Pattern (Get-Content slop-words.txt) | Select-Object LineNumber, Line
   ```

   Treat hits as candidates only. Many words are fine in context: "robust" in statistics, "landscape" for page orientation, "leverage" in finance.

   **Check:** Every hit was read in context and kept or tagged.

3. **Run a structural pass.** Read paragraph by paragraph and tag each instance with a code from the table below, quoting the span. Structural tells (triplets, tails, echo endings, uniform rhythm) are invisible to word lists, so this pass is the important one. Note density: three or more tags in one paragraph usually means rewriting the paragraph, not patching phrases.

   **Check:** Each tag quotes its span and names one code.

4. **Choose an action per tag.**
   - **Cut** when the words carry no information (signposts, chat residue, echo conclusions).
   - **Concretize** when a vague claim hides a real fact: replace it with the number, name, example or mechanism from the source material.
   - **Restructure** when the shape is the problem (triplets, manufactured contrast, rhetorical question then answer).
   - **Ask** when the claim needs a specific you do not have. Never invent a statistic, customer, quote, benchmark or source to fill the gap.

   **Check:** Every "concretize" cites where the specific came from; every gap without a source became "cut" or a question for the author.

5. **Rewrite.** Concrete subjects and active verbs. One term per thing. Sentence length that follows the content, not a template. Plain punctuation: periods, commas, parentheses, an occasional colon. Keep honest uncertainty, stated once and attached to the specific unknown. End on the last new point or the next action, not a summary of what was just said.

   **Check:** Reading the rewrite aloud, nothing sounds like a press release or a chat reply.

6. **Diff and fact-check.** Compare versions word by word:

   ```bash
   git diff --no-index --word-diff draft.md draft.rewrite.md
   ```

   Confirm every frozen span is identical, no claim was strengthened or weakened, and no new fact appeared without a source.

   **Check:** Frozen spans match exactly, and each meaning change was intended and noted.

7. **Re-scan and report.** Run passes 2 and 3 on the rewrite, because rewriting tends to introduce fresh triplets and tails. Deliver the rewrite with a short change summary: counts per tag code, notable cuts, and questions for the author.

   **Check:** The rewrite has no remaining tags, or each remaining one is a deliberate choice explained in the summary.

## Tell codes

| Code | Pattern | Example | Usual fix |
| :--- | :--- | :--- | :--- |
| INFLATE | Puffed-up significance | "marks a pivotal moment for the team" | Say what changed and its effect, or cut |
| PROMO | Brochure adjectives | "a seamless, powerful experience" | Replace with the fact behind it, or delete |
| TRIAD | Reflexive lists of three | "fast, reliable and scalable" | Keep only the items that are true and matter |
| CONTRAST | Contrast with a claim nobody made | "It's not a library. It's a mindset." | State the actual point directly |
| HEDGE | Stacked qualifiers | "may potentially help somewhat" | One qualifier on the real uncertainty |
| VAGUE-SRC | Unnamed authorities | "experts agree", "studies show" | Cite the source or drop the attribution |
| TAIL | Trailing commentary clause | "..., ensuring a smooth experience for all" | Cut, or make a separate concrete sentence |
| SIGNPOST | Announcing instead of saying | "In this post we will explore..." | Start with the content |
| TRANSITION | Stacked connectives | "Moreover... Furthermore... Additionally..." | Delete, or use a logical word (because, so, but) |
| CHAT | Assistant residue | "Great question!", "Hope this helps!" | Delete |
| ECHO | Conclusion repeats the intro | "In summary, caching is important..." | End on the last new point or next step |
| QUESTION | Rhetorical question, then answer | "The result? Faster builds." | State the result |
| SYNONYM | Rotating names for one thing | "the tool... the solution... the platform" | One term throughout |
| RANGE | Hollow "from X to Y" spans | "from solo devs to global enterprises" | Name the real audience |
| FORMAT | Decoration over content | Bold-label bullets, emoji headings, Title Case, dash chains | Plain sentences, sentence-case headings |
| RHYTHM | Every sentence the same shape | Ten 18-word sentences in a row | Vary with the content |

More patterns, a word list and edge cases are in [the tell catalog](references/tell-catalog.md).

## Worked example

Before:

> In today's fast-moving landscape, our new caching layer represents a pivotal step forward. It's not just faster; it's a fundamentally better way to build. Seamless, robust and scalable, it empowers teams to deliver exceptional experiences, ensuring users never wait again.

Tags: SIGNPOST, INFLATE, CONTRAST, TRIAD plus PROMO, TAIL. Every sentence is tagged, so the paragraph is rewritten rather than patched. The PR description contained a benchmark, so the rewrite can be concrete:

> The new caching layer cuts median API latency on the staging benchmark from 180 ms to 40 ms. Endpoints that already send `Cache-Control` headers need no code changes.

Had there been no benchmark, the rewrite would say what the layer does and ask the author for a measured number, not supply one.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Find-and-replace banned words | Read each hit in context and fix the sentence | Swapping "leverage" for "use" leaves the empty sentence intact |
| Fill vague claims with plausible numbers | Use sourced specifics or ask the author | Invented facts are worse than vague ones |
| Strip every hedge | Keep one precise qualifier where uncertainty is real | Overconfident prose misleads readers |
| Impose your own voice | Match the author's samples | The goal is their writing, minus the tells |
| Rewrite frozen spans | Leave quotes, numbers, code and legal text alone | Small wording changes can change meaning or liability |
| Stop after one pass | Re-scan the rewrite | Rewrites breed new triplets and tails |
| Label the author's text "AI-written" | Describe the patterns, not the origin | Humans write these patterns too; origin claims are unprovable |

## Verification checklist

- [ ] Audience, purpose, voice and frozen spans were recorded before editing.
- [ ] Lexical and structural passes were both run, and every tag quotes its span.
- [ ] No new fact, number, name, quote or source appears without a citation from the material or the author.
- [ ] Frozen spans are byte-identical in the word diff.
- [ ] The rewrite was re-scanned, and the change summary lists counts per code and open questions.

## Related

- Knowledge: `editing` (general line and copy editing), `copywriting`, `documentation-writing`, `technical-blogging`, `newsletters`, `translation`.
- Workflows: `/update-docs` (docs that drifted from code).
- Agents: `technical-writer` (longer documents).
