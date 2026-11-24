---
name: regression-bisect
disable-model-invocation: true
description: >-
  Finds the commit that introduced a regression: writes a deterministic repro
  script that exits 0 when good and 1 when bad, proves it on a known-good and
  a known-bad commit, runs git bisect in a separate worktree, skips commits
  that cannot be tested, then confirms the culprit by reverting it on HEAD and
  reports the diff with evidence. Invoke with /regression-bisect.
---

# Regression Bisect

When something worked in an older version and is broken now, the fastest route to the cause is usually the history, not the code. A binary search over commits finds the first bad one in about log2(N) steps: ten steps for a thousand commits. It only works if the test is deterministic, so most of the effort goes into the repro script, and the result is only trusted once reverting the culprit fixes HEAD.

## When to use

- "It worked in v2.3 and fails in v2.4", "this broke sometime last month", or a test that passed on main last week fails now.
- A performance or memory regression between two releases, with a measurable threshold.
- A behaviour change after a large merge, where reading the diff is too slow.
- `/root-cause` reached the "worked before, broken now" branch and needs the full procedure.

## When not to use

- No known-good version exists: debug forward with `/root-cause`.
- The cause is outside the repository (a dependency resolved without a lockfile, the OS, data, a remote service): bisect will blame the wrong commit or none. Pin the environment first, or compare environments.
- The failure is intermittent and you cannot make the repro deterministic: stabilize it first (`concurrency-bugs`).
- A CI check is red on a pull request: `/ci-failure-triage`.

## Workflow

1. **Pin the symptom and the range.** Write down the bad behaviour, the bad ref (usually `HEAD` or a release tag) and a known-good ref. If nobody knows a good one, try older tags, or the last commit before a date:

   ```bash
   git rev-list -1 --before="2026-10-01" main
   git rev-list --count <good>..<bad>
   ```

   **Check:** You have a good ref, a bad ref and the number of commits between them.

2. **Write the repro script outside the repository**, so checkouts never change it. Contract: exit `0` when good, `1` when bad, `125` when this commit cannot be tested (it does not build, or a prerequisite is missing). Exit codes above 127 stop the bisect, and recent git versions also stop on 126 and 127, which mean the script itself could not run. The script must install dependencies when they are missing or the lockfile changed, build if needed, run only the narrowest check, and put a timeout on everything. Templates are in Patterns. Keep its absolute path in a variable:

   ```bash
   REPRO="${TMPDIR:-/tmp}/repro.sh"; chmod +x "$REPRO"
   ```

   ```powershell
   $env:REPRO = Join-Path $env:TEMP 'repro.ps1'
   ```

   **Check:** The script has a timeout, uses the lockfile, and maps "cannot build" to 125, not to 1.

3. **Isolate the work in a worktree.** Testing old commits means checking them out; do it in a separate worktree so the user's working tree, branch and uncommitted changes are never touched, and nothing needs stashing.

   ```bash
   git worktree add --detach ../bisect-wt <bad>
   cd ../bisect-wt
   ```

   **Check:** `git status` in the original working tree is unchanged.

4. **Prove the repro is deterministic.** In the worktree, run it at least ten times on the bad ref and ten times on the good ref (`git checkout --detach <ref>` between the two sets). Every bad run must exit 1 and every good run must exit 0. For performance regressions, measure the median of several runs and set the threshold halfway between the good and bad medians.

   ```bash
   for i in $(seq 1 10); do "$REPRO"; echo "exit $?"; done | sort | uniq -c
   ```

   ```powershell
   1..10 | ForEach-Object { & pwsh -NoProfile -File $env:REPRO | Out-Null; "exit $LASTEXITCODE" } | Group-Object | Select-Object Count, Name
   ```

   **Check:** 10 of 10 bad and 10 of 10 good. If not, fix the repro (seeds, clocks, ports, caches) before going further.

5. **Run the search.**

   ```bash
   git bisect start <bad> <good>                                 # add --first-parent to step only along merges on main
   git bisect run "$REPRO"                                       # bash script
   git bisect run pwsh -NoProfile -File "$env:REPRO"            # PowerShell script, run from pwsh
   git bisect log > ../bisect.log
   ```

   **Check:** Git printed "is the first bad commit" with a SHA, and the bisect log is saved.

6. **Deal with skips.** If untestable commits surround the culprit, git reports a set of candidates rather than one commit. Either make those commits testable (patch the build in the script, conditionally, for that range) and rerun, or report the candidate range honestly.

   **Check:** You have one culprit, or an explicit candidate list with the reason each one was skipped.

7. **Confirm the culprit two ways.** End the search first, then test the culprit, its parent, and the bad ref with the culprit reverted. All of this happens on detached commits inside the worktree, so no branch of the user's moves.

   ```bash
   git bisect reset                                   # in the worktree; returns it to <bad>
   git checkout --detach <culprit>  && "$REPRO"; echo "culprit: $?"   # expect 1
   git checkout --detach <culprit>^ && "$REPRO"; echo "parent: $?"    # expect 0
   git checkout --detach <bad> && git revert --no-edit <culprit> && "$REPRO"; echo "revert: $?"   # expect 0
   ```

   If the revert conflicts, revert only the hunks that touch the failing path, and say so in the report.

   **Check:** The culprit fails, its parent passes, and the bad ref with the revert passes.

8. **Explain, report and clean up.** Read `git show <culprit>`, find the hunk that matters (revert hunks one at a time if the commit is large), and write the report from the template in Patterns. Hand the fix to `/root-cause` or `/tdd`, with the repro as the regression test. Then go back to the original repository and remove the worktree:

   ```bash
   git worktree remove ../bisect-wt     # if it refuses because of build output, check git status there, then add --force
   git worktree list
   ```

   **Check:** `git worktree list` shows no bisect worktree, and the user has the report.

## Patterns

### Repro script, bash

```bash
#!/usr/bin/env bash
# Exit 0 = good, 1 = bad, 125 = cannot test this commit.
set -u
# Reinstall when node_modules is missing or the lockfile differs from the previous checkout.
if [ ! -d node_modules ] || ! git diff --quiet 'HEAD@{1}' HEAD -- package-lock.json 2>/dev/null; then
  npm ci --silent || exit 125
fi
npm run build --silent >/dev/null 2>&1 || exit 125
# A hang (timeout exits 124) counts as bad here; decide this explicitly for your case.
timeout 120 npx vitest run src/pricing/discount.test.ts >/dev/null 2>&1 && exit 0 || exit 1
```

`timeout` is GNU coreutils; on macOS install coreutils and use `gtimeout`.

### Repro script, PowerShell

```powershell
# Exit 0 = good, 1 = bad, 125 = cannot test this commit.
if (-not (Test-Path node_modules) -or (git diff --name-only 'HEAD@{1}' HEAD -- package-lock.json 2>$null)) {
  npm ci --silent *> $null; if ($LASTEXITCODE -ne 0) { exit 125 }
}
npm run build --silent *> $null; if ($LASTEXITCODE -ne 0) { exit 125 }
$npx = (Get-Command npx).Source
$p = Start-Process $npx -ArgumentList 'vitest', 'run', 'src/pricing/discount.test.ts' -NoNewWindow -PassThru
$null = $p.Handle   # cache the handle so ExitCode is available after the wait
if (-not $p.WaitForExit(120000)) { $p.Kill(); exit 1 }
if ($p.ExitCode -eq 0) { exit 0 } else { exit 1 }
```

### Performance threshold

For a latency or memory regression, take the median of five runs and compare with a fixed threshold. With good at 180 ms and bad at 320 ms, use 250 ms: exit 1 above it and 0 below it. Pin CPU frequency, background load and input data, or the noise will move the result.

### Report

```markdown
## Regression: discount rounding wrong for EUR
- Range: v2.3.0 (good) .. v2.4.1 (bad), 214 commits, 8 bisect steps, 1 skipped.
- First bad commit: <sha> "refactor: share money helpers" (<author>, <date>, PR <link>).
- Evidence: repro exits 1 at <sha>, 0 at <sha>^; HEAD plus revert exits 0.
- Responsible hunk: src/money/round.ts lines 40-52 switched to banker's rounding.
- Repro: <path to script>, deterministic over 10 runs each way.
- Suggested next step: regression test from the repro, then fix with /tdd.
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Bisect with a flaky repro | Reach 10 of 10 on both ends first | One wrong answer sends the search down the wrong half |
| Keep the repro inside the repository | Keep it outside the working tree | Checkouts change or delete it mid-search |
| Map build failures to "bad" | Exit 125 for untestable commits | Unrelated build breaks get blamed |
| Bisect in the user's working tree | Use a detached worktree | Avoids stashing and accidental loss of work |
| Trust the first bad commit without a revert | Revert it on HEAD and rerun | Interacting changes can make bisect point at a bystander |
| Bisect when the environment drifted | Pin dependencies and tools first | History cannot explain a change that is not in it |

## Verification checklist

- [ ] Good and bad refs were pinned, and the range size recorded.
- [ ] The repro lives outside the repository, uses 0, 1 and 125 correctly, and has timeouts.
- [ ] The repro gave 10 of 10 on both the good and the bad ref.
- [ ] Bisect ran in a separate worktree, and the user's tree was untouched.
- [ ] The culprit fails, its parent passes, and HEAD with the revert passes.
- [ ] The report names the commit, the hunk and the evidence; the worktree and bisect state were cleaned up.

## Related

- Workflows: `/root-cause`, `/tdd`, `/verify`, `/ci-failure-triage`, `/perf-audit`.
- Knowledge: `git-workflow`, `concurrency-bugs`, `dependency-upgrades`, `profiling`.
- Agents: `codebase-explorer`, `test-engineer`.
