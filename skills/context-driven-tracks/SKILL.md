---
name: context-driven-tracks
disable-model-invocation: true
description: >-
  Runs spec-driven development in tracks. A one-time setup writes persistent
  project context (product, guidelines, tech stack, workflow, principles);
  each feature or fix then becomes a track with its own spec and phased plan,
  built one tested commit per task with a manual checkpoint per phase, plus
  status reports and git-aware revert. Sub-steps: setup, new, implement,
  status, revert. Invoke with /context-driven-tracks.
---

# Context-Driven Tracks

Agents forget between sessions; the repository does not. This workflow keeps the project's intent in versioned Markdown so every session, and every teammate's agent, starts from the same goals, stack, workflow rules and principles. Each unit of work is a track: a spec, a phased plan, and commits tagged with trailers so the track can be reported on and reverted as a unit.

Usage: `/context-driven-tracks setup`, `new "<description>"`, `implement [track-id]`, `status`, or `revert <track-id> [phase N | task N.M]`.

## When to use

- Structured work on a project that will span many sessions, people or agents.
- The user wants spec-first development: "spec it, plan it, then build it", "set up project context", "start a new track".
- A team wants every agent run to follow the same workflow rules and principles.
- Features that may need to be undone cleanly later ("revert the export track").

## When not to use

- A change of a few files: `/feature-dev` or `/tdd`.
- Only a design document or only a plan, with no lifecycle: `/write-spec` or `/blueprint`.
- An unattended run through a backlog: `/fresh-context-loop`, which can take a track's tasks as its stories.
- Recording one architectural choice: `/architecture-decision`.

## Files

```text
project-context/
├── product.md        # users, problems, goals, non-goals
├── guidelines.md     # product and UX rules, tone, naming
├── tech-stack.md     # languages, frameworks, versions, services and why
├── workflow.md       # gate commands, commit format, test policy, checkpoint rules
├── principles.md     # numbered rules (P1, P2, ...) that plans must cite
├── styleguides/      # optional, one file per language
├── tracks.md         # registry: one line per track with its status
└── tracks/<track-id>/
    ├── spec.md
    └── plan.md
```

Templates for every file: [references/templates.md](references/templates.md).

## Workflow

### setup

1. **Survey before asking.** If `project-context/` exists, show what is there and offer to update it rather than overwrite it. For an existing codebase, delegate a read-only survey to the `codebase-explorer` subagent: languages and versions from the manifests, test, lint and build commands, CI configuration, and conventions visible in `git log --oneline -30`.

   **Check:** You can list the stack and the gate commands, each with the file it came from.

2. **Interview, then draft.** Ask at most five questions, only about what the code cannot reveal: target users, top goals, explicit non-goals, the quality bar and any hard rules. Draft the context files with `write_to_file`. Write `principles.md` as 5 to 12 numbered, checkable rules ("P3: every public endpoint has an integration test"), never aspirations ("write clean code").

   **Check:** A reviewer could hold any diff against each principle and say whether it complies.

3. **Confirm and commit.** Present the drafts as an artifact for review and apply the user's edits. Ask whether to commit the context (recommended, so every agent and teammate shares it), then commit it as `docs(context): add project context`.

   **Check:** The user approved every file, and `workflow.md` states the gate commands and the commit format.

### new "<description>"

4. **Write the spec.** Create the track id `<yyyymmdd>-<slug>` (for example `20261123-invoice-export`) and write `tracks/<id>/spec.md`: problem, users and stories, acceptance criteria as observable checks, non-goals, constraints from the context files, and open questions. Get the open questions answered before planning.

   **Check:** Every acceptance criterion is observable (a command, a response, a UI behavior), and no open question remains that the user has not accepted as a risk.

5. **Write the phased plan.** In `tracks/<id>/plan.md`, split the spec into two to five phases that each deliver something verifiable, and each phase into tasks of one commit each: failing test, implementation, gates. End every phase with a checkpoint task that lists manual checks for the user. Cite principles where they shape a decision, for example `(P4)`. If the plan has to break a principle, stop and ask: either the plan changes or the user amends `principles.md` with a dated reason. Add the track to `tracks.md` as planned.

   **Check:** The user approved the spec and the plan, every task is one commit, and every phase ends in a checkpoint.

### implement [track-id]

6. **Work the next task.** Use the named track, else the one in progress, else ask. Take the first task not marked `[x]` and mark it `[~]`. Follow `workflow.md`: failing test first, minimal code, then the gates with `run_command`. Commit with the format from `workflow.md` plus two trailers:

   ```text
   feat(export): stream invoice rows to CSV

   Track: 20261123-invoice-export
   Task: 2.3
   ```

   Then mark the task `[x]` with the short SHA and commit the plan change as `chore(tracks): complete task 2.3` with the same two trailers. Reverting a task then reverts its checkbox too.

   **Check:** The gates passed before the commit, and both the code commit and the plan commit carry `Track:` and `Task:` trailers.

7. **Stop at each phase checkpoint.** When a phase's tasks are done, run `/verify full`, then give the user the checkpoint's manual checks: what to open, run or click, and what they should see. Wait for confirmation before starting the next phase. Record the outcome in `plan.md` and commit it as `chore(tracks): checkpoint phase 2` with the trailers `Track: <id>` and `Task: 2.checkpoint`.

   **Check:** The user confirmed the manual checks, and no task of the next phase started before that.

8. **Finish the track.** When all phases pass, mark the track done in `tracks.md`, add a short "What shipped" note to the spec (including deviations from the plan and why), and offer `/pr-ready`. If the work revealed new conventions, propose context-file updates and apply only the ones the user approves.

   **Check:** `tracks.md`, `plan.md` and the git history agree.

### status

9. **Report from the files and from git.** For each track: status, current phase, tasks done out of total, the task in progress, the last checkpoint and any blockers. Cross-check against history:

   ```bash
   git log --format='%h %ad %s' --date=short --grep='^Track: 20261123-invoice-export$'
   ```

   Flag drift in both directions: tasks marked `[x]` with no commit carrying their trailer, and trailer commits whose task is not marked done.

   **Check:** Every number in the report comes from `plan.md` or `git log`, and drift is listed rather than hidden.

### revert <track-id> [phase N | task N.M]

10. **Select commits by trailer only.** Build the list from trailers, never from guesses or subject lines:

    ```bash
    git log --format='%h %s' --grep='^Track: 20261123-invoice-export$' --grep='^Task: 2\.3$' --all-match
    ```

    Use `^Task: 2\.` for a whole phase (it includes the checkpoint commit) and the track trailer alone for the whole track. Show the list to the user, along with later commits from other work that touch the same files (`git log --oneline <oldest-sha>..HEAD -- <files>`), because reverting may conflict with them.

    **Check:** The user confirmed the exact list of commits to revert.

11. **Revert with new commits, newest first.** Never use `git reset` or rewrite history. Run `git revert --no-edit <sha>` for each commit from newest to oldest. If a revert conflicts, resolve it with `/merge-conflict-resolution`. Run the gates, then update the track's status in `tracks.md`; the plan checkboxes return to their earlier state because the plan commits were reverted too.

    **Check:** Only the confirmed commits were reverted, the gates pass, and `plan.md` shows the reverted tasks as not done.

## Reference

### Commit trailers

| Commit | Subject | Trailers |
| :--- | :--- | :--- |
| Task code | Format from `workflow.md` | `Track: <id>` and `Task: N.M` |
| Plan update | `chore(tracks): complete task N.M` | `Track: <id>` and `Task: N.M` |
| Phase checkpoint | `chore(tracks): checkpoint phase N` | `Track: <id>` and `Task: N.checkpoint` |

### Task markers in plan.md

| Marker | Meaning |
| :--- | :--- |
| `[ ]` | Not started |
| `[~]` | In progress (at most one per track) |
| `[x] ... (a1b2c3d)` | Done; the SHA is the task's code commit |
| `[!]` | Blocked; the reason follows on the same line |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Write principles as aspirations ("high quality") | Numbered, checkable rules | Plans cannot cite, and reviewers cannot check, an aspiration |
| Start coding before the plan is approved | Spec, plan, approval, then implement | A misunderstood intent costs a whole phase of rework |
| Put several tasks in one commit | One task per commit, with trailers | Status and revert lose their precision |
| Roll into the next phase without the checkpoint | Stop and wait for the user's confirmation | Manual checks catch what tests do not |
| Revert with `git reset --hard` | `git revert` of trailer-selected commits | Reset destroys unrelated work and shared history |
| Select commits by matching subject text | Match the `Track:` and `Task:` trailers | Subjects collide; trailers are exact |
| Change context files silently | Propose the change and get approval | They steer every future session |
| Ignore drift between `plan.md` and git | Run status and fix the drift | Drift makes resume and revert wrong |

## Verification checklist

- [ ] Context files exist, were approved by the user, and principles are numbered and checkable.
- [ ] Each track has an approved spec and a phased plan that cites principles where relevant.
- [ ] Every task produced a gated code commit and a plan commit, both with `Track:` and `Task:` trailers.
- [ ] Each phase stopped at its checkpoint until the user confirmed the manual checks.
- [ ] Status numbers match `plan.md` and `git log`, and drift was reported.
- [ ] Reverts used `git revert` on a user-confirmed list of trailer-selected commits only.

## Related

- Workflows: `/write-spec`, `/blueprint`, `/feature-dev`, `/tdd`, `/verify`, `/pr-ready`, `/merge-conflict-resolution`, `/fresh-context-loop`, `/architecture-decision`, `/session-resume`.
- Knowledge: `git-workflow`, `documentation-writing`.
- Agents: `codebase-explorer`, `planner`, `code-reviewer`.
