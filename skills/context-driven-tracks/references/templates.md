# Context and track templates

Fill these in from the survey and the interview. Delete any heading that would
stay empty rather than leaving placeholder text in the repository.

## project-context/product.md

```markdown
# Product
## Who it is for
- Primary users: <role, context, what they are trying to get done>
## Problems we solve
1. <problem, with how users cope today>
## Goals (next two quarters)
- <measurable goal, e.g. "export a month of invoices in under 30 s">
## Non-goals
- <what we deliberately do not do, and why>
```

## project-context/guidelines.md

```markdown
# Product guidelines
- Voice and tone: <e.g. plain, direct, no exclamation marks in UI copy>
- Naming: <domain terms and the words we never use for them>
- UX rules: <e.g. every destructive action has an undo or a confirmation>
- Accessibility bar: <e.g. WCAG 2.2 AA>
```

## project-context/tech-stack.md

```markdown
# Tech stack
| Area | Choice | Version | Why |
| :--- | :--- | :--- | :--- |
| Language | TypeScript | 5.x (from package.json) | ... |
| Web framework | ... | ... | ... |
| Database | ... | ... | ... |
| Hosting | ... | ... | ... |
Changing anything in this table needs a track or an ADR.
```

## project-context/workflow.md

```markdown
# Workflow
## Gates (every task commit)
- `npm run lint`
- `npm run typecheck`
- `npm test`
## Tests
- Write the failing test first; see it fail for the right reason.
- Coverage of changed lines: at least <N>%.
## Commits
- Conventional Commits subject: `<type>(<scope>): <summary>`.
- Trailers on every track commit: `Track: <id>` and `Task: <N.M>`.
- Commit locally after each task; never push without asking.
## Phase checkpoints
- Run the full gates, list manual checks, wait for the user's confirmation.
```

## project-context/principles.md

```markdown
# Principles
Plans cite these by number. Amending one needs the user's approval and a dated
note below.

P1. Money is stored and computed in integer minor units, never floats.
P2. Every public endpoint has an integration test.
P3. No new runtime dependency without a line in tech-stack.md.
P4. User-visible errors say what happened and what to do next.
P5. Data migrations are backward compatible for one release.

## Amendments
- <yyyy-mm-dd> P3 changed from ... to ... because ...
```

## project-context/tracks.md

```markdown
# Tracks
| Status | Track | Title | Phase |
| :--- | :--- | :--- | :--- |
| in progress | 20261123-invoice-export | CSV export of invoices | 2 of 3 |
| planned | 20261125-dunning-emails | Reminder emails for overdue invoices | - |
| done | 20261101-tax-rates | Per-region tax rates | 3 of 3 |
```

## tracks/<id>/spec.md

```markdown
# Spec: <title>
Track: <id> · Status: draft | approved | done
## Problem
## Users and stories
- As a <role>, I want <capability> so that <outcome>.
## Acceptance criteria
1. <observable check: command, response, UI behaviour>
## Non-goals
## Constraints
- From principles: P1, P4
- From tech stack: ...
## Open questions
- <question> (owner, due)
## What shipped
- <filled in at the end, with deviations from the plan and why>
```

## tracks/<id>/plan.md

```markdown
# Plan: <title>
Track: <id> · Spec: ./spec.md

## Phase 1: Data access
- [x] 1.1 Failing test for the invoice query by month (P1) (a1b2c3d)
- [x] 1.2 Implement the query with an index on issued_at (c3d4e5f)
- [x] 1.checkpoint Run `npm run export:dry -- --month 2026-10`; the row count matches the admin report

## Phase 2: CSV export
- [x] 2.1 Failing test for header and row formatting (P1, P4) (d4e5f6a)
- [~] 2.2 Implement the CSV writer
- [ ] 2.3 Stream rows instead of buffering the whole month
- [ ] 2.checkpoint Export 10,000 invoices from the admin UI; the file opens in a spreadsheet and the totals match
```
