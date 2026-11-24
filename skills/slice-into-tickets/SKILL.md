---
name: slice-into-tickets
disable-model-invocation: true
description: >-
  Breaks a spec, PRD, design doc or conversation into thin vertical tickets,
  each end-to-end, demoable and sized for one agent session, with acceptance
  criteria, a verification command, a size estimate and explicit blocked-by
  links that form a checked dependency graph, then writes them as local files
  or, after confirmation, to the issue tracker. Use when approved work spans
  several sessions. Invoke with /slice-into-tickets.
---

# Slice into Tickets

Turn an approved description of work into thin, vertical tickets that each deliver something a person can see working. Every ticket fits in one focused agent session, says how to prove it is done, and names what must land before it. The result is a dependency graph that one agent can work through in order, or several can work in parallel.

## When to use

- A spec, PRD, design doc or decision log is approved, and building it will take more than one session.
- "Break this into tickets", "turn this into issues", "make a backlog from this".
- Preparing work for parallel agents (`/orchestrate`) or for a team.
- An existing backlog is made of layer tickets ("all the database work") that can never be demoed alone.

## When not to use

- Nothing is approved yet: `/idea-to-design` or `/write-spec` first.
- The change fits in one session: `/blueprint` gives step-level detail instead.
- Triaging incoming bug reports: `/issue-triage`.
- Sprint planning, estimation and forecasting for a team: `agile-project-management`.

## Vertical, not horizontal

| Horizontal (avoid) | Vertical (aim for) |
| :--- | :--- |
| "Create all the database tables" | "A user can save one draft and still see it after reload" (table, API and UI for that one path) |
| "Build the API layer" | "An admin can list drafts, newest first, read-only" |
| "Write the tests" | Tests live inside every ticket |

The first ticket is usually a walking skeleton: the thinnest path through every layer the feature needs, with trivial behaviour, proving the wiring, the data path and the deploy.

## Workflow

1. **Read the source and pin the scope.** Read the spec or design and the code it touches. List the user-visible outcomes it promises and its explicit non-goals. If open questions in the source would change the slicing, list them and ask before slicing, or run `/design-interrogation`.

   **Check:** You have a numbered list of outcomes, each traceable to a sentence in the source.

2. **Find the skeleton.** Identify the thinnest path that touches every layer and runs in the real environment: entry point (UI, CLI or endpoint), logic, storage and deploy. Make it ticket 1.

   **Check:** Ticket 1 can be demoed by itself and has no blockers.

3. **Cut outcomes into vertical tickets.** Slice each outcome along its user-visible path, then split further where needed: the happy path before its variants, one input type at a time, read before write, one role at a time, manual before automated, the simple rule before the edge cases. Fold infrastructure that has no visible outcome of its own into the first ticket that needs it.

   **Check:** Every ticket ends with a sentence like "<who> can <do what> and sees <result>", or for internal work, "<command> shows <result>".

4. **Size every ticket for one session.** Estimate S, M or L from concrete signals: files touched, new concepts, unknowns, and whether a migration is involved. A session-sized ticket is one reviewable PR, a few hundred changed lines at most, with no more than one unknown. Split every L. When a ticket's main risk is an unknown, add a timeboxed spike ticket before it (run with `/throwaway-prototype`) and make the real ticket depend on the spike.

   **Check:** No ticket is L, and every unknown has a spike ticket or a named owner.

5. **Write acceptance criteria and a verification step.** Give each ticket two to five criteria in observable terms (Given/When/Then, or plain checks) and at least one command or manual step that proves them, for example `pnpm test drafts`, `pytest tests/test_drafts.py -k reload`, or "with the browser agent, open /drafts, save twice, reload". Name the non-goals each ticket deliberately skips.

   **Check:** A reviewer could mark every criterion pass or fail without asking the author.

6. **Link dependencies and check the graph.** Add a "blocked by" edge only when a ticket truly cannot start without another ticket's code or decision. Then check the graph: no cycles (when A needs B and B needs A, merge them or re-slice), no ticket blocked by more than about three others, and a critical path as short as possible. Mark which tickets can run in parallel. Render the graph:

   ```mermaid
   graph TD
     T1[T1 skeleton: save one draft] --> T2[T2 list drafts]
     T1 --> T3[T3 edit a draft]
     T3 --> T4[T4 autosave]
     T2 --> T5[T5 delete with undo]
   ```

   **Check:** A topological order exists, and the set of tickets that can start right after T1 is listed.

7. **Review with the user.** Present the ticket table (ID, title, size, blocked by, parallel with) and the graph as an artifact. Ask three things: is anything from the source missing, should anything be cut, and is the order acceptable?

   **Check:** The user approved the list, or the requested changes were applied and shown again.

8. **Write the tickets.** By default, write local Markdown files in the folder the project already uses, otherwise `docs/tickets/<NNN>-<slug>.md`, plus an `index.md` holding the table and the graph. Write to an issue tracker only when the user asks, after stating the exact number of issues and the target repository or project. On GitHub, create blockers first so later tickets can cite real numbers: `gh issue create --title "<title>" --body-file <file> --label <label>`, then edit the dependent bodies to say "Blocked by #N". For Linear, Jira or other trackers, use their MCP server if one is configured.

   **Check:** Every ticket exists in exactly one place, and every "blocked by" reference points to a real ticket.

## Ticket template

```markdown
# T3: Edit a saved draft
Size: M - Blocked by: T1 - Parallel with: T2
Source: docs/design/2026-11-20-drafts.md, section "Editing"

## Outcome
A signed-in user can open a saved draft, change its text, save, and see the change after reload.

## Acceptance criteria
- [ ] Given a saved draft, when the user edits and saves it, then a reload shows the new text.
- [ ] Saving an unchanged draft performs no write.
- [ ] Opening another user's draft returns 404.
- Not in scope: autosave (T4), version history (later).

## Verify
- `pnpm test drafts/edit`
- Browser agent: open /drafts/<id>, edit, save, reload, confirm the text.

## Notes
Likely touches: src/drafts/api.ts, src/drafts/EditDraft.tsx. No migration.
```

## Splitting moves

| The ticket is too big because... | Split by |
| :--- | :--- |
| It handles many input kinds | One kind per ticket, the most common first |
| It serves several roles | One role per ticket |
| It has a happy path and many errors | Happy path first, then error handling grouped by cause |
| It reads and writes | Read-only first, then write |
| It needs a UI and an automated job | Manual trigger first, then the scheduled job |
| It depends on an unknown | A timeboxed spike, then the real ticket |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Slice by layer | Slice along a user-visible path | Layer tickets cannot be demoed or verified alone |
| Create a separate "write tests" ticket | Put tests inside each ticket | The testing ticket is the one that gets cut |
| Keep an L "do the feature" ticket | Split until every ticket is S or M | Large tickets hide unknowns and stall |
| Add blocked-by edges "to be safe" | Link only real code or decision dependencies | False edges kill parallelism |
| Write criteria like "works well" | Write observable pass/fail checks | Unverifiable tickets are never finished |
| Bulk-create issues before review | Review the list, then create on request | Issues notify people and are tedious to undo |

## Verification checklist

- [ ] Every ticket is vertical, demoable, and sized S or M.
- [ ] Ticket 1 is a walking skeleton with no blockers.
- [ ] Every ticket has two to five observable criteria and a verification command or step.
- [ ] The dependency graph is acyclic, and parallel-ready tickets are marked.
- [ ] Every outcome in the source maps to at least one ticket, and non-goals were not ticketed.
- [ ] Tickets were written locally, or to a tracker only after the user confirmed the count and target.

## Related

- Workflows: `/idea-to-design`, `/write-spec`, `/design-interrogation`, `/blueprint`, `/feature-dev`, `/orchestrate`, `/throwaway-prototype`, `/issue-triage`.
- Agents: `planner`, `product-manager`.
- Knowledge: `agile-project-management`, `product-requirements`.
