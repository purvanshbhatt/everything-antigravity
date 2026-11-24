---
name: test-suite-audit
disable-model-invocation: true
description: >-
  Audits an existing test suite for tests that cost more than they protect:
  assertions on mocks instead of behaviour, assertion-free tests, duplicates,
  tests that read source text, test-only production exports, oversized
  snapshots and quietly skipped or loosened tests. Reports findings with
  evidence first and changes tests only in batches the user approves. Invoke
  with /test-suite-audit.
---

# Test Suite Audit

A large suite can be slow, flaky and still miss real bugs, because some of its tests check the wiring instead of the behaviour. This workflow finds those tests, proves each finding (ideally by breaking the code and watching the test stay green), and fixes them in reviewed batches. It never deletes a test that is the only guard of a behaviour.

**Default mode is read-only.** The audit produces a report. Test files change only after the user approves a specific batch.

## When to use

- The suite is slow or flaky and people have stopped trusting a red build.
- Bugs keep shipping even though coverage looks high.
- The user asks "which tests are useless", "clean up our tests" or "why do these tests always pass".
- Before a large refactor, to find tests that pin implementation details and will break for no reason.
- After inheriting a codebase, to learn what the tests really protect.

## When not to use

- Finding code with no tests at all: `/test-coverage`.
- Writing tests for new behaviour: `/tdd`.
- One flaky test with a known name: `/root-cause` (and `concurrency-bugs` for timing).
- Removing dead production code: `/refactor-clean`.
- Reviewing the tests in a single pull request: `/code-review`.

## Workflow

1. **Record a baseline.** Find the test frameworks from the manifests, then run the full suite once and save the totals: passed, failed, skipped, duration, and the slowest tests.

   ```bash
   npx vitest run --reporter=json --outputFile=audit/baseline.json   # or: npx jest --json --outputFile=audit/baseline.json
   pytest -q -rs --durations=25 | tee audit/baseline.txt
   go test ./... -json > audit/baseline.jsonl
   cargo test 2>&1 | tee audit/baseline.txt
   ```

   On PowerShell, replace `tee` with `Tee-Object -FilePath`.

   **Check:** The baseline file exists and you can state the total, skipped count and wall time.

2. **List every skip and weakening.** Search with `grep_search` for `.skip(`, `.only(`, `xit(`, `xdescribe(`, `it.todo(`, `@pytest.mark.skip`, `@pytest.mark.xfail`, `t.Skip(`, `#[ignore]`, raised timeouts, added retries and `--passWithNoTests`. For each hit, find when and why it was added:

   ```bash
   git log -S "it.skip(" --oneline -- "src/**/*.test.ts"
   git log -L '/test_refund_partial/,+15:tests/test_refunds.py' --oneline
   ```

   **Check:** Every skip has an age, an introducing commit, and a reason (or "none given").

3. **Sweep for smells.** Search for each smell in the table under Patterns. For suites with more than a few hundred files, fan out: delegate one directory per `test-engineer` subagent with the smell table, the evidence card format and the instruction "read-only, report candidates only".

   **Check:** You have a candidate list with file and line for each smell, or an explicit "none found".

4. **Confirm each candidate by reading it.** Open the test and the code it claims to cover with `view_file`. Discard false positives: a mock assertion is correct when the interaction is the behaviour (an email is sent once, a retry happens three times). For the strongest evidence, run a mutation by hand: break the covered line on a scratch branch (return a constant, flip a condition), run only that test, then revert.

   **Check:** Every surviving finding has an evidence card with a confidence level, and every hand mutation was reverted (`git status` is clean).

5. **Find the sole guards.** Before recommending deletion, check whether any other test fails when the behaviour breaks: apply the same mutation and run the whole suite, or compare per-test coverage (`pytest --cov --cov-context=test`, then look at which contexts touch the lines). A test that is the only thing failing for that mutation is a sole guard.

   **Check:** Each "delete" recommendation names the other test that still catches the mutation; sole guards are marked "rewrite", never "delete".

6. **Write the report.** Save it as an artifact: counts by smell and action, then evidence cards ranked by cost (runtime, flake rate, maintenance churn) times false confidence. Actions are delete, rewrite, merge, un-skip, narrow the snapshot, or move the export. Propose batches of one smell type each.

   **Check:** The user has the report and nothing in the test tree has changed yet.

7. **Apply approved batches.** One batch per commit (`test: rewrite mock-only assertions in billing`). After each batch, run the full suite and compare with the baseline: no new failures, no drop in mutation catches for the touched behaviour, and runtime equal or lower.

   **Check:** Each batch commit passes the suite, and its message lists the findings it closes.

8. **Prevent recurrence.** Propose lint rules and CI checks that catch the same smells next time, for example `jest/expect-expect`, `jest/no-disabled-tests`, `jest/no-focused-tests` and `jest/no-large-snapshots` in eslint-plugin-jest (the Vitest plugin has equivalents), and `--strict-markers` plus `xfail_strict = true` for pytest. Check each plugin's current rule list before you add it.

   **Check:** The rules are added, or the user declined them, and CI fails on a focused or skipped test without a reason.

## Patterns

### Smells

| Smell | How to find it | Why it hurts | Usual action |
| :--- | :--- | :--- | :--- |
| Mock-only assertions | The only expectations are `toHaveBeenCalledWith` or `assert_called_once_with`; the result is ignored | Passes when the output is wrong | Assert the returned value or the observable state |
| Tautology | The test asserts the value its own mock returns | Tests the mock, not the code | Delete or rewrite against the real collaborator |
| No assertion | A body with no `expect`, `assert` or `t.Error` | Only proves nothing threw | Add the missing assertion or delete |
| Duplicates | Same inputs and expectations in two places; identical titles | Double maintenance, double runtime | Merge into one parametrized or table-driven test |
| Source-text tests | Tests that read `.ts`, `.py` or `.go` files and match strings | Break on renames, prove no behaviour | Replace with a behaviour test or delete |
| Test-only exports | `_internal`, `__testing__`, `@VisibleForTesting`, exports used only under `test/` | Widens the public API to suit tests | Test through the public interface; unexport |
| Oversized snapshots | Snapshot files of hundreds of lines; updated with `-u` in most commits that touch them | Reviewers rubber-stamp them | Snapshot the relevant fields or assert explicitly |
| Quiet weakening | Skips, non-strict xfail, raised timeouts, added retries, `toEqual` loosened to `toBeTruthy` | The check no longer checks | Restore it, or delete it openly with a reason |
| Sleep-based timing | `sleep(`, `time.sleep`, `setTimeout` waits in tests | Slow and flaky | Fake timers or wait on a condition |
| Over-mocking | More mocks than real objects, or the unit under test is mocked | The test exercises mocks | Use fakes at the boundary; keep the core real |

Snapshot churn, to spot rubber-stamped files:

```bash
git log --since="6 months ago" --name-only --pretty=format: -- "*.snap" | sort | uniq -c | sort -rn | head -20
```

```powershell
git log --since="6 months ago" --name-only --pretty=format: -- "*.snap" | Where-Object { $_ } | Group-Object | Sort-Object Count -Descending | Select-Object -First 20 Count, Name
```

### Evidence card

```markdown
### F-07 Mock-only assertion: src/billing/invoice.test.ts:42
- Smell: asserts `taxService.lookup` was called; never checks the invoice total.
- Evidence: made `calculateTotal` return 0 on a scratch branch; this test stayed green (reverted).
- Sole guard: no; invoice.integration.test.ts:18 fails on the same mutation.
- Cost: 0.4 s; failed 3 of 50 runs (shared clock).
- Action: rewrite to assert the returned total. Confidence: high.
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Delete tests in bulk because they "look useless" | Prove each finding, then change approved batches | A test that looks redundant may be the only guard |
| Count assertions and call it quality | Break the code and see if the test notices | Many assertions can still check the wrong thing |
| Un-skip everything at once | Un-skip one at a time and fix or delete with a reason | A wall of red hides the real failures |
| Replace mocks with live network calls | Fakes at the boundary, real logic in the middle | Trades a weak test for a flaky one |
| Raise timeouts to calm a flake | Find the shared state or timing bug | The bug is still there |
| Leave a hand mutation in place | Revert and confirm `git status` is clean | A mutated line can ship |

## Verification checklist

- [ ] A baseline (counts, skips, duration) was recorded before any change.
- [ ] Every finding has an evidence card; high-confidence ones were shown with a mutation.
- [ ] No sole guard was deleted; each deletion names the test that still covers the behaviour.
- [ ] The report was approved before tests changed, and changes landed in one-smell batches.
- [ ] After each batch the suite passed and runtime did not grow.
- [ ] All hand mutations were reverted.
- [ ] Prevention rules were added or explicitly declined.

## Related

- Workflows: `/test-coverage`, `/tdd`, `/root-cause`, `/code-review`, `/refactor-clean`, `/verify`.
- Knowledge: `tdd-testing`, `python-testing`, `react-testing`, `golang-testing`, `rust-testing`, `test-data-management`, `visual-regression`, `concurrency-bugs`.
- Agents: `test-engineer` (per-directory smell sweeps), `code-reviewer`.
