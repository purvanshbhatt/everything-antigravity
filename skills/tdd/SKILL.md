---
name: tdd
description: >-
  Drives red-green-refactor: writes a failing test from the requirement, proves
  it fails for the right reason, adds the minimal code to pass, refactors under
  green, then checks the new branches are covered. Covers vitest, jest, pytest,
  go test, cargo test and dart/flutter test. Use when implementing behaviour
  test-first, fixing a bug with a regression test, or when the user says TDD.
  Invoke with /tdd.
---

# Test-Driven Development

One behaviour at a time: a test that fails for the right reason, the least code that makes it pass, then a cleanup under green. The test is the specification; the code is allowed to stay naive until another test forces it to generalize.

## When to use

- Implementing any new behaviour, including gates 2 and 3 of `/feature-dev`.
- Fixing a bug: the regression test comes first and must fail on the current code.
- The user says "TDD", "test first", "red-green" or "add tests as you go".
- Changing code whose behaviour must be pinned before editing (characterization tests).

## When not to use

- Measuring and filling gaps in existing code: `/test-coverage`.
- Browser user journeys: `/e2e`.
- An unexplained failure: `/root-cause`, which ends in this loop.
- Spikes the user marked as throwaway. Delete the spike, then TDD the real thing.

## Workflow

1. **Pick one behaviour and name it.** Write the test name as a sentence about observable behaviour: `rejects a coupon whose expiry is in the past`. Choose the lowest level that proves it: unit for pure logic, integration for a boundary (database, HTTP, file system), `/e2e` only for journeys.

   **Check:** The name says what, not how, and you could explain a failure without reading the code.

2. **Mirror the project's test conventions.** Find existing tests with `find_by_name` (`*.test.ts`, `*.spec.ts`, `test_*.py`, `*_test.go`, `tests/*.rs`, `*_test.dart`), the runner config (`vitest.config.*`, `jest.config.*`, `[tool.pytest.ini_options]`), and the fixtures and factories. Reuse them; don't invent a new style.

   **Check:** Your test file sits where similar tests sit and uses the same helpers.

3. **Red: write the test and watch it fail.** Run only that test (commands below) and read the failure.

   | Failure you see | Right reason? |
   | :--- | :--- |
   | Assertion: expected X, received Y | Yes |
   | Symbol not found or not exported, for a symbol this test introduces | Yes, for the first test of a new API |
   | Syntax error, wrong import path, missing fixture, wrong runner | No: fix the test |
   | The test passes | No: the behaviour exists already or the test asserts nothing new; tighten it |

   **Check:** You have the failing output, and it matches a "Yes" row.

4. **Green: write the minimal code.** Make the simplest change that passes, even a hard-coded value; the next test will force generalization. Run the test, then its whole file or package.

   **Check:** The new test passes and no other test in the file or package changed state.

5. **Refactor under green.** Remove duplication, rename, extract functions. Run the tests after every move. In one move, refactor either the code or the tests, never both, and add no behaviour.

   **Check:** The suite is still green and the diff of this step adds no behaviour.

6. **Repeat for the edges.** Add tests for boundaries (0, 1, max, empty, the exact expiry instant), invalid input, error paths, and concurrency or time where relevant. Use fake clocks and fixed seeds, never the real time.

   **Check:** Every acceptance criterion and every error case in the contract has a test.

7. **Check coverage of what you changed.** Run coverage for the touched files and look for branches you added that no test executes. A percentage target is not the goal; an untested new branch is the failure. Use `/test-coverage` for wider gaps.

   **Check:** No new branch is uncovered, or the summary explains why.

8. **Commit test and code together.** One behaviour per commit, with the message written in behavioural terms.

   **Check:** `git show --stat HEAD` lists both the test and the implementation.

**Bug-fix variant.** Steps 3 and 4 become "reproduce the bug as a failing test, then fix it". If you cannot make the test fail, you have not found the bug yet.

## Commands

| Ecosystem | One test | One file | Watch | Coverage |
| :--- | :--- | :--- | :--- | :--- |
| Vitest | `npx vitest run -t "rejects expired"` | `npx vitest run src/coupon.test.ts` | `npx vitest` | `npx vitest run --coverage` |
| Jest | `npx jest -t "rejects expired"` | `npx jest src/coupon.test.ts` | `npx jest --watch` | `npx jest --coverage` |
| pytest | `pytest tests/test_coupon.py::test_rejects_expired` | `pytest tests/test_coupon.py` | n/a | `pytest --cov=<pkg> --cov-report=term-missing` |
| Go | `go test -run 'TestApplyCoupon/expired' ./checkout/` | `go test ./checkout/` | n/a | `go test -cover ./checkout/` |
| Rust | `cargo test rejects_expired` | `cargo test --test coupon` | n/a | `cargo llvm-cov` |
| Dart | `dart test -n "rejects expired"` | `dart test test/coupon_test.dart` | n/a | `dart test --coverage=coverage` |
| Flutter | `flutter test --plain-name "rejects expired"` | `flutter test test/coupon_test.dart` | n/a | `flutter test --coverage` |

- Through package scripts: `npm test -- -t "rejects expired"` (identical in PowerShell). Use `pnpm`, `yarn` or `bun` to match the lockfile.
- In Python projects managed by uv or Poetry, prefix commands with `uv run` or `poetry run`.
- `pytest -x` stops at the first failure; `pytest --lf` reruns only the last failures.
- Go caches passing results; add `-count=1` to force a rerun, and `-race` for concurrent code.
- PowerShell: keep regex arguments in single quotes (`-run 'TestX$'`) so `$` is not expanded.

## Test integrity rules

These hold even under deadline pressure. A failing test is a signal about the code until proven otherwise.

- Never change an expected value to match the actual output unless the requirement changed and the user confirmed it.
- Never skip, delete or quarantine a failing test to get green (`.skip`, `xit`, `@pytest.mark.skip`, `t.Skip()`, `#[ignore]`). If quarantine is truly unavoidable, add the reason and an issue link, and tell the user.
- Never loosen an assertion: `toEqual` to `toBeDefined`, exact match to "contains", wider tolerances, catch-all exception types.
- Never mock the unit under test, and don't mock what is cheap to run for real (pure functions, in-memory stores).
- Update snapshots (`-u`) only after reading every changed line of the snapshot diff.
- When your change breaks an existing test, decide which side is right. If the old behaviour is still required, your code is wrong. If the requirement changed, update the test and say so in the commit message and your summary.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Write several tests, then all the code | One failing test at a time | Large red batches hide which code satisfies which behaviour |
| Accept a test that fails on an import error | Make it fail on the assertion | A broken test proves nothing about behaviour |
| Generalize before a second test demands it | Triangulate with another case | Speculative code is untested code |
| Use `sleep` or the real clock | Inject a clock, use fake timers and fixed seeds | Flaky tests destroy trust in red |
| Assert on private internals | Assert outputs and observable effects | Internal assertions break on every refactor |
| Refactor while red | Get green first | You can't tell a refactor bug from the original failure |

## Verification checklist

- [ ] Every new behaviour had a test that was seen failing for the right reason.
- [ ] Implementation is minimal, and refactors happened only under green.
- [ ] Edge and error paths have tests; time and randomness are controlled.
- [ ] No test was skipped, deleted or loosened, and snapshot updates were reviewed.
- [ ] New branches are covered, and the full suite for the package is green.

## Related

- Workflows: `/feature-dev`, `/test-coverage`, `/e2e`, `/root-cause`, `/verify`, `/refactor-clean`.
- Agents: `test-engineer` (bulk test authoring), `code-reviewer`.
- Knowledge: `tdd-testing`, `safe-refactor`, and the stack skills `python-fastapi`, `golang-services`, `rust-systems`, `flutter-mobile`, `frontend-react-nextjs`.
