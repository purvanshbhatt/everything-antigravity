---
name: idea-to-design
disable-model-invocation: true
description: >-
  Turns a rough idea into an approved technical design through dialogue: reads
  the project first, asks clarifying questions one at a time with multiple
  choice where possible, proposes two or three materially different approaches
  with trade-offs and a pick, walks the design section by section for
  approval, trims it with YAGNI and writes a dated design doc. Use before
  building anything non-trivial. Invoke with /idea-to-design.
---

# Idea to Design

A conversation that ends in a design the user has approved piece by piece, before any code exists. The agent does the reading, proposes the options and keeps the scope small; the user makes the calls. The output is a short, dated design doc that `/blueprint` or `/slice-into-tickets` can turn into work.

**Hard gate.** No production code, scaffolding, dependency installs or file moves until the user approves the written design. If one question needs running code to answer, use `/throwaway-prototype`, which stays outside production paths.

## When to use

- "I want to add...", "how should we build...", "let's brainstorm..." with no agreed design yet.
- A feature, tool or subsystem that two reasonable engineers would build differently.
- The user knows the goal but not the shape: the components, data flow or interfaces are unclear.
- Before `/feature-dev`, when the change spans more than a few files and the approach is not obvious.

## When not to use

- A design exists and needs stress-testing: `/design-interrogation`.
- The approach is agreed and reviewers need a formal document: `/write-spec`.
- The design is agreed and the next need is ordered steps: `/blueprint`.
- Whether the thing is worth building at all (users, value, market): `product-discovery`.
- Bug fixes and small, obvious changes: build them directly with `/tdd`.

## Workflow

1. **Read before asking.** Look at what exists: the README, `CODEMAP.md` or architecture docs, the modules the idea would touch, recent history there (`git log --oneline -20 -- <path>`), existing specs and ADRs, and the conventions in use (framework, test layout, error style). In an unfamiliar repository, run `/codebase-onboard` first or delegate a scan to the `codebase-explorer` subagent.

   **Check:** You can name the modules the idea touches and one existing pattern the design should follow.

2. **Check the size.** If the idea bundles several independent subsystems ("a plugin marketplace with billing, reviews and search"), say so and propose a split. Agree on which piece to design now; the rest become later sessions.

   **Check:** The piece being designed fits in one sentence without "and also".

3. **Ask clarifying questions, one per message.** Cover purpose, users and triggers, constraints (performance, platforms, compliance, deadline), what success looks like, and explicit non-goals. When the answer space is small, offer lettered options and mark a recommended default; ask open questions only when it is not. Stop when you could explain the purpose and limits to a new teammate, which usually takes five to ten questions.

   ```text
   Where should drafts live while the user is editing?
   (a) In the browser only; lost on another device.
       Recommended: smallest change, and it matches the settings page.
   (b) On the server, synced on every keystroke.
   (c) On the server, written on explicit save.
   ```

   **Check:** Each message held one question, and purpose, constraints and non-goals are written in your scratch notes.

4. **Propose two or three approaches that really differ.** They should differ in structure (where the logic lives, sync or async, build or buy, new service or new module), not in naming. For each, give a two-line sketch, its cost (code, operations, dependencies), what it makes easy later, what it makes hard, and its main risk. Lead with your recommendation and the reason. Include a "do less" option whenever one exists: a configuration change, an existing library, or a manual process.

   **Check:** The approaches would produce different file trees, and the recommendation is tied to a stated constraint.

5. **Present the chosen design in sections and approve each.** Size each section to its difficulty: a few sentences for simple parts, more for tricky ones. After each, ask whether it looks right before moving on.
   - Components: what each unit does, how it is used, and what it depends on
   - Interfaces and data model
   - Data flow along the main path
   - Errors and edge cases
   - Security and privacy touchpoints
   - Testing approach
   - Rollout and migration, if existing users or data are affected

   If an answer invalidates an earlier section, go back and present that section again before continuing.

   **Check:** Every section has an explicit yes from the user or a recorded change.

6. **Trim with YAGNI.** Walk the approved design and challenge every element the stated goal does not need now: options and flags, plugin points, generic layers, extra entities, scale nobody has asked for. Offer the cuts as a list and let the user decide. Move deferred ideas to a "Later" section rather than losing them.

   **Check:** Every remaining element traces to a stated goal or constraint.

7. **Write the design doc.** Save it where the project keeps designs (`docs/design/`, `docs/specs/`, `rfcs/`), otherwise as `docs/design/YYYY-MM-DD-<slug>.md`, and show it as an artifact. Use the template below. Self-review before asking the user to read it: no TBDs or placeholders, no section contradicting another, names consistent throughout, scope still one sentence. Commit it only if the user asks.

   **Check:** The file exists, the self-review found nothing outstanding, and the user approved the written version.

8. **Hand off.** Offer one next step: `/design-interrogation` for a stress test, `/slice-into-tickets` for a build that spans sessions, `/blueprint` for a single-session plan, or `/write-spec` when a formal review is required. Do not start implementing inside this workflow.

   **Check:** The user chose a next step or chose to stop.

## Design doc template

```markdown
# <Feature> design
Date: YYYY-MM-DD - Status: approved - Owner: <name>

## Goal
One paragraph: the problem, who has it, and what success looks like.

## Non-goals
- ...

## Chosen approach
Summary, and why it beat the alternatives (one line per rejected option).

## Components
| Unit | Responsibility | Interface | Depends on |
| :--- | :--- | :--- | :--- |

## Data flow
Numbered steps for the main path; add a Mermaid diagram if it helps.

## Errors and edge cases
## Security and privacy
## Testing
## Rollout
## Later (deliberately deferred)
## Open questions
```

## Choosing between approaches

| Signal in the answers | Leans toward |
| :--- | :--- |
| Small team, one deployable today | A module inside the existing app, not a new service |
| A library already solves 80% and is maintained | Buy or reuse, and wrap only what the project needs |
| Strict latency on the user path | Synchronous core path, with slow work moved to a job or queue |
| Requirements likely to change after first use | The approach that is cheapest to throw away |
| Regulated data involved | The approach with the fewest places that store or log that data |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Ask questions before reading the code | Read first, then ask what the code cannot tell you | Users lose patience with questions the repository answers |
| Ask several questions per message | One question at a time | Answers shape the next question |
| Offer three variants of one approach | Offer approaches that differ in structure | A fake choice hides the real trade-off |
| Present the whole design at once | Section by section, with approval | People skim long blocks and approve what they did not read |
| Keep "might need it" features | Move them to "Later" | Speculative scope costs build time and maintenance |
| Scaffold "to save time" | Wait for approval of the written doc | Early code anchors the design before it is agreed |
| Carry on after an answer breaks an earlier section | Re-present that section | Silent contradictions surface as rework |

## Verification checklist

- [ ] The project was read before the first question, and the design follows its existing patterns.
- [ ] Questions were asked one per message, with options where the answer space was small.
- [ ] Two or three structurally different approaches were compared, with a recommendation.
- [ ] Each design section was approved explicitly, and invalidated sections were re-approved.
- [ ] A YAGNI pass ran, and deferred items are listed under "Later".
- [ ] The dated design doc is saved, self-reviewed and approved, and no production code was written.

## Related

- Workflows: `/design-interrogation`, `/write-spec`, `/blueprint`, `/slice-into-tickets`, `/throwaway-prototype`, `/codebase-onboard`, `/architecture-decision`, `/yagni-minimalism`.
- Agents: `codebase-explorer`, `code-architect`, `ux-designer`.
- Knowledge: `product-discovery`, `software-architecture`, `ui-ux-design`.
