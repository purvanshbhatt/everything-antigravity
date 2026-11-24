---
name: curriculum-design
disable-model-invocation: true
description: >-
  Designs courses, workshops and training with backward design: audience
  analysis, measurable learning objectives using Bloom's verbs, assessments
  aligned to each objective, hands-on exercises with checkpoints and
  solutions, timed pacing plans, and pilot-and-revise loops. Use when the user
  is creating a course, workshop, bootcamp module, onboarding program or
  tutorial series, or needs exercises and assessments.
---

# Curriculum Design

Start from what learners must be able to do at the end, decide how you will
know they can, and only then choose content and activities. Every minute of
the schedule should map to an objective.

## When to use

- "Design a two-day Kubernetes workshop", "build an onboarding curriculum", "write exercises for this module".
- Turning internal knowledge or a codebase into a course or tutorial series.
- Fixing a course where learners finish but cannot apply the material.

## When not to use

- A single conference talk: `conference-talks`. Slide craft: `presentation-slides`.
- Reference documentation: `documentation-writing`.
- Team wiki structure: `knowledge-management`.

## Workflow

1. **Analyse the audience.** Prior knowledge, role, motivation, constraints (time, devices, bandwidth, accessibility needs) and setting (live, self-paced, cohort). Run a short pre-survey when possible.

   **Check:** You can describe the least-prepared learner you must still serve.

2. **Write measurable objectives.** Use ABCD (Audience, Behavior, Condition, Degree) and observable verbs from Bloom's revised taxonomy. Keep 3-7 per module.

   **Check:** Every objective contains an observable verb; none says "understand" or "know about".

3. **Design assessments before content.** For each objective, decide the evidence: a quick check (formative) during the session and a task or project (summative) at the end, with a rubric.

   **Check:** The alignment matrix (below) has no objective without an assessment and no assessment without an objective.

4. **Sequence and chunk.** Order from prerequisites to synthesis. Alternate short instruction (about 10-15 minutes) with practice. Use worked examples first, then faded examples with gaps, then independent problems.

   **Check:** No instruction block runs longer than ~20 minutes without learner activity.

5. **Build exercises that cannot stall the room.** Starter repository with one git tag per checkpoint (`step-1`, `step-2`) so anyone can catch up, a solutions branch, tiered hints, and stretch goals for fast learners. Eliminate setup risk with a devcontainer, Codespaces, Cloud Shell or a pre-flight script that learners run before day one.

   **Check:** A tester went from clean machine to the final checkpoint using only the written instructions.

6. **Write the pacing plan.** Minute-level schedule with buffers (about 10-15% slack), breaks at least every 90 minutes, and a list of what to cut if running late.

   **Check:** The schedule sums to the session length including breaks and buffer.

7. **Make it accessible.** Captions or transcripts for video, readable slides (high contrast, large fonts), materials shared in advance, alt text, and exercises that work with a keyboard and screen reader.

   **Check:** Materials pass the `accessibility-a11y` basics.

8. **Pilot, measure, revise.** Run with 3-5 representative learners, observe where they get stuck, time each block, and collect feedback. Evaluate with Kirkpatrick levels: reaction, learning (assessment results), behaviour (applied on the job), results.

   **Check:** The revision list cites observed evidence (times, error points, scores), not only opinions.

## Patterns

Bloom's revised taxonomy verbs:

| Level | Verbs |
| :--- | :--- |
| Remember | list, name, identify |
| Understand | explain, summarize, classify |
| Apply | implement, configure, use, execute |
| Analyze | debug, compare, trace, differentiate |
| Evaluate | justify, critique, choose, assess |
| Create | design, build, compose, propose |

Alignment matrix:

| Objective | Formative check | Summative evidence | Activities |
| :--- | :--- | :--- | :--- |
| Given a failing pod, learners diagnose the cause using `kubectl describe` and logs within 10 minutes | Predict-the-output quiz on `describe` output | Debug three broken deployments, 2 of 3 correct | Demo, worked example, pair debugging |

90-minute workshop skeleton:

| Minutes | Block |
| :--- | :--- |
| 0-10 | Hook, objectives, environment check |
| 10-25 | Concept + worked example |
| 25-45 | Exercise 1 (checkpoint `step-1`) |
| 45-50 | Debrief, common mistakes |
| 50-65 | Concept 2 + faded example |
| 65-80 | Exercise 2 (checkpoint `step-2`), stretch goals |
| 80-90 | Recap, exit ticket, next steps |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Start from a slide deck | Start from objectives and assessments | Content-first courses cover a lot and teach little |
| "Understand X" objectives | Observable verbs with conditions and criteria | You cannot assess understanding directly |
| Live-install tools in the session | Pre-flight script or cloud environment | Setup failures eat the first hour |
| One long lecture, then one big lab | Interleave short instruction and practice | Attention and retention drop in long passive blocks |
| Only collect satisfaction scores | Measure learning and on-the-job behaviour | Learners can enjoy a course that changes nothing |

## Verification checklist

- [ ] Audience analysed; least-prepared learner described.
- [ ] Objectives are measurable and aligned to assessments and activities.
- [ ] Exercises have checkpoints, solutions, hints and stretch goals.
- [ ] Environment setup tested from a clean machine.
- [ ] Pacing plan sums correctly and includes buffers and cut list.
- [ ] A pilot ran and revisions are evidence-based.

## Related

- Knowledge: `conference-talks`, `presentation-slides`, `documentation-writing`, `dev-environments`, `developer-relations`, `knowledge-management`, `accessibility-a11y`.
- Agents: `technical-writer`.
