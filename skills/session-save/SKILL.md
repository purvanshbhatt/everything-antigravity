---
name: session-save
disable-model-invocation: true
description: >-
  Writes a rich, resumable session summary (goal, state of work, files touched,
  decisions and rationale, failed approaches, open questions, exact next steps,
  commands to re-run) and saves it to the EAG session store so a later
  conversation or teammate can continue without rediscovery. Use when ending a
  day, handing off, or pausing mid-task. Invoke with /session-save.
---

# Session Save

Capture everything the next session needs and nothing it doesn't. The Stop hook
already writes a short automatic summary every turn; this skill writes the rich
one, with the reasoning, dead ends and exact commands that an automatic summary
cannot reconstruct. The most valuable section is usually "Failed approaches".

## When to use

- The user says "save the session", "I'm done for today", "hand this off", "write up where we are".
- Pausing a multi-day task, or before switching to unrelated work in the same repository.
- Before handing work to another person or another agent.
- At the end of a `/deep-work` or `/orchestrate` run, to preserve hypotheses and stage outputs.

## When not to use

- A quick save point between phases with a commit offer: use `/checkpoint`.
- Loading a previous summary: use `/session-resume`.
- Recording one reusable lesson for all future sessions: use `/instinct-capture`; summaries describe one task, instincts generalize.
- Writing permanent project documentation: use `/update-docs`. Summaries are working notes, not docs.

## Workflow

Commands use `eag`. If it is not on `PATH`, run `node <plugin-root>/bin/eag.js <command>`
instead, where `<plugin-root>` is two levels above this SKILL.md.

1. **Collect hard facts first.**

   ```bash
   git rev-parse --abbrev-ref HEAD
   git rev-parse --short HEAD
   git status --short
   git log --oneline -10
   git diff --stat
   git stash list
   ```

   Also read the implementation plan and task list artifacts if they exist.

   **Check:** You have the branch, the HEAD SHA, every uncommitted file, and the commits made this session.

2. **Recover the narrative.** From the conversation and artifacts, extract: the goal in the user's words, what is done and verified, what is half-done, every decision with its reason and rejected alternative, every approach that failed and the evidence that killed it, and questions still waiting on the user.

   **Check:** Each failed approach has a "because" with evidence (error text, test name, measurement), not an opinion.

3. **Record the commands that rebuild state.** Exact, copy-pasteable commands to install, build, start services, seed data, and run the relevant tests. Show the PowerShell form where it differs. Mark any command with side effects (migrations, seeds, deploys) as `[side effect]` so a resuming agent asks first.

   **Check:** Running the commands in order from a clean checkout of this SHA would reproduce the current state.

4. **Write the summary** with `write_to_file` to a scratch file outside the repository (the OS temp directory) using the template below. Put the five-line TL;DR first; it is what a resuming agent reads first. Aim for 60-150 lines.

   **Check:** A teammate who never saw this conversation could take the first next step within five minutes.

5. **Scan, then save.**

   ```bash
   f="${TMPDIR:-/tmp}/eag-session.md"
   eag shield --file "$f" && eag sessions save --title "session: <topic>" < "$f"
   ```

   ```powershell
   $f = Join-Path $env:TEMP 'eag-session.md'
   eag shield --file $f
   if ($LASTEXITCODE -eq 0) { Get-Content -Raw $f | eag sessions save --title "session: <topic>" }
   ```

   If `shield` exits 1, replace each flagged value with `<redacted>` or the name of the env var that holds it, then re-run. On Windows PowerShell 5.1, set `$OutputEncoding = [System.Text.UTF8Encoding]::new()` before piping. In a monorepo or when the working directory is not the repository root, add `--project <repo-root>`.

   **Check:** `sessions save` printed a path, and `eag sessions latest` begins with your TL;DR.

6. **Report back** with the saved path, the title, and the one-line resume instruction: "start a new conversation and run `/session-resume`". Do not commit or push as part of this skill; offer `/checkpoint` if there are uncommitted changes worth keeping.

   **Check:** The user knows where the summary is and how to resume.

## Patterns

### Summary template

```markdown
# Session: <topic> (<YYYY-MM-DD HH:MM>)

## TL;DR
- Goal: <one line, in the user's words>
- State: <done | in progress | blocked>, gates <PASS|FAIL> (`<command>`)
- Branch: <branch> @ <short-sha>, <n> uncommitted files
- Next: <the single most important next action>
- Blocked on: <user decision or external thing, or "nothing">

## Goal and acceptance criteria
- <criterion that can be checked with a command or observation>

## State of work
| Item | Status | Evidence |
| :--- | :--- | :--- |
| Refresh-token rotation | done | `pytest tests/auth -q`: 14 passed |
| Revocation endpoint | in progress | handler written, no tests yet |

## Files touched
- `src/auth/refresh.py`: rotation logic (committed in a1b2c3d)
- `src/auth/routes.py`: new `POST auth/revoke` route (uncommitted)

## Decisions
- Store token family id in Redis, because revocation must be O(1). Rejected: DB column (extra query per request).

## Failed approaches
- Sliding expiry via JWT `exp` refresh: failed because clients cache tokens; `test_concurrent_refresh` raced. Do not retry without a token family.

## Open questions
- Should revoked sessions return 401 or 403? (asked the user, no answer yet)

## Next steps
1. Add tests for the revoke route in `tests/auth/test_routes.py` (happy path, unknown token, already revoked).
2. Run `pytest tests/auth -q`; expect all green.
3. Update `docs/auth.md` with the revocation flow.

## Commands to re-run
- `python -m venv .venv` then `.venv/bin/pip install -r requirements.txt` (PowerShell: `.venv\Scripts\pip install -r requirements.txt`)
- `docker compose up -d redis`
- `pytest tests/auth -q`
- `[side effect]` `alembic upgrade head`
```

### What to keep and what to drop

| Keep | Drop |
| :--- | :--- |
| Decisions with the reason and the rejected option | The play-by-play of how you reached them |
| Failed approaches with the killing evidence | Approaches that were never actually tried |
| Exact error messages that took time to understand | Full stack traces and log dumps (link the file instead) |
| Env var names that must be set | Env var values, tokens, keys, connection strings |
| Uncommitted file list | File contents |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Write "tried a few things, didn't work" | One line per failed approach with the evidence | The next session will retry the same dead end otherwise |
| List next steps without verification | Pair each step with the command that proves it | "Done" without a check is how regressions get resumed |
| Mark state "done" from memory | Re-run the gate and paste the count | Summaries outlive the conversation that could correct them |
| Record secrets or customer data | Name the env var or the source; redact values | Session files are plain text and may be synced or shared |
| Commit or push as part of saving | Offer `/checkpoint` separately | Saving notes must never change shared history |
| Hide side-effecting commands in "commands to re-run" | Tag them `[side effect]` | A resuming agent must ask before running migrations or deploys |

## Verification checklist

- [ ] TL;DR is first and fits in five lines.
- [ ] Branch, SHA and uncommitted files come from real `git` output.
- [ ] Every decision has a reason; every failed approach has evidence.
- [ ] Next steps are numbered, concrete, and each has a proving command.
- [ ] Side-effecting commands are tagged `[side effect]`.
- [ ] `eag shield --file` passed and `eag sessions latest` shows the summary.

## Related

- Workflows: `/session-resume`, `/checkpoint`, `/instinct-capture`, `/deep-work`, `/orchestrate`.
- Knowledge: `context-compaction`, `credential-sanitizer`, `documentation-writing`.
