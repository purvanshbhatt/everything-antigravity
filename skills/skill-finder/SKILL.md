---
name: skill-finder
description: >-
  Finds the right EAG skill for a goal ("which skill should I use?"): reads the eag-* indexes, shortlists 1-3 with reasons and an order, offers to run the best. Invoke with /skill-finder.
---

# Skill Finder

Turns a goal stated in plain words into the one to three EAG skills that fit it best, with a reason for each and, when the goal spans phases, the order to run them in. Most pack skills are slash-only and cost no context until opened, so this workflow reads the sixteen category indexes instead of guessing from memory. It recommends and offers; nothing runs until the user agrees.

## When to use

- The user asks "which skill should I use for this?", "is there a skill for...", or "what can this pack do for...".
- The user describes a goal but not a command, and more than one skill could plausibly fit.
- The goal spans phases (shape an idea, plan, build, verify, ship) and the user wants the route.
- Before a large task, to check whether a pack workflow already encodes the procedure.

## When not to use

- The user already named a slash command: run that command.
- The request is a one-line answer or a quick edit: answer it, because routing would cost more than it saves.
- The user wants to write a new skill: `/skill-create`.
- The user wants to audit installed plugins, name clashes or the context budget: `/harness-audit`.

## Workflow

1. **Restate the goal in one line.** Capture four things: the outcome wanted, the artifact produced (code, doc, plan, report, asset), the technology or domain, and the phase (exploring, designing, building, fixing, verifying, shipping, operating). If two readings of the request lead to different skills, ask one question to settle it and offer your guess as the default.

   **Check:** The restatement names an outcome and a phase, and the user has not contradicted it.

2. **Pick the indexes to read.** Choose one to three from the index map below. Add `eag-workflows` whenever the goal is a job with steps (debug, review, plan, test, ship, migrate), because workflows are listed there whatever the domain. Open each chosen index with `view_file`; the paths in the map are relative to this file.

   **Check:** You opened every index you rely on, rather than inferring its rows from its name.

3. **Collect candidates.** Scan each index table and match on the job to be done first, then the artifact, then the technology. One shared keyword is not a match: "Docker" in a question about pods crashing on GKE points to `kubernetes-gke`, not `/dockerize`. Also check for workspace and personal skills, which win on a name clash: use `find_by_name` for `SKILL.md` under `.agents/skills/` in the workspace and under `~/.gemini/config/skills/` (on Windows, `%USERPROFILE%\.gemini\config\skills\`). Recommend only skills that are installed; if a missing plugin would fit better, name it as an option and never install it unasked.

   **Check:** You have two to eight candidates, and each traces to an index row or a skill file on disk.

4. **Confirm the top candidates against their own text.** For the best three, `view_file` the candidate's SKILL.md and read its "When to use" and "When not to use" sections. Drop any candidate whose "When not to use" list covers the goal, and follow its pointer to the better skill instead.

   **Check:** Each surviving candidate's own "When to use" list contains the goal or a close variant of it.

5. **Shortlist and sequence.** Keep one to three. Tie each reason to the user's words, not to a paraphrase of the skill's description. When the goal spans phases, give the order (see the common routes below) and mark which step is the entry point now. When nothing fits, say so plainly, offer the nearest partial fit or direct help, and mention `/skill-create` if the need is likely to recur.

   **Check:** There are at most three recommendations, each with a one-line reason, and a "no fit" answer names what is missing.

6. **Offer to run the best fit.** Use the output format below. Ask; do not start. On a yes, `view_file` the chosen SKILL.md and follow it from its first step, passing the restated goal in as its input. Never install, enable or download a skill or plugin without explicit confirmation.

   **Check:** The user answered the offer, and the next action is the chosen skill's first step (or nothing, if they declined).

## Index map

| Index | Read it when the goal involves |
| :--- | :--- |
| [eag-workflows](../eag-workflows/SKILL.md) | Any multi-step job: debug, review, plan, test, verify, ship, release, onboard, clean up |
| [eag-languages](../eag-languages/SKILL.md) | Writing or reviewing code in a specific language or runtime |
| [eag-frontend-web](../eag-frontend-web/SKILL.md) | Web UI frameworks, CSS, design systems, forms, client state, PWAs, accessibility |
| [eag-backend-apis](../eag-backend-apis/SKILL.md) | Services, APIs, events, queues, caching, search, payments, email |
| [eag-data](../eag-data/SKILL.md) | Schemas, queries, databases, warehouses, pipelines, vector stores |
| [eag-cloud-devops](../eag-cloud-devops/SKILL.md) | Cloud services, Kubernetes, infrastructure as code, deploys, incidents, cost |
| [eag-security](../eag-security/SKILL.md) | Vulnerabilities, secrets, supply chain, compliance regimes |
| [eag-testing-quality](../eag-testing-quality/SKILL.md) | Test types beyond unit tests, linting, static analysis, profiling, tech debt |
| [eag-ai-ml](../eag-ai-ml/SKILL.md) | Gemini, agents, Antigravity customization, MCP, RAG, evals, model training |
| [eag-mobile-desktop](../eag-mobile-desktop/SKILL.md) | Mobile and desktop apps, app store releases |
| [eag-games](../eag-games/SKILL.md) | Game engines, game systems, shaders, multiplayer |
| [eag-media-design](../eag-media-design/SKILL.md) | Images, video, audio, slides, brand identity, UI and UX design |
| [eag-writing-research](../eag-writing-research/SKILL.md) | Articles, editing, translation, literature reviews, talks, grants |
| [eag-business](../eag-business/SKILL.md) | Product, roadmaps, analytics, marketing, sales, pricing, finance, hiring |
| [eag-dev-tooling](../eag-dev-tooling/SKILL.md) | Git, docs, dev environments, CLIs, SDKs, editor and browser extensions |
| [eag-industry](../eag-industry/SKILL.md) | Specialist domains: healthcare, fintech, IoT, embedded, robotics, GIS, science |

## Common routes

| Goal shape | Route |
| :--- | :--- |
| Fuzzy idea to shipped feature | `/idea-to-design`, then `/design-interrogation`, then `/slice-into-tickets` or `/blueprint`, then `/feature-dev`, then `/pr-ready` |
| Design question only running code can answer | `/throwaway-prototype`, then `/architecture-decision` |
| Something is broken or regressed | `/root-cause`, then `/verify`, then `/pr-ready` |
| Red build, type errors or lint | `/build-fix`, then `/verify` |
| A reviewer left comments on my PR | `/review-feedback-response`, then `/verify` |
| Several agents working in one repository | `/git-worktrees`, then `/orchestrate` |
| Unfamiliar codebase | `/codebase-onboard`, then `/explain-code` |
| "Keep it simple" for the rest of the session | `/yagni-minimalism` (a mode that stays on until switched off) |
| Cutting a release | `/verify`, then `/release-management` |

## Output format

```text
Goal: <one-line restatement, including the phase>

1. /<best> - <why it fits, in the user's terms>
2. /<second> - <why, and when to prefer it over 1>
3. <knowledge-skill> - <what it adds alongside the workflow>

Order: /<a>, then /<b>, then /<c>        (multi-phase goals only)
Not covered: <part of the goal no skill handles>   (only when true)

Run /<best> now? (yes / use 2 or 3 instead / no)
```

Worked example. The user says: "Checkout got slow after last week's deploy and I need it fixed before Friday's release."

```text
Goal: fix a performance regression on the checkout page before a release (phase: fixing).

1. /perf-audit - baselines checkout, profiles it, and proves the fix with before-and-after numbers.
2. /root-cause - prefer it if the slowdown maps to one commit; it can bisect last week's deploys.
3. web-performance - Core Web Vitals fixes once the bottleneck is known.

Order: /perf-audit, then /verify, then /release-management

Run /perf-audit now? (yes / use 2 or 3 instead / no)
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Recommend from memory of the catalog | Read the indexes and the candidate SKILL.md files | Names and scopes change; the files are the contract |
| Match on a single keyword | Match the job, then the artifact, then the technology | Keyword hits route to the wrong phase or the wrong layer |
| List six options to be safe | Cap at three, ranked, each with a reason | A long list hands the routing work back to the user |
| Force a weak match | Say no skill covers it and help directly | A wrong procedure is worse than none |
| Start the recommended workflow unasked | Offer it and wait for a yes | The user may want a different entry point or order |
| Install a plugin to fill a gap | Name it and ask before installing | Installs change the user's environment |

## Verification checklist

- [ ] The goal was restated in one line with an outcome and a phase.
- [ ] Every index used was opened, not guessed from its title.
- [ ] Each recommendation was checked against its own "When to use" and "When not to use" sections.
- [ ] One to three recommendations, each with a goal-specific reason; multi-phase goals have an order.
- [ ] Gaps were stated, not papered over with a weak match.
- [ ] Nothing ran, installed or changed before the user said yes.

## Related

- Workflows: `/skill-create`, `/harness-audit`, `/feature-dev`, `/blueprint`, `/orchestrate`.
- Knowledge: `antigravity-customization`, `subagent-delegation`.
