---
name: flaky-test-triage
disable-model-invocation: true
description: >-
  Diagnoses and fixes non-deterministic tests: measures the flake rate with
  repeated runs, classifies the cause (async timing, order pollution, shared
  state, network, clock, randomness, resources), replaces sleeps with
  condition polling, bisects test order to find the polluter, seeds randomness
  and freezes clocks. Use when a test passes and fails without code changes,
  fails only in CI or only in the full suite.
---

# Flaky Test Triage

A flaky test gives different results on the same code. Each one trains the team to ignore red builds, so fix the nondeterminism instead of retrying past it. The output is a measured before-and-after flake rate, a named cause and a fix that removes the cause.

## When to use

- A test "sometimes fails", passes on rerun, or fails only in CI, only in parallel or only in the full suite.
- A pipeline has automatic retries and you want to know what they are hiding.
- Someone proposes raising a timeout, adding a `sleep` or adding retries to make a test pass.
- A test fails on certain dates, times of day, time zones or machines.

## When not to use

- The test fails every time: it is a real failure, so use `/root-cause`.
- The race is in production code, not the test harness: use `concurrency-bugs` (it may start here and move there).
- Fixtures and test data are hard to maintain in general: use `test-data-management`.
- Browser-test stability as a whole (selectors, traces, CI setup): use `/e2e` and `browser-automation`.

## Workflow

1. **Record the failure exactly.** Copy the failing assertion and stack trace verbatim from at least two failed runs, with commit, runner, worker count and seed if the runner printed one. Two different failure messages often mean two different causes.

   **Check:** You have the error text, the environment and the run order (or seed) for at least one failure.

2. **Measure the flake rate.** Run the single test many times in isolation, then the same test inside its file or package. Use the runner's repeat feature where it has one, otherwise a loop.

   | Runner | Repeat one test |
   | :--- | :--- |
   | Go | `go test -run '^TestCheckout$' -count=200 ./cart/` (add `-race`) |
   | Playwright | `npx playwright test checkout.spec.ts --repeat-each=50 --workers=1` |
   | JUnit 5 | Temporarily swap `@Test` for `@RepeatedTest(100)` |
   | pytest, Jest, Vitest, cargo | A shell loop, as below |

   ```bash
   fails=0; for i in $(seq 1 100); do npx vitest run src/cart.test.ts -t "applies coupon" >/dev/null 2>&1 || fails=$((fails+1)); done; echo "$fails/100"
   ```

   ```powershell
   $fails = 0; foreach ($i in 1..100) { npx vitest run src/cart.test.ts -t "applies coupon" *> $null; if ($LASTEXITCODE -ne 0) { $fails++ } }; "$fails/100"
   ```

   Long loops belong in the background: start them with `run_command` and keep working, or hand them to the `test-engineer` subagent with the exact command and the run count.

   **Check:** You have a number such as 4/100 alone and 11/100 in the suite. If the test never fails alone but fails in the suite, go to step 4.

3. **Classify the cause.** Read the test and the code it touches, then match the evidence to one row of the table in Patterns. Name one primary class before you change anything.

   **Check:** You can state the cause as "the test assumes X, but X is only true when Y".

4. **Find a polluter when order matters.** If the test fails only after other tests, list the tests that ran before it, run half of them followed by the victim with shuffling off, and keep the half that still fails. Repeat until one test remains.

   ```bash
   pytest -p no:randomly tests/test_a.py tests/test_b.py tests/test_orders.py::test_total   # pytest keeps argument order
   go test -shuffle=1700000000 ./...                                                        # replay the seed Go printed
   npx vitest run --sequence.shuffle --sequence.seed=1234                                   # replay a Vitest order
   ```

   Jest gives each test file its own module registry, so pollution between files usually travels through something outside the process: a database row, a temp file, an environment variable or a port. Look there first.

   **Check:** One named test, run immediately before the victim, makes it fail; the victim passes without it.

5. **Fix the cause, not the symptom.** Apply the matching fix from Patterns. Typical fixes: wait for a condition instead of sleeping, give each test its own data and resources, restore global state in teardown, inject a fake clock, seed every random source, stub the network at the boundary.

   **Check:** The diff removes the dependency on timing, order or environment. It does not raise a timeout, add a retry or add a sleep.

6. **Prove it with enough runs.** Zero failures in N runs only proves the rate is probably below about 3/N (the "rule of three"). To show a 5% flake is gone, run at least 60 times; for a 1% flake, at least 300. Repeat in the condition that failed: full suite, parallel workers, CI.

   **Check:** The before and after numbers come from the same command, and the after run is long enough for the original rate.

7. **Quarantine only with a ticket.** If the fix must wait, skip or tag the test with a ticket ID and a date, and keep running it in a non-blocking job so the data keeps coming.

   ```python
   @pytest.mark.skip(reason="FLAKY: QA-412, owner: dana, revisit 2026-12-15")
   ```

   **Check:** Every quarantined test has an owner, a ticket and a date, and `grep_search` for the quarantine marker finds nothing older than its date.

8. **Record and prevent.** Write the cause, the evidence and the fix in the PR description. If the cause can recur (real clock, unseeded faker, shared database), add a guard: a lint rule, a fixture that fails when a test leaks state, or a CI job that runs the suite shuffled.

   **Check:** The PR states the class, the measured before and after rates and the prevention step.

## Patterns

### Cause classes

| Class | Typical evidence | Fix |
| :--- | :--- | :--- |
| Async timing | `sleep`, fixed waits, "element not found", assertion runs before an event fires | Poll for the real condition with a deadline and a descriptive failure |
| Order pollution | Fails only after certain tests; passes alone | Reset globals, singletons, module caches and mocks in teardown; isolate the polluter |
| Shared external state | Database rows, files, queues, caches or ports reused across tests or workers | Unique names per test or worker, transactions rolled back, temp dirs per test |
| Network and third parties | Timeouts, rate limits, DNS errors, real HTTP in a unit test | Stub at the HTTP boundary; record and replay; contract tests for the real thing |
| Clock and calendar | Fails near midnight, month end, DST changes or in another time zone | Inject a clock or freeze time; pin `TZ` and locale in the test environment |
| Randomness | Faker data, random IDs, hash or set ordering | Seed every generator and print the seed; sort before comparing |
| Concurrency in the code | Interleavings, lost updates, deadlocks under `-race` or parallel load | Hand over to `concurrency-bugs` |
| Resources | Fails on slow CI machines, under load or late in a long run | Fix leaks (handles, connections, memory); budget time per operation, not per test |

### Wait for the condition, not the clock

```ts
export async function waitFor<T>(probe: () => T | Promise<T>, what: string, timeoutMs = 5000, everyMs = 50): Promise<NonNullable<T>> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const value = await probe();
      if (value) return value as NonNullable<T>;
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, everyMs));
  }
  const detail = lastError ? `; last error: ${String(lastError)}` : '';
  throw new Error(`Timed out after ${timeoutMs} ms waiting for ${what}${detail}`);
}

// Before: await sleep(2000); expect(await queue.size()).toBe(0);
await waitFor(async () => (await queue.size()) === 0, 'the queue to drain');
```

The helper uses real timers, so do not call it while fake timers are installed; advance the fake clock instead.

Prefer the runner's own waiting where it exists: Playwright web-first assertions such as `await expect(locator).toBeVisible()` and `expect.poll`, Testing Library `findBy*` and `waitFor`, and Awaitility in Java.

### Time and randomness

| Stack | Freeze or control time | Seed randomness |
| :--- | :--- | :--- |
| Jest / Vitest | `jest.useFakeTimers()` with `jest.setSystemTime(...)`; `vi.useFakeTimers()` with `vi.setSystemTime(...)` | `faker.seed(42)`; replace `Math.random` with a seeded generator |
| Python | `freezegun` or `time-machine` | `random.seed(42)`, `Faker.seed(42)`; pytest-randomly prints its seed, replay with `--randomly-seed=N` |
| Go | Pass a clock interface; never call `time.Now()` deep in logic | `rand.New(rand.NewSource(seed))` held by the test |
| Java | Inject `java.time.Clock`; use `Clock.fixed(...)` in tests | `new Random(seed)` |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Raise the timeout until it passes | Wait for the condition, budget per operation | Slower suite, same race |
| Add `sleep(2)` | Poll with a deadline and a message | Too short on slow CI, wasted time everywhere else |
| Turn on blanket retries | Retry only while measuring, and log every retry | Retries hide real races that users will hit |
| Delete the test | Quarantine with ticket, owner and date | The behaviour stays unverified with no record |
| Declare victory after 5 green runs | Run 3/rate times in the failing condition | Five passes say almost nothing about a 5% flake |
| Fix several suspects at once | One change, then re-measure | You will not know which change worked |

## Verification checklist

- [ ] The flake rate was measured before the fix with a recorded command.
- [ ] One cause class was named, with the evidence that supports it.
- [ ] For order-dependent failures, the polluting test was identified.
- [ ] The fix removes the dependency on timing, order or environment; no added sleeps, retries or longer timeouts.
- [ ] The rate after the fix is zero over at least 3/(original rate) runs in the condition that failed.
- [ ] Any quarantine has a ticket, an owner and a review date.

## Related

- Workflows: `/root-cause`, `/e2e`, `/verify`, `/tdd`.
- Knowledge: `concurrency-bugs`, `test-data-management`, `browser-automation`, `python-testing`, `golang-testing`, `react-testing`, `ci-cd-github-actions`.
- Agents: `test-engineer`, `e2e-runner`.
