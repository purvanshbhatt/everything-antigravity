---
name: product-requirements
disable-model-invocation: true
description: >-
  Writes and reviews product requirements documents (PRDs): problem statement,
  target users and evidence, goals and success metrics with guardrails, scope
  and non-goals, numbered requirements with acceptance criteria, risks, rollout
  and the review process. Use when the user asks for a PRD, product brief,
  one-pager or feature requirements, or wants an existing PRD reviewed before
  engineering starts.
---

# Product Requirements

A PRD makes one decision reviewable: which problem we will solve, for whom, how
we will know it worked, and what we will not do. It owns the what and the why;
the technical spec (`/write-spec`) owns the how.

## When to use

- "Write a PRD", "product brief", "one-pager", "requirements for feature X".
- A feature is entering planning and engineering asks what "done" means.
- Reviewing a PRD for gaps before a review meeting.
- Turning validated discovery findings into a scoped commitment.

## When not to use

- The problem is not validated yet: run `product-discovery` first.
- Architecture, APIs, data model or migration design: `/write-spec` or `/blueprint`.
- Ranking many candidate features against each other: `roadmap-prioritization`.
- Bug reports and small tickets: `/issue-triage`.

## Workflow

1. **Collect inputs.** Gather discovery notes, interview quotes, support tags, analytics, sales feedback and constraints (deadline, team, budget). Search the repo (`grep_search` over `docs/`) and the user's Drive for prior PRDs and the team's own template; use theirs if it exists. Tag every claim as **evidence** (with a link) or **assumption**.

   **Check:** At least one piece of user evidence with a source supports the problem. If none exists, the PRD says so and lists discovery as a dependency.

2. **Write the problem before any solution.** Use: "*<Segment>* trying to *<job>* cannot *<outcome>* because *<obstacle>*, which costs them *<impact>*."

   **Check:** The statement names no feature, and someone outside the team can repeat it back.

3. **Define users and scenarios.** Name the primary persona, any secondary persona and who is explicitly out of scope. Write 2-4 short scenarios as narratives (trigger, steps, desired end state).

   **Check:** Every requirement written later maps to at least one scenario.

4. **Set goals, success metrics and guardrails.** One primary metric with baseline, target and measurement window, plus 1-3 guardrails that must not get worse (latency, support contacts, churn). Use placeholders when the baseline is unknown and add an instrumentation task (`product-analytics`).

   **Check:** Each metric has a definition, data source, baseline (or "measure by *<date>*") and an owner.

5. **Scope with priorities and non-goals.** Label requirements Must / Should / Could / Won't (this release). Write non-goals that a reasonable stakeholder might expect, so the absence is a decision, not an oversight.

   **Check:** At least three non-goals; every Must is needed for the primary metric or a hard constraint.

6. **Write numbered requirements with acceptance criteria.** IDs (R1, R2...) let tickets, designs and tests reference them. Use Given / When / Then for behaviour. Replace adjectives with thresholds.

   **Check:** Each requirement is testable; no "fast", "intuitive" or "simple" without a number or an observable behaviour.

7. **List risks, dependencies and open questions.** Cover the four product risks: value, usability, feasibility, viability (including legal, privacy and support load). Every open question has an owner and a due date.

   **Check:** No open question is unowned; privacy-relevant data flows are flagged for `gdpr-privacy` review.

8. **Plan rollout.** Feature flags, beta cohort, migration of existing users, docs and support enablement, launch communications, and kill criteria (what result makes us roll back).

   **Check:** Rollout names who is told what before launch, and the rollback trigger is a metric, not a feeling.

9. **Run the review.** Produce the PRD as an Antigravity artifact or a Google Doc. Ask for comments from engineering, design, data, support and legal as relevant. Record decisions in the decision log. Share outside the immediate team, or post to channels, only after the user confirms.

   **Check:** Every comment is resolved or converted to an open question, and status moves Draft, In review, Approved with a date.

## PRD template

```markdown
# <Feature> PRD
Status: Draft | In review | Approved    Owner: <name>    Updated: <date>
Reviewers: <eng>, <design>, <data>, <support>    Target release: <cycle>

## 1. Problem          <one-paragraph problem statement>
## 2. Evidence         <quotes, tickets, data with links; assumptions labelled>
## 3. Users and scenarios
## 4. Goals and metrics
| Metric | Definition | Baseline | Target | Window | Source | Owner |
Guardrails: <metric must stay within <range>>
## 5. Non-goals
## 6. Requirements
| ID | Priority | Requirement | Acceptance criteria (Given/When/Then) |
## 7. UX               <flows, wireframe links, states: empty, loading, error>
## 8. Risks, dependencies, open questions (owner, due date)
## 9. Rollout          <flag, cohorts, comms, support, kill criteria>
## 10. Decision log    <date, decision, who, why>
```

## Review rubric

| Section | Red flag | Ask |
| :--- | :--- | :--- |
| Problem | Describes a solution ("users need a dashboard") | What do they do today, and what does it cost them? |
| Evidence | Only internal opinions | Which customers, tickets or data show this? |
| Metrics | Output metric ("ship X") or no baseline | Which behaviour changes, from what to what? |
| Scope | No non-goals; everything is a Must | What would we cut if we had half the time? |
| Requirements | Untestable adjectives, UI dictated in detail | How would QA verify it? Can design choose the UI? |
| Risks | Only feasibility listed | What if users do not adopt it, or support load doubles? |
| Rollout | "Launch to everyone" | What is the rollback trigger, and who gets told first? |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Start with the solution | Start with the problem and evidence | Solution-first PRDs lock in the first idea and skip alternatives |
| Specify pixel-level UI in requirements | State behaviour and constraints; link designs | Design and engineering need room to find better solutions |
| Leave success undefined | One primary metric, baseline, target, guardrails | Without it, nobody can decide whether to iterate or stop |
| Omit non-goals | List what is out and why | Unstated scope becomes scope creep in review |
| Write a 30-page PRD | Keep the core to a few pages; link appendices | Long PRDs go unread and drift from reality |
| Treat the PRD as frozen | Keep a decision log and update status | Teams build from stale documents |

## Verification checklist

- [ ] The problem statement names a segment, job, obstacle and impact, with no feature in it.
- [ ] Evidence and assumptions are labelled, with links for evidence.
- [ ] One primary metric and at least one guardrail have definitions, baselines or measurement dates, and owners.
- [ ] Non-goals list at least three plausible expectations.
- [ ] Every requirement has an ID, a priority and testable acceptance criteria.
- [ ] Open questions have owners and due dates.
- [ ] Rollout includes a kill criterion; sharing beyond the team was confirmed by the user.

## Related

- Knowledge: `product-discovery`, `roadmap-prioritization`, `product-analytics`, `ab-testing`, `okrs`, `ux-research`, `documentation-writing`, `gdpr-privacy`.
- Workflows: `/write-spec`, `/blueprint`, `/feature-dev`, `/issue-triage`.
- Agents: `product-manager`, `ux-designer`, `technical-writer`.
