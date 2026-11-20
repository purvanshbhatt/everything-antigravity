---
name: session-resume
description: >-
  Loads the latest (or a chosen) EAG session summary, re-validates its claims
  against the current repository (commits, working tree, branch, gates since the
  summary was written), and produces a short "where we are, what changed, next 3
  steps" brief before any work starts. Use when continuing yesterday's task,
  after a fresh conversation, or when taking over a hand-off. Invoke with /session-resume.
---

# Session Resume

A saved summary is a claim about the past, not a fact about the present. Since
it was written, teammates may have pushed, branches may have been rebased, and
tests may have changed. Load the summary, check every claim that matters against
the repository, and only then act.

## When to use

- The user says "continue", "where were we", "pick up from yesterday", "resume".
- A fresh conversation after `/checkpoint` or `/session-save`.
- Taking over work someone else saved for this project.
- The SessionStart hook injected a summary and the next action depends on it being accurate.

## When not to use

- Starting new work with no prior session: use `/codebase-onboard` for an unfamiliar repo or `/blueprint` for a new feature.
- Saving state: use `/session-save` or `/checkpoint`.
- Debugging why something that worked yesterday is broken today: resume first, then switch to `/root-cause`.

## Workflow

Commands use `eag`. If it is not on `PATH`, run `node <plugin-root>/bin/eag.js <command>`
instead, where `<plugin-root>` is two levels above this SKILL.md.

1. **Pick the right summary.**

   ```bash
   eag sessions latest
   eag sessions list          # newest first; add --project <repo-root> from a subdirectory
   ```

   The newest entry may be a short automatic summary written by the Stop hook. If a richer one titled `session:` or `checkpoint:` exists and is newer than the work you are resuming, open that one with `view_file` instead. If the user named a topic or date, choose by title. If the list is empty, say so and offer `/codebase-onboard`.

   **Check:** You can state which summary you loaded, its title and its timestamp.

2. **Extract the claims.** Pull out: branch, SHA, gate status, items marked done, items in progress, next steps, open questions, and the commands to re-run. These are what you will verify.

   **Check:** You have a short list of claims, each tagged with how you will test it.

3. **Re-validate against the repository.**

   ```bash
   git fetch --quiet                                 # skip if offline; note it in the brief
   git rev-parse --abbrev-ref HEAD
   git rev-parse --verify --quiet "<recorded-sha>^{commit}"
   git log --oneline <recorded-sha>..HEAD
   git log --oneline "HEAD..@{upstream}"             # remote commits you don't have (quotes matter in PowerShell)
   git status --short
   git diff --stat <recorded-sha>
   ```

   - The recorded SHA no longer exists (rebased or force-pushed): fall back to `git log --oneline --since="<summary timestamp>"`.
   - Different branch checked out than recorded: ask before switching; uncommitted work may be at stake.
   - Lockfile or dependency manifests changed since the SHA: reinstall before trusting test results.
   - Files listed under "Files touched" are missing or renamed: find them with `find_by_name` before assuming they are lost.

   **Check:** Every claim is labelled `confirmed`, `changed` or `unknown`, with the command output that decided it.

4. **Re-run the cheap gates.** Run `/verify quick` (or the summary's non-side-effecting "commands to re-run"). Never run commands tagged `[side effect]`, or anything that migrates, seeds, deploys or deletes, without asking.

   **Check:** The current gate result is known, and it is compared with the summary's recorded result.

5. **Reconcile.** Strike next steps that later commits already completed. If someone else changed files the next steps touch, re-read those files before planning. If gates went from PASS to FAIL with no local changes, the first next step becomes investigating that regression. If open questions are still unanswered, put them at the top.

   **Check:** The next steps reflect the repository as it is now, not as it was.

6. **Write the brief** in chat (template below), then create or refresh the task-list artifact from the next steps. If the user's message already asked to continue, start step 1 immediately; otherwise wait for a go-ahead.

   **Check:** The brief fits on one screen and ends with exactly three next steps.

## Patterns

### Brief template

```markdown
## Resuming: <topic> (summary from <date>, <title>)

**Where we are:** <2-4 lines: goal, what is done, what is half-done>

**What changed since:** <n> new commits (<authors or "only mine">), branch <same|different>,
gates <PASS|FAIL> now vs <PASS|FAIL> then, deps <changed|unchanged>.

**Drift:**
- <claim> -> changed: <what is true now>

**Next 3 steps:**
1. <action with file path> - verify with `<command>`
2. ...
3. ...

**Waiting on you:** <open question, or "nothing">
```

### Drift decision table

| Finding | Action |
| :--- | :--- |
| No new commits, clean tree matches summary | Proceed with next step 1 |
| New commits by others touching the same files | Re-read those files, then re-plan |
| Recorded SHA missing (history rewritten) | Use `--since` on the timestamp; ask the user what happened if work seems lost |
| Uncommitted changes not mentioned in the summary | Show them; ask whether they belong to this task before touching anything |
| Gates now red, were green | Investigate before new work; consider `/root-cause` |
| Summary older than about two weeks | Treat it as background only; re-derive the plan from the code |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Start executing "next steps" straight from the injected summary | Validate claims against `git` and the gates first | The repository may have moved; stale plans produce conflicting edits |
| Assume the newest entry is the useful one | Check the title; prefer the rich `session:` or `checkpoint:` summary | Automatic Stop-hook summaries are short by design |
| Re-run every command in "commands to re-run" | Run only verification commands; ask before side effects | Migrations, seeds and deploys are not idempotent |
| Switch branches or stash to match the summary | Ask first and show what would be affected | Uncommitted work can be lost |
| Paste the whole summary back to the user | Give the brief: where, what changed, next three | The user wants orientation, not a transcript |

## Verification checklist

- [ ] The loaded summary is named (title and timestamp) in the brief.
- [ ] Branch, SHA and commits since were checked with real `git` output.
- [ ] Current gate status is known and compared with the recorded one.
- [ ] No side-effecting command ran without approval.
- [ ] The brief lists drift and exactly three next steps, each with a proving command.
- [ ] The task-list artifact matches the next steps.

## Related

- Workflows: `/session-save`, `/checkpoint`, `/verify`, `/codebase-onboard`, `/root-cause`, `/blueprint`.
- Knowledge: `context-compaction`, `git-workflow`.
- Agents: `codebase-explorer` (when many files changed since the summary and you need a quick map).
