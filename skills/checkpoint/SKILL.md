---
name: checkpoint
description: >-
  Marks a logical milestone in a long task: runs a quick verification, writes a
  compact progress summary (done, in progress, next, decisions, gotchas), saves
  it to the EAG session store, optionally commits with the user's consent, and
  recommends a fresh conversation to reclaim context. Use after finishing a
  phase, before a risky step, or when a session gets long. Invoke with /checkpoint.
---

# Checkpoint

Turn a long, context-heavy session into a verified, saved, resumable state in a
few minutes. A checkpoint is only worth something if what it records is true,
so the order is fixed: verify, then summarize, then save, then (optionally) commit.

## When to use

- A phase of the implementation plan is complete, or a group of task-list items is checked off.
- Before a risky step: a migration, a large refactor, a dependency upgrade, a rebase.
- The PreInvocation hook nudged you about session length, or you are re-reading files you already read.
- The user says "checkpoint", "save progress", "let's pause here" or "commit what we have".

## When not to use

- Handing off to another person or ending the day with lots of nuance to preserve: use `/session-save` (failed approaches, open questions, re-run commands).
- Picking work back up: use `/session-resume`.
- Preparing a branch for review: use `/pr-ready`. A checkpoint commit is a save point, not a PR.
- Nothing changed since the last checkpoint: say so and skip.

## Workflow

Commands use `eag`. If it is not on `PATH`, run `node <plugin-root>/bin/eag.js <command>`
instead, where `<plugin-root>` is two levels above this SKILL.md.

1. **Take stock of the working tree.**

   ```bash
   git status --short
   git diff --stat
   git log --oneline -5
   git rev-parse --abbrev-ref HEAD
   git rev-parse --short HEAD
   ```

   Not a git repository: list the files you edited this session from the task list instead.

   **Check:** You can name every modified and untracked file and why it changed. Files you cannot explain are asked about, never staged.

2. **Run `/verify quick`** (type-check, lint, and the tests nearest the change). Record the exact command and the pass/fail counts. A red result does not block the checkpoint; it changes what you write: gates become `FAIL`, and the first next step is the fix.

   **Check:** The summary will carry a real gate result, not "should pass".

3. **Write the summary** with `write_to_file` to a scratch file outside the repository (the OS temp directory), using the template in Patterns. Keep it under about 60 lines; the SessionStart hook injects it into future conversations.

   **Check:** Someone with no access to this conversation could continue: every next step is a concrete action with a file path, not "continue the work".

4. **Scan for secrets, then save.**

   ```bash
   f="${TMPDIR:-/tmp}/eag-checkpoint.md"
   eag shield --file "$f" && eag sessions save --title "checkpoint: <milestone>" < "$f"
   ```

   ```powershell
   $f = Join-Path $env:TEMP 'eag-checkpoint.md'
   eag shield --file $f
   if ($LASTEXITCODE -eq 0) { Get-Content -Raw $f | eag sessions save --title "checkpoint: <milestone>" }
   ```

   If `shield` exits 1, replace the flagged values with `<redacted>` and re-run. On Windows PowerShell 5.1, run `$OutputEncoding = [System.Text.UTF8Encoding]::new()` before piping so non-ASCII text survives. Run from the repository root, or add `--project <repo-root>`, so the summary lands under the right project.

   **Check:** `sessions save` printed a file path, and `eag sessions latest` prints your summary.

5. **Offer a commit; never make one silently.** Ask: "Commit these N files as `<message>`?" Only after a clear yes:

   ```bash
   git add path/one.ts path/two.ts      # explicit paths, never a blind `git add -A`
   git commit -m "feat(auth): rotate refresh tokens on use"
   ```

   Use Conventional Commits: `type(scope): imperative subject` of 72 characters or fewer, with type one of `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci` or `chore`. If gates were red, say so in the body (`git commit -m "<subject>" -m "WIP: <test> still failing"`). Never pass `--no-verify`; if a pre-commit hook fails, fix the cause or report it. Do not push unless the user asks.

   **Check:** `git log -1 --stat` matches exactly what the user approved, and `git status --short` shows only files you deliberately left out.

6. **Recommend a fresh conversation.** Tell the user the checkpoint is saved, give the path and commit SHA (if any), and suggest starting a new conversation: the SessionStart hook injects the latest summary, and `/session-resume` re-validates it. Warn that if they keep working here, the Stop hook's automatic summary becomes the latest one; `/session-resume` can still pick the checkpoint from `eag sessions list`.

   **Check:** The user has the saved path, the SHA or "not committed", and the first next step in one line.

## Patterns

### Summary template

```markdown
# Checkpoint: <milestone> (<YYYY-MM-DD HH:MM>)
Branch: <branch> @ <short-sha> | Gates: quick verify PASS|FAIL (`<command>`: <n> passed, <n> failed)

## Done
- <outcome> in `src/auth/refresh.ts` (tests: `tests/auth/refresh.test.ts`)

## In progress
- <what>: <how far>, <what is left>

## Next
1. <concrete action with file path and the command that proves it>
2. ...

## Decisions
- <decision>, because <reason>. Rejected: <alternative> (<why>).

## Gotchas
- <trap that cost time> -> <how to avoid it>
```

### When to checkpoint

| Signal | Action |
| :--- | :--- |
| A plan phase or task-list group is done | Full checkpoint plus commit offer |
| About to do something hard to undo | Checkpoint first so a clean rollback point exists |
| Hook nudge, very long session, or re-reading the same files | Checkpoint, then a fresh conversation |
| Stuck after two failed attempts on the same failure | Checkpoint the failing state, then `/root-cause` in a fresh conversation |
| A gotcha that will recur in future sessions | Also run `/instinct-capture` for it |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Summarize before verifying | Run `/verify quick` first and record the result | A summary that says "working" over red tests sends the next session down the wrong path |
| Write "continue implementing X" as the next step | Name the file, the function and the proving command | Vague next steps cost the next session 10-20 minutes of rediscovery |
| `git add -A && git commit` without asking | Show the file list and message, commit only on a yes | Commits are user-visible history; stray files and secrets get committed this way |
| Paste the whole conversation into the summary | Keep outcomes, decisions and gotchas; drop narration | The summary is injected every session and competes for context |
| Save tokens, keys or `.env` values in the summary | Run `eag shield --file` and redact | Session files are plain text on disk and may be synced |
| Keep going in the same conversation after the checkpoint | Start fresh with the summary | The whole point is reclaiming context |

## Verification checklist

- [ ] `/verify quick` ran and its exact result is in the summary.
- [ ] Every next step names a file or command.
- [ ] `eag shield --file` passed on the summary before saving.
- [ ] `eag sessions save` printed a path, and `eag sessions latest` shows the summary.
- [ ] Any commit was explicitly approved, uses a Conventional Commit message, and contains only the approved files.
- [ ] The user was told how to resume in a fresh conversation.

## Related

- Workflows: `/verify` (gates), `/session-save` (richer hand-off), `/session-resume`, `/pr-ready`, `/deep-work`, `/instinct-capture`.
- Knowledge: `context-compaction`, `git-workflow`, `credential-sanitizer`.
