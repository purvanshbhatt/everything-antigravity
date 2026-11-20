---
name: root-cause
description: >-
  Debugs systematically instead of guessing: reproduces the failure, minimizes
  it, ranks falsifiable hypotheses, bisects regressions with git bisect run,
  instruments to confirm, fixes with a regression test and explains the cause
  with five whys, keeping a debugging log. Use when something is broken, flaky,
  regressed or behaving unexpectedly and the cause is not obvious. Invoke with
  /root-cause.
---

# Root Cause

Find the defect that explains every symptom, prove it, and fix it once. Guess-and-patch loops add new bugs and leave the original in place. The output is a fix, a regression test and an explanation another engineer would accept.

## When to use

- The user says "why is this failing", "it worked yesterday", "flaky", "only in CI", "only in prod" or "debug this".
- A test fails and the reason is not clear after one read of the error and the code.
- A runtime or test failure from `/verify` or CI that `/build-fix` does not cover.
- After an incident, to produce the explanation and the prevention.

## When not to use

- Compile, type or lint errors: `/build-fix`.
- The cause is known and the fix is clear: write the regression test and fix with `/tdd`.
- Looking for possible bugs in a change: `/code-review`.
- Broad performance tuning: delegate to the `performance-optimizer` subagent.

## Workflow

1. **State the failure precisely and open the log.** Record expected versus actual, the error verbatim, when it was first seen, how often it happens, and the environment (OS, runtime versions, commit, config, data). Start the debugging log from the template below and update it at every step.

   **Check:** Someone else could read the log and know exactly what "fixed" means.

2. **Reproduce on demand.** Find the smallest command that shows the failure, ideally as a failing test. Remove nondeterminism: fixed seeds, fake clocks, a pinned timezone where the runtime honours `TZ` (bash `TZ=UTC <cmd>`, PowerShell `$env:TZ = "UTC"; <cmd>`), local stubs for the network. For flakes, measure the rate:

   ```bash
   for i in $(seq 1 50); do <cmd> >/dev/null 2>&1 || echo "fail on run $i"; done
   ```

   ```powershell
   foreach ($i in 1..50) { <cmd> *> $null; if ($LASTEXITCODE -ne 0) { "fail on run $i" } }
   ```

   **Check:** The repro fails every time, or at a measured rate you can compare against after the fix.

3. **Minimize.** Remove inputs, config, data and code paths, halving each time, until removing anything more makes the failure disappear. The minimal repro usually points at the cause.

   **Check:** The repro can be described in two sentences.

4. **Write falsifiable hypotheses.** List two to five candidate causes, each with evidence for, evidence against, and the cheapest experiment that would rule it out. Run experiments in order of likelihood times cheapness, change one variable per experiment, and log each result. Don't edit production code yet.

   **Check:** Every rejected hypothesis has the experiment that killed it in the log.

5. **Bisect if it is a regression.** Find a known-good commit or tag and let git locate the first bad commit. Commit your own work first, and ask before stashing anything of the user's. Keep the repro script outside the repository so it doesn't change as commits are checked out; make it exit 0 when good, 1 when bad and 125 when the commit can't be tested, and have it reinstall dependencies if the lockfile differs between commits.

   ```bash
   chmod +x "${TMPDIR:-/tmp}/repro.sh"
   git bisect start
   git bisect bad HEAD
   git bisect good v1.4.0
   git bisect run "${TMPDIR:-/tmp}/repro.sh"
   git bisect log
   git bisect reset
   ```

   ```powershell
   git bisect run pwsh -NoProfile -File "$env:TEMP\repro.ps1"
   ```

   **Check:** Bisect named the first bad commit, you have read its diff, and `git bisect reset` returned you to your branch.

6. **Instrument to confirm.** Add targeted logging, assertions or a breakpoint at the boundary where state goes from right to wrong, then binary-search along the call path. Tag every temporary line with `DEBUG-RC` so it can be found later. Debuggers: `node --inspect-brk`, `python -m pdb` or `breakpoint()`, `dlv test`, and `RUST_BACKTRACE=1` (PowerShell `$env:RUST_BACKTRACE = "1"`).

   **Check:** You can point at the exact line where the invariant first breaks and say why.

7. **Fix the cause, test first.** Write the regression test, watch it fail on the current code, then fix at the root rather than the symptom (not a null check where null should never arrive). Search for the same pattern elsewhere with `grep_search` and fix or report the siblings.

   **Check:** The regression test fails without the fix and passes with it; sibling occurrences are fixed or listed.

8. **Clean up and verify.** `git grep -n "DEBUG-RC"` must return nothing. Run `/verify quick`, or `full` for risky fixes. For flakes, re-run the loop from step 2.

   **Check:** Instrumentation is gone, the gates pass, and the flake rate is zero over at least as many runs as before.

9. **Explain.** Complete the root-cause section of the log: five whys, the fix, why existing tests missed it, and the prevention (a test, type, lint rule or alert). Record reusable lessons with `/instinct-capture`.

   **Check:** The stated cause accounts for every symptom recorded in step 1.

## Debugging log template

```markdown
# Debug log: <short failure title>
- Expected / actual: ...
- Error (verbatim): ...
- Environment: OS, runtime versions, commit, config, data set
- First seen / frequency: ...
- Repro: `<command>`   Failure rate before fix: N/50

## Hypotheses
| # | Hypothesis | For | Against | Experiment | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| H1 | ... | ... | ... | ... | rejected / confirmed |

## Timeline
- hh:mm  did X, observed Y

## Root cause
- Why 1: <symptom> because ...
- Why 2-5: ... because ... (stop at a cause you can fix or prevent)
- Root cause (one sentence): ...
- First bad commit: <sha> (if bisected)
- Fix: <commit> · Regression test: <file::test>
- Why tests missed it: ...
- Prevention: ...
```

## Symptom playbook

| Symptom | First move |
| :--- | :--- |
| Worked before, broken now | `git bisect run` with the repro script |
| Flaky test | Measure the rate; run it alone and in the suite; look for shared state, ordering, time, randomness, network |
| Only in CI | Diff the environment: runtime versions, env vars, timezone and locale, case-sensitive paths, parallelism, missing secrets |
| Only in production | Correlate logs and traces by request ID (`observability-otel`); reproduce locally with sanitized data |
| Wrong number | Log the value after each transformation; check units, rounding, float money and overflow |
| Hang or timeout | Dump stacks (Go: send `SIGQUIT`; Python: `py-spy dump --pid <pid>`); look for missing I/O timeouts and lock ordering |
| Error vanishes somewhere | Delegate to the `silent-failure-hunter` subagent with the call path |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Change several things at once | One variable per experiment | You won't know which change mattered |
| Patch the symptom with a null check or retry | Fix where the invariant breaks | The bug resurfaces somewhere else |
| Add sleeps or retries to hide a flake | Find the race or the shared state | Users hit the same race |
| Debug from memory of the code | Read the code on the failing path | Assumptions are what produced the bug |
| Skip the regression test because the fix is "obvious" | Test fails before, passes after | Without it, the bug comes back |
| Leave debug logging behind | Tag it `DEBUG-RC` and grep it out | Noise, and possible data leaks in logs |

## Verification checklist

- [ ] The failure was reproduced on demand (or at a measured rate) and minimized.
- [ ] Hypotheses and experiments are logged, and the confirmed cause explains every symptom.
- [ ] The regression test was seen failing before the fix and passing after it.
- [ ] Sibling occurrences were checked, and all instrumentation was removed.
- [ ] `/verify` passes, and the flake rate was re-measured where relevant.
- [ ] A five-whys explanation and a prevention step were delivered.

## Related

- Workflows: `/tdd`, `/verify`, `/build-fix`, `/code-review`, `/e2e`, `/instinct-capture`.
- Agents: `silent-failure-hunter`, `performance-optimizer`, `codebase-explorer`, `test-engineer`.
- Knowledge: `observability-otel`, `tdd-testing`, `git-workflow`.
