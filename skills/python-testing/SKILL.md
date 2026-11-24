---
name: python-testing
disable-model-invocation: true
description: >-
  Writes and fixes pytest suites in depth: pyproject configuration, fixtures,
  scopes and conftest, parametrize with ids, monkeypatch and unittest.mock at
  boundaries with autospec, tmp_path and caplog, Hypothesis property tests,
  async tests, branch coverage, markers, pytest-xdist, and diagnosing flaky or
  slow tests. Use when writing Python tests, setting up pytest, or when a
  Python suite is slow, flaky or not catching bugs.
---

# Python Testing with pytest

Tests should fail for one reason, run in any order, and need no network.
Use fixtures for setup, parametrize for variations, real objects inside the
boundary and fakes or mocks only at it.

## When to use

- Adding tests to Python code, or setting up pytest in a new project.
- Tests that pass alone but fail together, or fail only in CI.
- Suites that take minutes and need to be split, parallelised or sped up.
- Deciding what to mock, or replacing mocks that test implementation details.
- Adding property-based tests for parsers, serialisers and pure logic.

## When not to use

- Test strategy across a whole system (pyramid, contracts, mutation testing): use `tdd-testing`.
- Red-green-refactor as a guided loop: use `/tdd`. Raising coverage on a codebase: use `/test-coverage`.
- HTTP API suites and contract checks: use `api-testing` and `contract-testing`.
- Factories and seed data at scale: use `test-data-management`.

## Workflow

1. **Configure pytest strictly.** Put config in `pyproject.toml` (pattern below): strict markers and config, warnings as errors, `importlib` import mode, and branch coverage.

   **Check:** `pytest --collect-only -q` lists the expected tests and no "unknown marker" or config warnings.

2. **Mirror the source layout.** `tests/unit/` and `tests/integration/` mirror `src/<pkg>/`. Shared fixtures go in the nearest `conftest.py`; no test imports another test module.

   **Check:** Each test file maps to one module or feature; `conftest.py` files hold only fixtures and hooks.

3. **Write the test from the behaviour.** Arrange with fixtures, act once, assert on outputs and observable side effects. Name tests after behaviour: `test_refund_rejects_amount_above_captured`.

   **Check:** Temporarily break the code under test; the new test fails with a readable message.

4. **Mock only at boundaries.** Patch network, clock, randomness, filesystem roots and third-party SDKs; keep your own classes real. Patch where the name is looked up (`mypkg.billing.httpx`, not `httpx`), and use `autospec=True` so wrong signatures fail.

   **Check:** No test asserts on private helpers or the exact sequence of internal calls.

5. **Parametrize variations and add properties.** One test function plus `@pytest.mark.parametrize` with `ids`; for parsers, encoders and maths add Hypothesis properties (round-trip, idempotence, invariants).

   **Check:** Failure output names the failing case id; Hypothesis shrinks failures to a minimal example.

6. **Keep it fast and isolated.** Run `pytest --durations=15` and fix the slowest; scope expensive fixtures to `session` only when they are read-only; parallelise with `pytest -n auto` (pytest-xdist) once tests are isolated.

   **Check:** Suite passes in random order (pytest-randomly shuffles by default once installed) and with `-n auto`.

7. **Measure coverage by branch, not lines.** `pytest --cov --cov-branch --cov-report=term-missing` (pytest-cov). Read the missing branches; add tests for decisions, not for getters.

   **Check:** Coverage meets `fail_under` and every new branch in the diff is exercised.

## Patterns

### pyproject configuration

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = ["-ra", "--strict-markers", "--strict-config", "--import-mode=importlib"]
markers = [
  "slow: takes more than a second",
  "integration: needs a database or other external service",
]
filterwarnings = ["error"]
xfail_strict = true

[tool.coverage.run]
branch = true
source_pkgs = ["mypkg"]

[tool.coverage.report]
show_missing = true
skip_covered = true
fail_under = 85
exclude_also = ["if TYPE_CHECKING:", "raise NotImplementedError"]
```

### Fixtures, factories and parametrize

```python
import pytest
from mypkg.billing import Invoice, apply_discount


@pytest.fixture
def make_invoice():
    def _make(total_cents: int = 10_000, currency: str = "EUR") -> Invoice:
        return Invoice(total_cents=total_cents, currency=currency)
    return _make


@pytest.mark.parametrize(
    ("percent", "expected"),
    [
        pytest.param(0, 10_000, id="no-discount"),
        pytest.param(15, 8_500, id="fifteen-percent"),
        pytest.param(100, 0, id="free"),
    ],
)
def test_apply_discount(make_invoice, percent, expected):
    assert apply_discount(make_invoice(), percent).total_cents == expected


def test_apply_discount_rejects_negative(make_invoice):
    with pytest.raises(ValueError, match="percent"):
        apply_discount(make_invoice(), -5)
```

### Boundary mocking and built-in fixtures

```python
from unittest.mock import create_autospec

from mypkg.payments import Gateway, charge


def test_charge_retries_once_on_timeout(monkeypatch, caplog):
    gateway = create_autospec(Gateway, instance=True)
    gateway.capture.side_effect = [TimeoutError, {"id": "ch_1"}]
    monkeypatch.setenv("PAYMENTS_MAX_RETRIES", "1")

    result = charge(gateway, amount_cents=500)

    assert result == "ch_1"
    assert gateway.capture.call_count == 2
    assert "retrying" in caplog.text


def test_export_writes_csv(tmp_path):
    out = tmp_path / "report.csv"
    export_report(out)
    assert out.read_text().splitlines()[0] == "id,total"
```

### Hypothesis property

```python
from hypothesis import given, strategies as st


@given(st.dictionaries(st.text(), st.integers()))
def test_encode_round_trips(data):
    assert decode(encode(data)) == data
```

### Async tests

With pytest-asyncio, set `asyncio_mode = "auto"` under `[tool.pytest.ini_options]` or mark tests `@pytest.mark.asyncio`. With AnyIO, mark `@pytest.mark.anyio`. Never call `asyncio.run` inside a test; let the plugin own the loop.

### Flaky-test triage

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| Fails only in a full run | Shared state: module globals, env vars, singletons, DB rows | Fixture teardown, `monkeypatch`, transaction rollback per test |
| Fails under `-n auto` | Shared files, ports or DB names | `tmp_path`, port 0, per-worker DB (`worker_id` fixture) |
| Fails near midnight or in CI timezone | Real clock | Inject a clock, or freeze time (time-machine, freezegun) |
| Random failures | Unseeded randomness, set ordering | Seed explicitly; reproduce with `--randomly-seed=<n>` (pytest-randomly prints the seed) |
| Timeouts | Real network or `sleep` | Fake the client (respx, responses); poll with a deadline |

Rerun plugins (`--reruns`) are quarantine, not a fix: track every rerun test in an issue.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `mock.patch("requests.get")` when code does `from requests import get` | Patch the name where it is used | Otherwise the patch never applies |
| Mocks without `autospec` | `create_autospec` or `autospec=True` | Typos in mocked methods pass silently |
| `autouse=True` fixtures for convenience | Request fixtures explicitly | Hidden setup makes tests hard to read and slow |
| `session` scope for mutable resources | Function scope or rollback per test | State leaks between tests |
| Asserting on log text for business logic | Assert on return values and effects | Log wording changes break tests |
| Deleting a failing assertion | Fix the code or the test's wrong assumption | Weakened tests hide real defects |

## Verification checklist

- [ ] Config uses strict markers, strict config and warnings as errors.
- [ ] New tests fail when the behaviour is broken and pass when fixed.
- [ ] Mocks exist only at boundaries and are autospecced.
- [ ] Suite passes in random order and in parallel.
- [ ] Branch coverage meets the threshold and covers the diff.
- [ ] No test touches the real network or wall clock.

## Related

- Knowledge: `python-patterns`, `tdd-testing`, `test-data-management`, `api-testing`, `contract-testing`, `python-fastapi`.
- Workflows: `/tdd`, `/test-coverage`, `/verify`.
- Agents: `test-engineer`, `python-reviewer`.
