---
name: developer-relations
disable-model-invocation: true
description: >-
  Plans and measures developer relations: the developer journey and time to
  first success, friction logs, docs-first advocacy, tested sample apps,
  tutorials, talks, workshops and streams, community presence, structured
  product feedback, and metrics tied to activation. Use when the user asks for
  a DevRel strategy, a friction log, sample apps, a talk or workshop plan, or
  how to measure DevRel impact.
---

# Developer Relations

DevRel earns trust by making developers successful, then carries what they
struggle with back to the product team. Fix the path to first success before
producing more content, keep every sample runnable, and measure impact on
activation rather than applause.

## When to use

- Defining a DevRel strategy, goals or quarterly plan.
- Running a friction log on a quickstart, SDK or API.
- Planning sample apps, tutorials, workshops, talks or livestreams.
- Setting up a product feedback loop from developers.
- Reporting DevRel impact to leadership.

## When not to use

- Writing or restructuring docs themselves: `documentation-writing`.
- Writing a single tutorial post: `technical-blogging`.
- Preparing a specific conference talk: `conference-talks`.
- Running the community space and moderation: `community-management`.
- Generating client libraries: `sdk-generation`.

## Workflow

1. **Map the developer journey.** Stages: discover, evaluate, first success, build, ship to production, advocate. For each, note the entry points (search, docs, GitHub, package registry, social), the success event and where it is measured. Tie the DevRel goal to one product metric, usually activation.

   **Check:** The journey map names the first-success event and the measured median time to reach it.

2. **Run a friction log.** In a clean environment (a fresh devcontainer or VM), follow the public quickstart as a new developer. Record every step with timestamp, expectation, what happened and severity (template below). Repeat on Windows and macOS or Linux if the audience uses both.

   **Check:** Every blocker or major item has an owner and an issue link.

3. **Fix docs first.** Prioritize the quickstart, error messages, installation and authentication pages, and reference accuracy. Treat docs as code: reviewed, versioned and tested.

   **Check:** Time to first success drops in a repeat friction log.

4. **Ship tested samples.** Each sample is minimal, teaches one concept, pins dependencies, documents prerequisites, carries a licence and runs in CI on a schedule so breakage is caught before users find it. Assign an owner and a deprecation date.

   **Check:** CI passes for every sample, and each README states the tested versions.

5. **Create content and events.** Tutorials, workshops, talks and livestreams each ship with a runnable repo and a clear next step back into the product. Rehearse demos with a recorded fallback.

   **Check:** Each piece links to its repo and carries UTM-tagged links to track first success.

6. **Show up where developers are.** Answer questions in forums, Discussions, Stack Overflow and community channels. Always disclose affiliation; never astroturf or use sock-puppet accounts. Post and reply only after explicit user confirmation.

   **Check:** Replies are disclosed and link to canonical docs, not just marketing pages.

7. **Run the feedback loop.** Tag developer feedback by area and severity, count occurrences, and bring the top items to a regular product review with evidence (friction logs, quotes, counts). Tell developers when fixes ship.

   **Check:** The feedback list has counts and owners, and shipped items were announced back.

8. **Measure and report quarterly** with the metrics below.

   **Check:** The report leads with activation and feedback impact, not activity counts.

## Friction log template

```markdown
# Friction log: <product/flow> - <date> - <environment, OS, versions>
Persona: <who you are pretending to be>  Goal: <first success definition>

| Time | Step | Expected | Actual | Severity | Issue |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 00:00 | Open quickstart | Install command up top | Install buried under concepts | Minor | <link> |
| 00:07 | Run sample | Hello-world output | Auth error, no hint | Blocker | <link> |

Severity: Blocker (cannot continue), Major (needed outside help), Minor (confusing), Delight (worth keeping).
Total time to first success: <mm:ss or "not reached">
```

## Metrics

| Layer | Metric | Notes |
| :--- | :--- | :--- |
| Activation | Median time to first success; quickstart completion rate | Primary measures of DevRel impact |
| Docs | Searches with no results; top exit pages; feedback widget ratings | Shows where developers get lost |
| Samples | CI pass rate; clones and forks; issues opened | Health and use |
| Community | Questions answered and time to answer | Pair with `community-management` metrics |
| Feedback | Items raised, items shipped, time to ship | DevRel's influence on product |
| Reach | Content views, talk attendance, signups via UTM | Secondary; report but do not lead with it |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Produce content while the quickstart is broken | Friction log and fix first | Traffic to a broken path burns goodwill |
| Untested samples | CI on a schedule with pinned versions | Stale samples are the most common developer complaint |
| Report talks and followers | Report activation and feedback shipped | Activity counts do not show value |
| Answer without disclosing affiliation | Always disclose | Undisclosed promotion destroys trust and breaks community rules |
| Live demos with no fallback | Rehearse and record a backup | Conference networks and APIs fail on stage |
| Pass feedback along as anecdotes | Counts, evidence and owners | Product teams prioritize what they can measure |

## Verification checklist

- [ ] The journey map defines the first-success event and its current time.
- [ ] A friction log exists for the main quickstart, with issues filed.
- [ ] Every sample runs in CI and documents tested versions.
- [ ] Content links to runnable repos and carries UTM links.
- [ ] Community replies disclose affiliation and were posted only after explicit user confirmation.
- [ ] The quarterly report leads with activation and feedback impact.

## Related

- Knowledge: `documentation-writing`, `technical-blogging`, `conference-talks`, `community-management`, `open-source-maintenance`, `sdk-generation`, `dev-environments`, `growth-marketing`.
- Agents: `technical-writer` (docs fixes), `marketing-strategist` (program planning).
