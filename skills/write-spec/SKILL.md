---
name: write-spec
disable-model-invocation: true
description: >-
  Writes a technical spec or design doc for a change: problem, goals and
  non-goals, current state grounded in the code, a proposed design with
  interfaces and data model, at least two real alternatives, risks, rollout
  and rollback, test plan and open review questions, saved as a reviewable
  artifact. Use when a change needs agreement before code, or the user asks
  for a design doc, RFC or tech spec. Invoke with /write-spec.
---

# Write Spec

Get agreement on what to build and why this way before anyone writes code.
A good spec is grounded in the actual codebase, shows the options that were
rejected, and ends with specific questions reviewers can answer.

Usage: `/write-spec <change or problem>`.

## When to use

- A change crosses modules or teams, alters a public contract or data model, or is expensive to reverse.
- The user asks for a "design doc", "RFC", "tech spec" or "proposal".
- Reviewers keep relitigating a design during code review: write it down first.

## When not to use

- Product requirements (users, problem, success metrics, without design): `product-requirements`.
- An agreed design that now needs atomic implementation steps: `/blueprint`.
- One focused decision between options: `/architecture-decision`.
- A small, reversible change: just do it with `/feature-dev`.

## Workflow

1. **Intake.** Capture the problem, who asked, deadline, constraints, decision makers and reviewers. Read any PRD, issue or prior spec. Ask the user for anything missing that changes the design (scale, compliance, budget).

   **Check:** You can state the problem in two sentences and name who approves the spec.

2. **Ground it in the code.** Delegate a breadth scan to the `codebase-explorer` subagent, then use `grep_search` and `view_file` on the affected modules: data model, APIs, call sites, configuration, tests, related ADRs. Write the "Current state" section with file paths.

   **Check:** Every statement about current behaviour cites a path (and line where useful).

3. **Set goals, non-goals and success metrics.** Goals are outcomes, not tasks. Non-goals name tempting adjacent work you are deliberately not doing. Metrics are measurable (p95 latency, error rate, adoption, cost).

   **Check:** Each goal has a metric or an observable acceptance test.

4. **Design contracts first.** API signatures, schemas, events and data model changes before internals. Then components and data flow (Mermaid or ASCII diagram), failure modes and retries, migration strategy (expand and contract), and cross-cutting concerns: security, privacy, observability, performance, cost, accessibility, internationalization.

   **Check:** A reviewer could write a client or a test against the contracts as written.

5. **Compare real alternatives.** At least two, plus "do nothing". Score each against the forces from steps 1 and 3 in a table. Delegate a challenge pass to the `code-architect` subagent with the draft and ask it to argue for the strongest rejected option.

   **Check:** Each rejected option has a specific reason a reviewer could disagree with.

6. **Plan risk, rollout, rollback and tests.** Risks with likelihood, impact and mitigation; rollout behind a feature flag or in stages; data migration and backfill plan; rollback steps that have been thought through for data, not just code; monitoring and alerts; test plan by level (unit, integration, contract, E2E, load). Run `/threat-modeling` if the change touches auth, payments, personal data or external input.

   **Check:** Rollback is possible at every stage, or the spec says explicitly where it is not.

7. **Write, file and request review.** Use the [spec template](references/template.md). Save it where the project keeps specs (look for `docs/specs/`, `docs/design/`, `rfcs/`), otherwise as `docs/specs/YYYY-MM-DD-<slug>.md`, and present it as an artifact. End with numbered review questions addressed to roles ("Security: is per-tenant key scoping sufficient?"). Do not start implementing until the user approves; then hand off to `/blueprint`.

   **Check:** The spec is saved, reviewers are named and the user has been asked to approve.

## Patterns

| Section | Good | Weak |
| :--- | :--- | :--- |
| Goal | "Exports finish in under 60 s for 95% of accounts" | "Make exports faster" |
| Non-goal | "No change to the export file format" | (missing) |
| Alternative | "Queue-based async export: rejected because users need the file in the same session; costs a second worker pool" | "Other approaches are worse" |
| Review question | "Data: is a 7-day retention of export files acceptable under our policy?" | "Thoughts?" |

Size the spec to the risk: one page for a medium change, five to ten for a new service. Length is not rigor.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Describe current behaviour from memory | Cite files and lines | Specs built on wrong assumptions get rebuilt in review |
| Present one option | Show at least two plus "do nothing" | Reviewers need to see the trade-off you made |
| Leave rollback as "revert the commit" | Plan for data written by the new version | Code reverts don't un-migrate data |
| Mix implementation tasks into the spec | Hand off to `/blueprint` after approval | Specs decide what and why; plans decide steps |
| Start coding while the spec is in review | Wait for approval | Rework is cheapest before code exists |

## Verification checklist

- [ ] Problem, goals, non-goals and measurable success metrics are stated.
- [ ] Current state cites code paths.
- [ ] Contracts are concrete enough to test against.
- [ ] At least two alternatives plus "do nothing", with reasons.
- [ ] Risks, rollout, rollback (including data) and test plan are present.
- [ ] Saved in the project's spec location; numbered review questions; approval requested.

## Related

- Workflows: `/blueprint`, `/architecture-decision`, `/threat-modeling`, `/feature-dev`, `/research-synthesis`.
- Knowledge: `product-requirements`, `software-architecture`, `api-design`, `database-migrations`, `feature-flags`.
- Agents: `codebase-explorer`, `code-architect`, `planner`.
