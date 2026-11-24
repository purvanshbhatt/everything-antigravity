---
name: file-backed-planning
disable-model-invocation: true
description: >-
  Keeps an agent's working memory for long, multi-step tasks in three small
  project files: a plan with phases and status, a findings log with sources,
  and a progress log that records every error and attempted fix. Re-reads the
  plan before major decisions, writes findings as it researches, and archives
  the files at the end. Use for tasks that span many steps, sessions or
  subagents, or when work keeps drifting from the goal.
---

# File-backed Planning

Conversation context is a poor place to keep the plan for a long task: it gets compacted, it is invisible to subagents, and it vanishes when the session ends. This skill moves working memory into three short files on disk that the agent reads and updates as it goes. Goals stay in recent context because the agent re-reads them, discoveries are written down once instead of rediscovered, and failed fixes are not tried twice.

## When to use

- The task has more than about five steps, or will take more than one session.
- Research across many files, pages or services must be collected before deciding.
- Several subagents need a shared view of goals and findings.
- The session has drifted: the agent is solving something adjacent to the original goal, or repeating a fix that already failed.
- The user asks to "keep notes as you go" or "track what you tried".

## When not to use

- Small tasks that fit in one short conversation: the task list artifact is enough.
- Saving a summary at the end of a session for later: `/session-save`.
- Marking a milestone with a verification run and a commit: `/checkpoint`.
- Deciding what to drop from a long context: `context-compaction`.
- Writing a formal spec or design for others to approve: `/write-spec` or `/blueprint`.

## Workflow

1. **Create the work folder.** Use a short task slug and keep the folder out of version control without touching the shared `.gitignore`:

   ```bash
   mkdir -p .work/auth-migration
   echo ".work/" >> .git/info/exclude
   ```

   ```powershell
   New-Item -ItemType Directory -Force .work/auth-migration | Out-Null
   Add-Content .git/info/exclude ".work/"
   ```

   If the user prefers notes outside the repo, use a scratch folder instead and record its path in the implementation plan artifact.

   **Check:** `git status --short` does not list `.work/`.

2. **Write the plan file.** Create `plan.md` from the template below with `write_to_file`: the goal in one sentence, how "done" will be verified, constraints, and three to seven phases with a status each. Mirror the phases in Antigravity's task list artifact so the user sees the same structure.

   **Check:** The goal and the done-criteria fit in four lines, and every phase has a status.

3. **Re-read the plan before every major decision.** Before switching phases, choosing between approaches, delegating to a subagent, or starting anything irreversible, open `plan.md` with `view_file`. This puts the goal back at the end of the context, where it carries the most weight.

   **Check:** Each phase change in `progress.md` is preceded by a plan read in the same step.

4. **Write findings as you research.** After every two or three reads, searches or browser-agent visits, append what you learned to `findings.md`: the fact, where it came from (`file:line`, URL or command), and why it matters for the goal. Write facts, not narration. Merge duplicates instead of appending them.

   **Check:** Any claim the final answer relies on can be traced to a findings entry with a source.

5. **Log progress and every error.** Append to `progress.md` after each meaningful action. For errors, record the exact message, the hypothesis, the attempted fix and the result. Before retrying any fix, search the log for the same error. After three failed attempts at one error, stop, record what was learned, and change approach or ask the user.

   **Check:** No fix appears twice in the log for the same error with the same result.

6. **Share with subagents by path.** When delegating, pass the paths to `plan.md` and `findings.md` and the phase being delegated. Ask the subagent to return findings in the same format, or to append under its own heading. The parent agent merges, deduplicates and updates phase status; subagents never edit `plan.md`.

   **Check:** After a delegation, the parent updated the plan and the findings contain the subagent's results with sources.

7. **Keep the files short.** Prune as you go: `plan.md` under about 80 lines, findings deduplicated, and older progress entries collapsed into a one-line summary per phase. A long notes file stops being read, which defeats its purpose.

   **Check:** Each file can be read in one `view_file` call without scrolling past irrelevant history.

8. **Close out.** When the goal is verified, write the outcome at the top of `plan.md`. Move durable lessons somewhere permanent: an instinct (`eag instincts add --trigger "<when>" --action "<do>"`), a doc update, or an ADR. Then ask the user whether to delete the work folder, archive it, or hand it to `/session-save`. Never commit the folder unless the user asks.

   **Check:** Lessons are recorded somewhere permanent, and the user chose what happens to `.work/<slug>/`.

## Templates

`plan.md`:

```markdown
# Plan: migrate session auth to OIDC
Goal: users sign in through the company IdP; local passwords are removed.
Done when: e2e login suite passes against staging IdP; no code reads `users.password_hash`.
Constraints: no downtime; keep the API contract; ask before any DB migration.

| # | Phase | Status | Notes |
| :--- | :--- | :--- | :--- |
| 1 | Map current auth paths | done | see findings F1-F6 |
| 2 | Add OIDC login behind a flag | in progress | |
| 3 | Migrate sessions | pending | needs user approval for migration |
| 4 | Remove password code | pending | |

## Decisions
- D1: use the framework's built-in OIDC client, not a new dependency (F4).
```

`findings.md`:

```markdown
## F4 Framework already ships an OIDC client
- Source: node_modules/<framework>/docs/auth.md; package.json pins 4.2.1
- Matters because: no new dependency; supports PKCE by default.
```

`progress.md`:

```markdown
- 14:05 Phase 2 started (plan re-read).
- 14:20 ERROR `redirect_uri mismatch` on local login.
  Hypothesis: IdP app registered with 127.0.0.1, app uses localhost.
  Tried: switched app base URL to 127.0.0.1. Result: login succeeds.
```

## Files versus Antigravity artifacts

| Need | Use |
| :--- | :--- |
| User reviews the approach before work starts | Implementation plan artifact |
| User sees live step status | Task list artifact |
| Agent memory that survives compaction and sessions | `plan.md`, `findings.md`, `progress.md` |
| Shared state for subagents | The work folder paths, passed in the brief |
| Evidence of what was done, for the user | Walkthrough artifact, built from `progress.md` |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Keep the plan only in the conversation | Write it to `plan.md` and re-read it | Compaction and new sessions lose it |
| Log narration ("Now I will look at...") | Log facts, sources, errors and results | Narration buries the information |
| Retry a failed fix without checking the log | Search `progress.md` for the error first | Repeating failures burns time and context |
| Let subagents rewrite the plan | Parent merges; subagents return findings | Concurrent edits corrupt shared state |
| Let the files grow without limit | Prune and summarize each phase | Long notes stop being read |
| Commit the work folder by default | Exclude it locally; ask at the end | Notes may contain paths, hostnames or internal details |
| Write secrets or tokens into notes | Reference the secret's name or location only | Notes get shared and archived |

## Verification checklist

- [ ] The work folder exists, is excluded from git, and holds the three files.
- [ ] `plan.md` states the goal, done-criteria, constraints and phases with current status.
- [ ] The plan was re-read before every phase change and delegation.
- [ ] Every finding the outcome relies on has a source.
- [ ] Every error has its attempted fix and result logged, and no fix was repeated blindly.
- [ ] Durable lessons were moved to an instinct, doc or ADR, and the user decided the folder's fate.
- [ ] No secrets appear in any of the files.

## Related

- Workflows: `/checkpoint`, `/session-save`, `/session-resume`, `/orchestrate`, `/instincts`, `/instinct-capture`, `/blueprint`, `/write-spec`.
- Knowledge: `context-compaction`, `subagent-delegation`.
- Agents: `planner` (drafting phases for a large task), `codebase-explorer` (research phases).
