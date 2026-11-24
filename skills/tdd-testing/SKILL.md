---
name: tdd-testing
description: >-
  Test-driven development: failing test first, smallest change to pass, refactor, and test design across unit to e2e.
---

# Testing Strategy

A test suite is worth what it catches. Aim tests at behaviour through public
interfaces, fake only what you do not control, and measure suite strength with
mutation testing rather than line coverage.

## When to use

- Deciding the mix of unit, integration, contract and end-to-end tests for a feature or service.
- Tests break on every refactor (over-mocking) or pass while production breaks (under-testing).
- A flaky test needs triage, or a suite is too slow to run before each commit.
- Coverage looks good but defects escape: check suite strength with mutation testing.

## When not to use

- Running the red-green-refactor loop on a concrete change: use `/tdd`.
- Raising coverage on an existing module: use `/test-coverage`.
- Browser journeys: use `/e2e` and `browser-automation`.
- Evaluating LLM or agent output quality: use `agent-evals`.

## Workflow

1. **Pick the test shape for the code under test.** Use the table below. Business logic with many branches gets fast unit tests; glue code (handlers, repositories) gets integration tests against real dependencies; cross-service promises get contract tests; a handful of critical user journeys get end-to-end tests.

   **Check:** You can name, for the change, which layer each new test belongs to and why.

2. **Draw the mock boundary.** Mock or fake only at process boundaries you do not own or cannot run cheaply: third-party HTTP APIs, payment providers, email, clocks, randomness. Run your own database in a container (Testcontainers or a docker compose service) instead of mocking the ORM. Wrap third-party SDKs in a small port you own, then fake the port.

   **Check:** `grep_search` for `mock(`/`patch(`/`jest.mock` in the new tests shows only boundary modules, never your own domain classes.

3. **Prefer fakes and builders to mock scripts.** A fake (in-memory repository, fake clock) has real behaviour and supports many tests; a mock that asserts call order couples tests to implementation. Build test data with builders that default everything and override only what the test cares about.

   **Check:** Each test's arrange section mentions only the fields that affect its assertion.

4. **Add property-based tests for logic with wide input spaces** (parsers, serializers, money math, sorting, state machines). See [property and mutation testing](references/property-and-mutation.md) for patterns and commands.

   **Check:** At least one property per pure function family: round-trip, invariant, idempotence or oracle.

5. **Measure strength with mutation testing on changed code.** Run Stryker (JS/TS, C#), mutmut (Python), PIT (JVM), cargo-mutants (Rust) or Gremlins (Go) scoped to the files you changed. Kill surviving mutants by adding assertions, not by testing implementation details.

   **Check:** Mutation score on changed files is at or above the project's bar (a common starting bar is 70%); every surviving mutant is either killed or written down as equivalent.

6. **Keep the suite fast and deterministic.** Unit tests in milliseconds, no sleeps, no real network, injected clock and random seed, unique data per test so tests can run in parallel and in random order.

   **Check:** The suite passes twice in a row with random ordering enabled and in parallel.

## Patterns

### Choosing the test shape

| Code | Primary test | Notes |
| :--- | :--- | :--- |
| Pure domain logic, calculations | Unit, plus properties | No mocks needed when logic is pure |
| Use case or application service | Unit with fakes for ports | Assert outcomes and emitted events, not calls |
| Repository, SQL, migrations | Integration against a real database | Testcontainers, transaction rollback or truncate per test |
| HTTP handler | Integration through the framework test client | Covers routing, validation, serialization, auth |
| Service-to-service promise | Contract test (Pact or schema-based) | Replaces most cross-service end-to-end tests |
| Critical user journey | End-to-end (few) | Sign-up, checkout, the money paths |

The pyramid (many unit, fewer integration, few end-to-end) suits logic-heavy code. The testing trophy (static analysis at the base, integration as the largest layer) suits UI and glue-heavy code. Both agree that end-to-end tests are the smallest layer.

### Test doubles

| Double | What it is | Use for |
| :--- | :--- | :--- |
| Stub | Returns canned answers | Feeding inputs from a boundary |
| Fake | Working lightweight implementation | Repositories, queues, clocks: reusable across tests |
| Spy | Records calls for later assertion | Verifying a side effect at a boundary (an email was sent) |
| Mock | Pre-programmed expectations, fails on unexpected calls | Rarely; protocol-heavy boundaries only |

### Test data builder (TypeScript)

```ts
export const anOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'ord_1', customerId: 'cus_1', currency: 'EUR', status: 'open',
  lines: [{ sku: 'SKU-1', qty: 1, unitPriceCents: 1000 }],
  ...overrides,
});

it('rejects checkout of an empty order', () => {
  expect(() => checkout(anOrder({ lines: [] }))).toThrow(EmptyOrderError);
});
```

Python equivalents: `factory_boy` or a plain function with keyword defaults. Go: functional options on a `newTestOrder(t, opts...)` helper.

### Flaky test triage

1. Reproduce by repetition, isolated and with the suite:

   ```bash
   go test -run TestCheckout -count=200 -race ./internal/orders/...
   pytest tests/test_checkout.py -p no:randomly --count=200 -x        # needs pytest-repeat
   for i in $(seq 50); do npx jest checkout.test.ts --runInBand || break; done
   ```

   ```powershell
   1..50 | ForEach-Object { npx jest checkout.test.ts --runInBand; if ($LASTEXITCODE -ne 0) { break } }
   ```

2. Classify the cause: time (real clock, time zones, DST), order dependence (shared state, leftover rows), async waits (sleep instead of awaiting a condition), concurrency (data races), external network, randomness without a seed, resource leaks (ports, files).
3. Fix the cause: inject the clock, isolate data, await conditions, seed randomness, give each test its own resources.
4. If it cannot be fixed now, quarantine with an owner and a ticket, and keep running it in a non-blocking job. Never delete it silently or loosen its assertion.

### Contract tests

- Consumer-driven (Pact): the consumer's tests produce a pact file; the provider verifies it in CI; `can-i-deploy` gates releases.
- Schema-based: the provider is fuzzed against its OpenAPI document (`st run http://localhost:8000/openapi.json` with Schemathesis) and consumers generate clients from the same document.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Mock your own classes | Test through the public API with fakes at the boundary | Every refactor breaks tests that verify call sequences |
| Mock the database or ORM | Real database in a container | Mocked SQL passes while the real query fails |
| Chase 100% line coverage | Mutation score on changed code plus risk-based tests | Coverage proves execution, not assertion |
| `sleep(2)` to wait for async work | Await the condition or use a fake clock | Sleeps are slow and still flaky |
| Weaken or delete a failing assertion | Fix the code, or quarantine with a ticket | A red test is a signal of a real defect |
| Giant shared fixtures | Builders with defaults and per-test overrides | Hidden coupling between unrelated tests |
| Snapshot everything | Snapshots for stable serialized output only, reviewed on change | Snapshot churn hides regressions |

## Verification checklist

- [ ] Each new test sits at the layer the table recommends for that code.
- [ ] Mocks and fakes exist only at process or third-party boundaries.
- [ ] Pure logic with wide inputs has at least one property-based test.
- [ ] Mutation testing ran on changed files and survivors were killed or justified.
- [ ] The suite passes in random order, in parallel, twice in a row.
- [ ] No assertion was weakened or test skipped to get green.

## Related

- Workflows: `/tdd`, `/test-coverage`, `/e2e`, `/verify`, `/build-fix`.
- Knowledge: `safe-refactor` (characterization tests), `api-design` (contracts), `browser-automation`, `agent-evals`.
- Agents: `test-engineer`, `e2e-runner`, `code-reviewer`.
