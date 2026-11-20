---
trigger: glob
globs: "**/*.test.*, **/*.spec.*, **/test_*.py, **/*_test.py, **/*_test.go, **/tests/**, **/__tests__/**"
description: Test-writing conventions for all languages
---

# Tests

## Never weaken tests

- A failing test is a defect report until proven otherwise. Fix the code, not the test.
- Do not delete or loosen assertions, add `skip`/`xfail`/`.only`/`t.Skip`, widen tolerances, raise timeouts, catch the failure, or regenerate snapshots to make a run green.
- If a test really is wrong (outdated requirement, bad fixture), say so explicitly, explain why, and change it in a separate, clearly described step.
- Changing a snapshot or golden file requires stating which behaviour changed and why it is intended.

## Write tests first

- For a bug fix, first write a test that reproduces the bug and confirm it fails for the expected reason (right assertion, not an import error). Then fix.
- For new behaviour, write the test for the public contract before the implementation.

## Structure

- Arrange, Act, Assert: set up, perform one action, assert outcomes. Separate the three visibly.
- One behaviour per test. Name tests after the behaviour and condition (`rejects_expired_token`, `returns 404 when user is missing`).
- Assert specific values and error types/messages (`toEqual(expected)`, `pytest.raises(ValueError, match=...)`), not just truthiness or "no exception".
- Test through public interfaces and observable behaviour, not private methods or internal call order.
- Use builders or factories for test data; keep each test readable on its own.

## Deterministic

- No real wall-clock time: inject a clock or use fake timers (`vi.useFakeTimers`, `jest.useFakeTimers`, `freezegun`/`time-machine`, an injected `Clock`).
- Seed every random generator and log the seed for property-based tests.
- No dependence on test order, shared mutable globals, the current timezone, locale or machine. Set them explicitly.
- No real network or third-party services in unit tests. Fake at the boundary you own; use local containers (Testcontainers) or emulators for integration tests.
- Each test creates and cleans up its own files and data (`tmp_path`, `t.TempDir()`, `afterEach`), and can run in parallel with others.

## No sleeps

- Never use fixed sleeps (`sleep`, `setTimeout`, `time.sleep`, `Thread.sleep`, `waitForTimeout`) to wait for something.
- Wait for a condition with a timeout: auto-waiting assertions (`await expect(locator).toBeVisible()`), polling helpers (`eventually`, `waitFor`), or synchronization primitives.
- Advance fake timers instead of waiting for real ones.

## Doubles

- Prefer real objects, then fakes, then mocks. Mock only what you own and only at process boundaries (HTTP, DB, clock, filesystem).
- Do not assert on mock call counts unless the call itself is the behaviour (sending an email, charging a card).
- Never use production data, real customer PII or real secrets in fixtures.

## Flaky tests

- A flaky test is a bug. Find the nondeterminism (time, order, concurrency, network) and fix it.
- If it must be quarantined, mark it with a linked issue and owner; never wrap it in automatic retries to hide it.

## Running

- Run the narrowest test first, then the affected suite, then the full suite before declaring done:
  `pytest path::test_x -x`, `npx vitest run file`, `go test ./pkg -run '^TestX$'`, `cargo test name`, `dotnet test --filter Name`.
- Report the actual pass/fail counts from the run, not an expectation.
