---
name: architecture-decision
description: >-
  Records an architecture decision as an ADR: frames one decision and its
  forces, gathers at least two real options with evidence from the code and
  docs, compares them against weighted drivers, states the decision,
  consequences and a revisit trigger, and files it in the project's ADR log
  with status and superseding links. Use when choosing a database, framework,
  pattern or boundary, or to record a decision. Invoke with /architecture-decision.
---

# Architecture Decision

Write down a significant decision, the options that were on the table and
the reasons, so future engineers can tell whether it still holds. An ADR
records one decision; it is short, dated, immutable once accepted, and
superseded rather than edited when things change.

Usage: `/architecture-decision <decision to make or record>`.

## When to use

- Choosing a database, message broker, framework, hosting model, auth approach or module boundary.
- A decision is hard to reverse, affects several teams, or keeps getting re-argued.
- Recording a decision already made (retroactive ADRs are valuable; mark them as such).

## When not to use

- A full design for a change with rollout and test plans: `/write-spec` (which can spawn ADRs).
- Reversible, local choices (a helper library inside one module): a code comment or PR description is enough.
- Gathering external evidence at depth: run `/research-synthesis` first and cite it.

## Workflow

1. **Find the ADR log and its conventions.** Use `find_by_name` for `docs/adr`, `doc/adr`, `doc/architecture/decisions`, `adr` and an `.adr-dir` file (adr-tools). Read two existing ADRs for format (Nygard-style or MADR), numbering, status values and language. If none exists, propose `docs/adr/` starting with `0001-record-architecture-decisions.md`, and confirm with the user.

   **Check:** You know the directory, the next number and the template the project uses.

2. **Frame one decision.** Title it as the decision ("Use PostgreSQL for order storage"), or as the question while it is Proposed. Write the context: the problem, the forces (functional needs, quality attributes such as latency, availability and cost, constraints such as team skills, compliance and deadlines) and the scope. Name the deciders.

   **Check:** The question can be answered by choosing exactly one option.

3. **Gather real options with evidence.** At least two credible options plus the status quo. For each: how it meets each force, evidence (prototype, benchmark, documentation marked "verify against current docs", existing usage in the codebase found with `grep_search`), cost, operational burden and exit cost. Delegate a challenge pass to the `code-architect` subagent: ask it to argue for the strongest option you are leaning against.

   **Check:** Every option has at least one con, and the status quo is evaluated honestly.

4. **Compare against weighted drivers.** Pick 3-6 decision drivers, weight them, and score the options in a table. Classify reversibility: a one-way door (expensive to undo) deserves more evidence than a two-way door.

   **Check:** The chosen option wins on the drivers as weighted, or the ADR explains why the decision overrides the scores.

5. **State the decision and consequences.** The decision in one or two sentences, in active voice. Consequences: positive, negative (accepted costs and risks) and follow-up work. Add a revisit trigger ("revisit if write volume exceeds 5k/s or the managed offering changes pricing").

   **Check:** At least one negative consequence is listed; the revisit trigger is measurable.

6. **File it and link it.** Create `NNNN-kebab-title.md` with the next number and status Proposed. If it replaces an earlier ADR, set the new one to "Supersedes ADR-NNNN" and update only the old ADR's status line to "Superseded by ADR-MMMM"; never rewrite an accepted ADR's content. Ask the user to review; set Accepted only when the deciders agree.

   **Check:** The file exists with the correct number and status, and superseding links go both ways.

7. **Make it enforceable where possible.** If the decision constrains code structure, add a fitness function: dependency rules (dependency-cruiser, import-linter, ArchUnit), a lint rule or a CI check, and reference it in the ADR.

   **Check:** The ADR names its enforcement mechanism, or states that none applies.

## Template

```markdown
# NNNN. <Decision title>

- Status: Proposed | Accepted | Deprecated | Superseded by ADR-MMMM
- Date: YYYY-MM-DD
- Deciders: <roles or names>
- Related: <spec, issues, ADRs>

## Context
<Problem, forces, constraints, scope. Facts with sources.>

## Decision drivers
1. <driver> (weight 3)
2. <driver> (weight 2)

## Considered options
1. <Option A>
2. <Option B>
3. Keep the status quo

## Comparison
| Driver (weight) | Option A | Option B | Status quo |
| :--- | :--- | :--- | :--- |
| Operational burden (3) | 2 | 3 | 3 |
| Query flexibility (2) | 3 | 1 | 1 |

## Decision
We will <decision>, because <main reasons tied to drivers>.

## Consequences
- Positive: ...
- Negative: ... (accepted because ...)
- Follow-up: ...

## Revisit when
<measurable trigger>
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Record several decisions in one ADR | One decision per file | Decisions get superseded independently |
| List only the winning option | Show real alternatives and the status quo | Future readers need to know what was rejected and why |
| Edit an accepted ADR when things change | Write a new ADR that supersedes it | The log's value is its history |
| Hide the downsides | List negative consequences explicitly | Accepted costs are what future teams need to know |
| Cite vendor claims as facts | Mark them and verify against current docs or a prototype | Marketing pages change and overstate |

## Verification checklist

- [ ] Project ADR location, numbering and format followed.
- [ ] One decision, with context and forces.
- [ ] At least two real options plus the status quo, each with evidence and cons.
- [ ] Weighted comparison and reversibility stated.
- [ ] Decision, consequences (including negatives) and a measurable revisit trigger.
- [ ] Status set correctly; supersede links both ways; user asked to review.

## Related

- Knowledge: `software-architecture`, `documentation-writing`, `knowledge-management`, `domain-driven-design`, `tech-debt`.
- Workflows: `/write-spec`, `/research-synthesis`, `/blueprint`.
- Agents: `code-architect`.
