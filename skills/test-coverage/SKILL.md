---
name: test-coverage
description: >-
  Measures test coverage, then finds the untested code that matters most
  (critical paths, error handling, recent churn) instead of chasing a
  percentage, and writes the missing tests in risk order. Covers vitest and c8,
  jest, pytest-cov, go test -cover and cargo llvm-cov. Use when the user asks
  about coverage or test gaps, or wants a module hardened before a release or
  refactor. Invoke with /test-coverage.
---

# Test Coverage

Coverage tells you what never ran, not what is correct. Use it to find untested code on paths where a bug would hurt, then write tests that can actually fail there. A suite at 90% that never touches the refund path is worse than one at 70% that does.

## When to use

- The user asks "what's our coverage", "where are the test gaps", "add tests to X" or "harden this before release".
- Before refactoring a module, to pin its behaviour first.
- After an incident, to find sibling gaps around the failed code.

## When not to use

- Writing new behaviour: `/tdd`, and coverage follows from it.
- Browser journeys: `/e2e`.
- Tests are currently failing: `/root-cause` first.
- Code that coverage reveals as unreachable: remove it with `/refactor-clean` rather than testing it.

## Workflow

1. **Measure with branch coverage and a readable report.** Use the project's configured coverage command if one exists, otherwise the table below. Record line and branch percentages per file.

   **Check:** You have per-file numbers and an HTML or lcov report you can open at specific lines.

2. **Rank code by risk, independently of coverage.** Score modules on money and billing, auth and permissions, data writes and migrations, parsing of external input, concurrency, retry and error handling, and recent churn and bug history.

   ```bash
   git log --since="90 days ago" --name-only --format= | sort | uniq -c | sort -rn | head -20
   git log --since="1 year ago" -i --grep="fix" --name-only --format= | sort | uniq -c | sort -rn | head -20
   ```

   ```powershell
   git log --since="90 days ago" --name-only --format= | Where-Object { $_ } | Group-Object | Sort-Object Count -Descending | Select-Object -First 20 Count, Name
   ```

   **Check:** You have a ranked list of the 10-20 riskiest files, each with a reason.

3. **Cross risk with the uncovered lines.** For each risky file, open the report at the uncovered lines and branches; ignore the file's percentage. Classify each gap:

   | Gap | Priority and action |
   | :--- | :--- |
   | Uncovered branch on a critical path | P1: test now |
   | Uncovered validation of external input | P1: test now |
   | Uncovered error, timeout or retry path | P1 if it touches data or money, otherwise P2 |
   | Uncovered glue code or logging | P3: usually skip |
   | Generated code or type-only files | Exclude in coverage config, with user approval |
   | Unreachable code | Hand to `/refactor-clean` |

   **Check:** Every P1 gap names a file, a line range and the scenario that would execute it.

4. **Write the tests in priority order.** Follow `/tdd` discipline. For existing code, write characterization tests that assert current behaviour. If the current behaviour looks wrong, don't encode the bug: write the test for the correct behaviour, mark it as an expected failure with a reason (`test.fails` in Vitest, `test.failing` in Jest, `@pytest.mark.xfail(reason=...)`), and tell the user.

   **Check:** Re-running coverage shows each new test executing its target gap, and each test asserts an outcome rather than "does not throw".

5. **Prove the new tests can fail.** For each P1 test, temporarily break the code it covers (invert a condition, drop a call), confirm the test goes red, then restore the code. Mutation tools automate this where installed: `npx stryker run` (JS/TS), `mutmut run` (Python), `cargo mutants` (Rust).

   **Check:** Every P1 test was seen failing against a deliberate break, and `git diff` afterwards shows only test files.

6. **Re-measure and report the delta.** Report before and after for each risky file, the P1 gaps closed, and the gaps deferred with a reason. Propose a threshold or a "no decrease" check for CI, but change CI configuration only with user approval.

   **Check:** The report leads with risk closed, not with the global percentage.

Delegate bulk test writing for many independent P2 gaps to the `test-engineer` subagent with the gap list (file, lines, scenario) and the project's test conventions; review its tests against step 5 before accepting them.

## Commands

| Ecosystem | Command | Report |
| :--- | :--- | :--- |
| Vitest | `npx vitest run --coverage` (needs `@vitest/coverage-v8` or `@vitest/coverage-istanbul`) | `coverage/` |
| Node test runner via c8 | `npx c8 --reporter=text --reporter=lcov node --test` | `coverage/lcov.info` |
| Jest | `npx jest --coverage` | `coverage/lcov-report/index.html` |
| pytest | `pytest --cov=<pkg> --cov-branch --cov-report=term-missing --cov-report=html` | `htmlcov/index.html` |
| Go | `go test -coverprofile=cover.out ./...`, then `go tool cover -func=cover.out` or `go tool cover -html=cover.out` | `cover.out` |
| Rust | `cargo llvm-cov --html` (install: `cargo install cargo-llvm-cov`) | `target/llvm-cov/html/index.html` |
| Flutter | `flutter test --coverage` | `coverage/lcov.info` |

- PowerShell: quote Go flags that contain a dot, `go test "-coverprofile=cover.out" ./...`, so the argument is not split.
- Go reports statement coverage, not branch coverage; check `if` and `switch` arms by hand in the HTML view. Use `-covermode=atomic` together with `-race`.
- Keep coverage output out of commits: confirm `coverage/`, `htmlcov/` and `cover.out` are gitignored.

## What a gap-closing test asserts

| Target | The test should assert |
| :--- | :--- |
| Error path | The error type or code, that no partial write happened, and that it was logged or reported |
| Boundary | The exact boundary value and both sides of it |
| Retry | Attempt count, backoff bound, and idempotency of the retried operation |
| Authorization | Denied for the wrong role or tenant, allowed for the right one |
| Input validation | Rejection of each malformed shape, with the error the caller sees |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Chase a global percentage | Close risk-ranked gaps | Percentages reward testing trivial code |
| Write tests that execute code but assert nothing | Assert outcomes and side effects | Coverage without assertions proves only that code ran |
| Snapshot everything to raise the number | Targeted assertions | Large snapshots get rubber-stamped |
| Exclude hard files from coverage to hit a target | Test them, or report them as gaps | Exclusions hide exactly the risky code |
| Encode current buggy behaviour silently | Expected-failure test with a reason, and tell the user | Otherwise the test locks the bug in |
| Raise the CI threshold unilaterally | Propose it; change it with approval | A surprise threshold breaks everyone's builds |

## Verification checklist

- [ ] Coverage was measured with branches where the tool supports it.
- [ ] Risk ranking came from code categories and git history, not from the percentages.
- [ ] Every P1 gap has a test that executes it and was seen failing against a deliberate break.
- [ ] Suspected bugs were reported, not encoded as expected behaviour.
- [ ] The report shows before and after per risky file, plus deferred gaps with reasons.

## Related

- Workflows: `/tdd`, `/e2e`, `/refactor-clean`, `/verify`, `/root-cause`.
- Agents: `test-engineer`, `code-reviewer`.
- Knowledge: `tdd-testing`, `safe-refactor`, `ci-cd-github-actions`.
