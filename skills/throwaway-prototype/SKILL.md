---
name: throwaway-prototype
disable-model-invocation: true
description: >-
  Builds a deliberately disposable prototype to answer one named question,
  such as whether a state model holds up, which of three layouts feels right,
  or whether an API behaves as documented. Writes down the question and the
  result that settles it, builds the smallest thing outside production code
  within a timebox, reports the answer, then deletes or archives it. Use when
  reasoning cannot settle a design choice. Invoke with /throwaway-prototype.
---

# Throwaway Prototype

A prototype is an experiment, not a first draft. This workflow builds the cheapest thing that can answer one question, records the answer, and then removes the code so it never leaks into production. The deliverable is the answer, written down; the prototype itself is disposable.

## When to use

- A design choice hinges on something reasoning cannot settle: how an API really behaves, whether a data model survives real cases, how an interaction feels, whether a library can do something, how slow a naive approach is.
- `/design-interrogation` or `/idea-to-design` reached a question the user answered with "not sure, try it".
- Comparing two or three UI layouts or flows side by side before committing to one.
- A ticket's main risk is an unknown and `/slice-into-tickets` scheduled a spike for it.

## When not to use

- The answer is in the documentation or the code: read it.
- Building the first real version of a feature: `/feature-dev` or `/tdd`.
- Measuring the performance of existing code: `/perf-audit`.
- Testing demand with users (fake doors, concierge tests): `product-discovery`.
- Playable game prototypes: `/game-build`.

## Rules

- **Question first.** Nothing gets built until the question and the deciding result are written down.
- **One question per prototype.** A second question gets a second prototype.
- **Outside production code.** Use a scratch folder outside the repository or one that is git-ignored. Production code never imports from it.
- **Timebox.** The default is 30 to 60 minutes of agent work. At the limit, stop and report, even without an answer.
- **Disposable quality.** Hard-coded data, no tests unless the question is about testability, and no error handling beyond what the question needs.
- **No real secrets or production data.** Use fake data, a sandbox or a provider's test mode.
- **It ends deleted or archived,** never "tidied up and merged".

## Workflow

1. **Write the question card.** Before any code, agree on:

   ```text
   Question: Can we rebuild an order's state from its events alone,
             including refunds and partial shipments?
   Decides:  Drop the orders.status column (yes) or keep it as the source of truth (no).
   Deciding result: Replaying the 12 sample event sequences gives the expected
             final state for all 12.
   Kind: logic    Timebox: 45 min    Location: ../proto-order-replay/
   Not answering: performance, storage format, API shape.
   ```

   **Check:** The user agrees that either outcome would change their decision. If neither outcome would, the prototype is not needed; stop here.

2. **Pick the cheapest form for the kind of question.**

   | Kind | Cheapest form |
   | :--- | :--- |
   | Logic or data model | One script, a REPL session or a small terminal app, with in-memory data and printed results |
   | UI layout or flow | One self-contained HTML file per variant (inline CSS and JS, no build step), viewed with the browser agent |
   | Third-party API or library | A script that calls the sandbox or test mode with fake data and logs raw responses |
   | Performance feasibility | A micro-benchmark with realistic input sizes, run several times |
   | Integration path | A throwaway branch in its own worktree (`/git-worktrees`), discarded afterwards |

   **Check:** The chosen form needs no change to production code, configuration or dependency manifests.

3. **Set up the scratch location.** Default to a folder outside the repository (`../proto-<slug>/`), or an ignored folder inside it (`prototypes/`), verified with `git check-ignore -q prototypes/probe`. Put a short `README.md` at its top: the question, and "Disposable: do not import". Install any library only inside the scratch folder, never in the project's manifest.

   **Check:** `git status` in the project shows nothing new from the prototype.

4. **Build the smallest thing that answers the question.** Hard-code everything that is not under test. For UI variants, keep the content identical and vary only the dimension being compared, so the comparison is fair. Keep a running note of surprises; they are often worth more than the main answer.

   **Check:** The prototype runs and produces the observation named in the deciding result, or the timebox has expired.

5. **Run it and collect evidence.** Save printed output, logged responses, timings from several runs, or screenshots of each UI variant taken by the browser agent at the same viewport. For questions about feel, let the user try it and record their reaction in their own words.

   **Check:** The evidence is saved (pasted output, screenshots or files) and maps directly to the deciding result.

6. **Report the answer.** Fill in the report template below: yes, no, or inconclusive with the reason, then the evidence, the surprises and what it means for the design. Inconclusive is a legitimate result; say what a second prototype would have to test.

   **Check:** The report states the decision it supports, and the user has read it.

7. **Delete or archive.** Ask the user which. To delete, remove the scratch folder, or discard the worktree through `/git-worktrees`. To archive, keep only the report, with at most the key snippet as a code block inside it, in `docs/prototypes/YYYY-MM-DD-<slug>.md` or the design doc; never keep runnable prototype source in the repository. Then confirm nothing in production refers to it:

   ```bash
   git grep -n -E "proto-|prototypes/" -- ':!docs'
   ```

   **Check:** The scratch code is gone or reduced to the report, and the search finds no production reference.

8. **Feed the decision back.** Add the answer and a link to the report to the design doc or decision log. If the choice is expensive to reverse, record it with `/architecture-decision`. When the real feature comes next, start it fresh with `/tdd`, writing production code from what was learned rather than copying the prototype.

   **Check:** The design artifact cites the prototype report.

## Report template

```markdown
# Prototype: <short question> (YYYY-MM-DD)

- Question: ...
- Deciding result: ...
- Answer: yes / no / inconclusive (why)
- Evidence: output, timings or screenshots
- Surprises: ...
- Decision it supports: ...
- Disposal: deleted / archived here (key snippet below)
```

## Choosing the comparison for UI questions

| Question | Variant set |
| :--- | :--- |
| Which layout scans fastest? | Same content in 2-3 layouts; ask the user to find one item in each |
| Is this flow too long? | The flow as designed, and one with a step merged or removed |
| Does this density work on mobile? | One variant, screenshotted at 375 px and 1280 px widths |
| Which empty state explains itself? | 2-3 empty-state treatments, with no surrounding UI |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Start coding, then decide what is being tested | Write the question card first | Without a deciding result, any outcome looks like success |
| Prototype inside `src/` "temporarily" | Use a scratch folder outside the repo or ignored | Temporary code gets imported and shipped |
| Polish the prototype with tests, types and error handling | Stop when the question is answered | Polish is wasted effort and tempts promotion to production |
| Answer three questions with one prototype | One question per prototype | Mixed variables give mixed answers |
| Merge the prototype as the first version | Rebuild from the learning, test-first | Prototype shortcuts become production bugs |
| Use real customer data or live keys | Fake data, sandbox or test mode | Scratch code has none of production's safeguards |
| Run past the timebox | Report "inconclusive" with the next step | Overruns are how prototypes turn into projects |

## Verification checklist

- [ ] A question card with a deciding result, a timebox and a location was agreed before any build.
- [ ] The prototype lived outside production code, and no project manifest changed.
- [ ] No real secrets or production data were used.
- [ ] Evidence was collected and the answer was reported with the template.
- [ ] The prototype was deleted or reduced to an archived report, and `git grep` finds no production reference.
- [ ] The design doc or decision log cites the answer.

## Related

- Workflows: `/idea-to-design`, `/design-interrogation`, `/slice-into-tickets`, `/git-worktrees`, `/architecture-decision`, `/tdd`, `/game-build`, `/perf-audit`.
- Knowledge: `product-discovery`, `browser-automation`, `ui-ux-design`.
