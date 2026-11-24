---
name: design-interrogation
disable-model-invocation: true
description: >-
  Stress-tests a plan, spec or design with a one-question-at-a-time interview
  that settles upstream decisions before downstream ones, offers a recommended
  answer with every question, reads the code instead of asking when the code
  can answer, and ends with a decision log plus optional ADR and glossary
  entries. Use when a plan feels thin, or before committing to a design.
  Invoke with /design-interrogation.
---

# Design Interrogation

Find the holes in a design before the code does. The agent interviews the user about one decision at a time, in dependency order, and proposes its own answer to each so the user can accept with a word or correct it. Nothing but notes is written until the interview ends; the product is a decision log the plan can be rewritten from.

## When to use

- A plan, spec, PRD, ADR draft or design doc exists and the user says "poke holes in this", "what am I missing", "challenge this" or "is this ready to build".
- Before `/blueprint` or `/slice-into-tickets`, when unanswered questions would otherwise surface halfway through the build.
- After `/idea-to-design`, as a second, adversarial pass over the chosen approach.
- A decision the team keeps relitigating because its sub-decisions were never written down.

## When not to use

- There is only an idea, not a design: `/idea-to-design`.
- One isolated choice between named options: `/architecture-decision`.
- The open question needs running code to settle (real API behaviour, performance, how an interaction feels): `/throwaway-prototype`.
- Reviewing code that is already written: `/code-review`.
- Whether the product is worth building at all: `product-discovery`.

## Ground rules

- **One question per message.** Never batch, even when questions look independent; each answer can change the next question.
- **Every question carries a recommendation.** State your recommended answer and the reason, so the user can reply "yes", pick another option, or override.
- **Look before asking.** If code, config, docs or git history can answer a question, read them (`grep_search`, `view_file`, `git log -S "<term>"`) and report the finding as settled, with its source. Ask only what needs judgment or knowledge that is not written down.
- **Upstream first.** Do not ask how a cache is invalidated before settling who owns the data it caches.
- **No implementation.** No production edits, scaffolds or "quick spikes" during the interview. Notes and the decision log only.
- **The user ends it.** Keep going until the user says stop or no open branch remains.

## Workflow

1. **Load the design and its context.** Read the document the user points to and the code it touches. If the design spans more than a few modules, delegate a breadth scan to the `codebase-explorer` subagent: "List the modules, data stores and external services this design touches, with file:line evidence; at most 30 lines; read-only."

   **Check:** You can state the design's goal and its main moving parts in three sentences, and the user agrees with them.

2. **Build the decision tree.** List every decision the design makes or implies, stated or hidden: boundaries, data ownership, interfaces, failure behaviour, consistency, security, migration, rollout, operations and naming. For each, note which other decisions it depends on, then order the list so every decision follows its dependencies. Mark each node as decided in the doc, decided by the code, or open. Keep the tree in your scratch notes, not in the chat.

   **Check:** Every open node lists its parents, and the first open node has no open parents.

3. **Settle what the code can settle.** For open nodes the repository can answer, read and record the answer with a file and line or a command output. Present all of these in one short message headed "Settled from the code" so the user can object to any of them.

   **Check:** Each settled-from-code entry cites its evidence.

4. **Ask the next question.** Take the first open node in order and use this shape:

   ```text
   Q7 (builds on Q3: events are the source of truth)
   While a projection is being rebuilt, should reads return stale data or fail?
   Recommended: return stale data with a staleness header. The dashboard
   tolerates minutes of lag, and failing would page on-call on every deploy.
   Other options: (b) fail with 503; (c) block writes until the rebuild ends.
   ```

   **Check:** The message holds exactly one question, one recommendation with a reason, and the earlier answer it builds on.

5. **Record the answer and re-plan.** Add a row to the decision log. Then ask three things of the tree: did this answer close other nodes, open new ones, or contradict an earlier answer? Insert new branches in dependency order. On a contradiction, quote both answers and ask which one stands before going further.

   **Check:** The log has the new row, and your next question is again the first open node in order.

6. **Probe the edges before closing a branch.** Ask the failure question for the branch if it has not come up: what happens when this dependency is slow, down, wrong, duplicated or hostile, and what happens on first deploy, on rollback, and at ten times today's load. Skip probes that clearly do not apply, and say which ones you skipped.

   **Check:** Each closed branch has a failure answer or a stated reason that no failure mode applies.

7. **Close out.** When the user stops or no branch is open, publish the decision log (template below) as an artifact, list the remaining open questions with an owner each, and propose edits to the original design doc as a diff for the user to approve. Offer, without doing it unasked: ADRs through `/architecture-decision` for decisions that are expensive to reverse, and glossary entries for every term the interview had to define (in the project's glossary, for example `docs/glossary.md`, or its domain-language section).

   **Check:** The user has the log, the open questions with owners, and the proposed doc diff, and no production code was changed.

## Decision log template

```markdown
# Decision log: <design name> (<YYYY-MM-DD>)
Source design: <path or link>

| # | Question | Answer | Source | Builds on | Consequence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Q1 | Who owns order state? | The orders service only | code: src/orders/repo.ts:18 | - | Other services read through its API |
| Q2 | ... | ... | user / recommendation accepted / code | Q1 | ... |

## Reversed answers
- Q4 changed from <a> to <b> after Q9, because ...

## Open questions
- <question> - owner: <role> - needed before: <milestone>

## Terms defined
- <term>: <one-line meaning>
```

## Question bank

Pick from these when building the tree; do not recite them.

| Area | Questions that usually expose gaps |
| :--- | :--- |
| Boundaries | Which component owns this data? Who else writes to it, and how is that stopped? |
| Interfaces | What is the smallest contract callers need? What breaks when a field is added or removed? |
| Failure | Timeouts, retries, idempotency keys, partial failure, poison messages, backpressure |
| Consistency | What may be stale, for how long, and who notices when it is? |
| Security | Who is the caller, how is each object authorized, and which input is untrusted? |
| Data lifecycle | Migration from today's shape, backfill, retention, deletion and export |
| Rollout | Flag or dark launch, migration order, and how to roll back after data has changed |
| Operations | Which alert fires first when it breaks, and what does on-call do next? |
| Scope | Which part could be cut without losing the goal? |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Ask five questions in one message | One question, then wait | Later questions depend on earlier answers |
| Ask without a recommendation | Lead with your recommended answer and its reason | The user can accept in one word, and your assumptions become visible |
| Ask what the code already says | Read it and report the finding with file:line | Wastes attention and invites wrong answers from memory |
| Jump to a leaf detail | Settle the parent decision first | Leaf answers are thrown away when the parent changes |
| Start fixing the design in code | Record decisions, then propose doc edits | The interview is for decisions, not implementation |
| Wrap up because the user seems tired | Offer to pause and save the open branches | Unasked questions resurface mid-build |
| Quietly accept a contradiction | Quote both answers and ask which stands | Contradictions are the most valuable finding |

## Verification checklist

- [ ] Every interview message asked exactly one question and carried a recommendation.
- [ ] Questions followed dependency order, and reversed answers are recorded.
- [ ] Questions the code could answer were answered from the code, with citations.
- [ ] Each closed branch has a failure-mode answer or a reason it has none.
- [ ] The decision log, open questions with owners, and a proposed design diff were delivered.
- [ ] No production code was written; ADRs and glossary entries were offered, not imposed.

## Related

- Workflows: `/idea-to-design`, `/architecture-decision`, `/blueprint`, `/write-spec`, `/throwaway-prototype`, `/slice-into-tickets`, `/threat-modeling`.
- Agents: `codebase-explorer`, `code-architect`.
- Knowledge: `domain-driven-design`, `software-architecture`, `product-discovery`.
