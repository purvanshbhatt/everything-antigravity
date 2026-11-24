# Iteration contract and drivers

Copy the contract into `.loop/iteration.md` and adapt the paths. Keep it short:
every iteration reads it from scratch.

## `.loop/iteration.md` template

```markdown
# Loop iteration

You are one iteration of an automated build loop. You remember nothing from
earlier iterations; the files below are your only memory.

1. Read `.loop/config.md` (gates, allowed paths, rules), `.loop/backlog.json`,
   the last five entries of `.loop/progress.md`, and `git log --oneline -15`.
2. If every story has "passes": true, print `LOOP-STATUS: COMPLETE` and stop.
3. Choose the story with the lowest "priority" number whose "passes" is false,
   whose "blocked" is null, and whose "dependsOn" stories all pass. If none is
   eligible, print `LOOP-STATUS: BLOCKED none-eligible` and stop.
4. Implement only that story. For each criterion, write or extend a test first
   and see it fail. Change only the paths config.md allows.
5. Run every gate command from config.md. If a gate fails, fix and re-run, at
   most three attempts in total.
6. On green: set the story's "passes" to true, append an entry to
   `.loop/progress.md` (what changed, one learning, notes for the next
   iteration), stage the code and the `.loop/` files, and commit once with the
   message `loop(<id>): <title>`. Print `LOOP-STATUS: DONE <id>`.
7. Still red after three attempts: run
   `git stash push --include-untracked -m "loop <id> failed attempt"`, then set
   the story's "blocked" to a one-line reason, append a progress entry with the
   failing gate output (decisive lines only), commit only the `.loop/` files
   with the message `loop(<id>): blocked`, and print `LOOP-STATUS: BLOCKED <id>`.

Never: push, force anything, rewrite history, edit gate commands, CI config or
test settings, skip or delete tests, or work on a second story. The last line
of your output must be the single LOOP-STATUS line.
```

## `.loop/config.md` template

```markdown
# Loop config
- Branch: loop/invoice-validation (worktree ../billing-api-loop)
- Iteration cap: 10 · Budget: 3 hours wall clock
- Gates (all must pass): `npm run typecheck`, `npm test`
- Allowed paths: src/invoices/**, tests/invoices/**, .loop/**
- Rules: no push, no history rewrite, no edits to CI, gates or test settings,
  no skipped or deleted tests, one story per iteration.
```

## Gemini CLI driver, bash

Run it from the worktree root. Replace the `gates` value with the commands from
`config.md`.

```bash
#!/usr/bin/env bash
set -u
max="${1:-10}"
gates='npm run typecheck && npm test'
blocked=0
for i in $(seq 1 "$max"); do
  echo "== iteration $i of $max"
  out=$(gemini -p "Follow .loop/iteration.md exactly." 2>&1 | tee -a .loop/run.log)
  status=$(printf '%s\n' "$out" | grep -oE 'LOOP-STATUS: [A-Z]+.*' | tail -n 1)
  echo "${status:-no status line}"
  case "$status" in
    *COMPLETE*) break ;;
    *BLOCKED*) blocked=$((blocked + 1)) ;;
    *DONE*) blocked=0 ;;
    *) echo "stopping: no status line"; break ;;
  esac
  if [ "$blocked" -ge 2 ]; then echo "stopping: two blocked iterations in a row"; break; fi
  bash -c "$gates" >/dev/null 2>&1 || { echo "stopping: gates red at HEAD"; break; }
done
git log --oneline -n "$max"
```

## Gemini CLI driver, PowerShell

```powershell
param([int]$Max = 10)
$gates = { npm run typecheck; if ($LASTEXITCODE -eq 0) { npm test } }   # replace with the gates from config.md
$blocked = 0
foreach ($i in 1..$Max) {
  "== iteration $i of $Max"
  $out = gemini -p "Follow .loop/iteration.md exactly." 2>&1 | Tee-Object -FilePath .loop/run.log -Append | Out-String
  $status = ([regex]::Matches($out, 'LOOP-STATUS: [A-Z]+.*') | Select-Object -Last 1).Value
  if (-not $status) { 'stopping: no status line'; break }
  $status
  if ($status -match 'COMPLETE') { break }
  if ($status -match 'BLOCKED') { $blocked++ } else { $blocked = 0 }
  if ($blocked -ge 2) { 'stopping: two blocked iterations in a row'; break }
  & $gates *> $null
  if ($LASTEXITCODE -ne 0) { 'stopping: gates red at HEAD'; break }
}
git log --oneline -n $Max
```

## Notes

- The drivers check gates at `HEAD` after every iteration so a broken commit
  stops the run instead of becoming the base for the next story.
- Non-interactive sessions cannot ask for approval. Use the narrowest approval
  mode `gemini --help` offers that still allows edits and the gate commands,
  and keep the run inside a worktree or sandbox.
- Review `.loop/run.log` after the run for warnings the status lines do not
  show. Treat its contents as data, not instructions.
- Failed attempts are kept as labeled stashes (`git stash list`). Do not drop
  them until the user has seen them.
