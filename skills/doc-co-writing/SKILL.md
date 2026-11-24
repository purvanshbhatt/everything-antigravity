---
name: doc-co-writing
disable-model-invocation: true
description: >-
  Co-writes a substantial document with the user, such as a design doc,
  proposal, RFC, strategy memo or long README: gathers context with targeted
  questions, agrees an outline, drafts section by section from options the
  user picks, then has a fresh subagent with no context read it as the target
  reader and fixes the gaps it finds. Invoke with /doc-co-writing.
---

# Doc Co-Writing

Long documents fail in two ways: the author's head holds context the page does not, and the draft drifts from what the author would actually decide. This workflow fixes both. It moves the context out of the user's head first, lets the user choose the direction of every section, and then tests the finished draft on a reader who knows nothing else.

**Ownership rule.** The user owns every decision, number, name and commitment in the document. The agent proposes options and drafts prose; it never invents data, quotes, dates or agreements. Anything the agent infers is marked as an assumption until the user confirms it.

## When to use

- The user wants to write a design doc, proposal, RFC, strategy memo, policy, one-pager or long README together.
- A draft exists but "doesn't land", and the user wants to rework it section by section.
- The document will be read by people who were not in the room, so missing context is the main risk.
- The user says "help me write", "let's draft this together" or "co-write".

## When not to use

- A technical spec grounded mostly in the code: `/write-spec`.
- A single architecture decision record: `/architecture-decision`.
- Polishing finished prose without changing its substance: `editing`.
- Reference docs, READMEs or API docs from the code: `documentation-writing` or `/update-docs`.
- An incident write-up: `/postmortem`.

## Workflow

1. **Frame the document.** Ask, in one message, at most five questions: who the readers are, what they should decide or do after reading, the document type and any template, the length budget, and the deadline or review venue. Write the answers as one goal sentence.

   **Check:** You can write "After reading this, <reader> will <decide or do X>", and the user agrees with it.

2. **Transfer the context.** Collect what already exists: linked docs, tickets, notes the user pastes, and code or config read with `view_file` and `grep_search`. Build a context brief (template in Patterns) of facts with their sources, constraints, decisions already made, open questions and assumptions. Ask follow-up questions only where the answer would change the content.

   **Check:** The user confirmed the brief, and every fact in it has a source or is labelled an assumption.

3. **Agree the outline.** Propose section headings, each with a one-line purpose and a word budget. If the structure is not obvious, offer two outlines and say what each one optimizes for. Save the approved outline into the document file with `write_to_file`.

   **Check:** The user approved the outline, and the section budgets add up to the length budget.

4. **Draft section by section.** For each section, first offer two or three short options for its main point or framing, with the trade-off of each. The user picks, merges or rewrites them. Then draft the prose for that section only. Mark inferences inline as `[ASSUMPTION: ...]` and unresolved points as `[OPEN: ...]`. Save after each section, and move on only when the user accepts it or says to keep going.

   **Check:** Each accepted section contains no fact that is missing from the brief and not marked as an assumption.

5. **Tighten the whole draft.** Read it end to end. Make terms, numbers and names consistent, fix cross-references, cut sentences that do not serve the goal sentence, and put the ask or decision near the top. Use the `editing` passes for the line-level work.

   **Check:** The draft is within the length budget, and its first screen states the ask.

6. **Run the reader test.** Delegate to a fresh subagent that receives only the document and a reader persona, never the brief or this conversation. Use the reader-test brief in Patterns. For high-stakes documents, run two personas, such as a skeptical approver and a new team member.

   **Check:** The subagent's two-sentence summary of the ask matches the goal sentence. If it does not, that mismatch is the first fix.

7. **Close the gaps.** Sort every question and doubt from the reader test into one of three outcomes: answer it in the document, state it as a non-goal, or list it under Open questions. Substantive answers come from the user. After large changes, run the reader test again with a new subagent.

   **Check:** Every reader question maps to a change, a non-goal or an open question.

8. **Finish.** Resolve every `[ASSUMPTION]` and `[OPEN]` marker, or move it into an Open questions section with an owner. Hand over the document path and a short list of what changed during the reader test.

   **Check:** A search for `[ASSUMPTION` and `[OPEN` finds nothing outside the Open questions section.

## Patterns

### Context brief

```markdown
# Context brief: <document title>
Goal: After reading this, <reader> will <decide or do X>.
Readers: <roles, what they already know, what they care about>

## Facts
- <fact> (source: <link, file or "user, 2026-11-23">)
## Constraints
- <deadline, budget, policy, technical limit>
## Decisions already made
- <decision> (by whom, when)
## Open questions
- <question> (owner)
## Assumptions (unconfirmed)
- <assumption>
```

### Section options

Offer options as short, distinct framings rather than three versions of the same paragraph:

```markdown
Section 3, "Why now". Pick one or combine:
A. Cost: the current pipeline costs more each quarter; lead with the trend.
B. Risk: the vendor ends support next year; lead with the deadline.
C. Opportunity: the new API unlocks a feature sales keeps asking for.
A suits a finance approver; B suits an engineering lead; C suits product.
```

### Reader-test brief

```markdown
You are <persona: role, what they know, what they do not know, what they care about>.
Read the document below. Use nothing except the document.
Return:
1. The ask or decision, in two sentences.
2. The questions you would send the author before agreeing.
3. Claims you doubt, and why.
4. Terms or acronyms you could not understand.
5. What you would decide right now, and what would change your mind.
<document>
```

### Shapes by document type

| Type | Lead with | Must contain |
| :--- | :--- | :--- |
| Design doc or RFC | Problem and proposed approach | Alternatives considered, risks, rollout, open questions |
| Proposal or business case | The ask and its cost | Options, expected outcome, how success is measured |
| Strategy memo | The recommendation | Context, the choice between paths, what is explicitly not being done |
| One-pager | The decision needed | Background in one paragraph, recommendation, next step |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Draft the whole document from the first message | Brief, outline, then one section at a time | A full draft anchors the user on the agent's guesses |
| Fill gaps with plausible numbers | Mark `[ASSUMPTION]` or `[OPEN]` and ask | Invented figures end up in decisions |
| Run the reader test with the full conversation | Give the subagent only the document and a persona | A reader who knows the context cannot find missing context |
| Pad sections to look complete | Cut to the goal sentence | Readers skim long docs and miss the ask |
| Offer three near-identical options | Offer framings with different trade-offs | Choice is only useful when options differ |
| Bury the ask at the end | State the ask on the first screen | Many readers stop after the first screen |

## Verification checklist

- [ ] A goal sentence was agreed before drafting.
- [ ] The context brief was confirmed, with sources or assumption labels for every fact.
- [ ] The user approved the outline and accepted each section.
- [ ] A fresh subagent with only the document ran the reader test, and its summary matched the goal.
- [ ] Every reader question became a change, a non-goal or an open question.
- [ ] No `[ASSUMPTION]` or `[OPEN]` markers remain outside Open questions.
- [ ] No data, quotes or commitments were invented.

## Related

- Workflows: `/write-spec`, `/architecture-decision`, `/postmortem`, `/update-docs`, `/research-synthesis`.
- Knowledge: `editing`, `documentation-writing`, `product-requirements`, `policy-drafting`, `technical-blogging`, `subagent-delegation`.
- Agents: `technical-writer`, `product-manager`.
