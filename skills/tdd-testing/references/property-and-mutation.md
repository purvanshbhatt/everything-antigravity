# Property-based and mutation testing

## Property patterns

| Pattern | Statement | Example |
| :--- | :--- | :--- |
| Round trip | `decode(encode(x)) == x` | JSON, protobuf, URL, money formatting |
| Invariant | Some fact always holds after the operation | Sorted output is ordered and a permutation of the input |
| Idempotence | `f(f(x)) == f(x)` | Normalisers, upserts, dedupe |
| Oracle | Fast implementation equals a slow obvious one | Optimised search versus linear scan |
| Metamorphic | Related inputs give related outputs | Adding a discount never raises the total |
| Model-based | Sequence of commands on the system matches a simple model | Cache versus a `Map`, state machines |

## fast-check (TypeScript / JavaScript)

```ts
import fc from 'fast-check';
import { describe, it } from 'vitest';

describe('splitPayment', () => {
  it('parts always sum to the total and differ by at most one cent', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000_000 }), fc.integer({ min: 1, max: 50 }), (total, n) => {
        const parts = splitPayment(total, n);
        const sum = parts.reduce((a, b) => a + b, 0);
        return parts.length === n && sum === total && Math.max(...parts) - Math.min(...parts) <= 1;
      }),
    );
  });
});
```

On failure, fast-check prints the shrunk counterexample and a seed; replay with `fc.assert(prop, { seed, path })` and turn the counterexample into a regular example test.

## Hypothesis (Python)

```python
from hypothesis import given, strategies as st

@given(st.lists(st.integers()))
def test_sort_is_ordered_permutation(xs: list[int]) -> None:
    out = my_sort(xs)
    assert all(a <= b for a, b in zip(out, out[1:]))
    assert sorted(xs) == out

@given(st.text())
def test_slug_is_idempotent(s: str) -> None:
    assert slugify(slugify(s)) == slugify(s)
```

Hypothesis stores failing examples in `.hypothesis/` and replays them first on the next run; add that directory to `.gitignore` or commit it deliberately. Use `@example(...)` to pin known edge cases. Stateful testing: `hypothesis.stateful.RuleBasedStateMachine`.

Other ecosystems: Go `testing/quick` or `pgregory.net/rapid`, Rust `proptest`, JVM `jqwik`, .NET `FsCheck`. Go's native fuzzing (`go test -fuzz=FuzzParse`) suits parsers.

## Mutation testing

The tool changes the code (flips `<` to `<=`, deletes a statement, replaces a return value) and re-runs the tests. A mutant that survives means no test noticed the change.

| Ecosystem | Tool | Commands |
| :--- | :--- | :--- |
| JS / TS | StrykerJS | `npx stryker init` then `npx stryker run`; scope with `--mutate "src/orders/**/*.ts"`; `--incremental` reuses previous results |
| C# | Stryker.NET | `dotnet tool install -g dotnet-stryker` then `dotnet stryker` |
| Python | mutmut | `mutmut run` then `mutmut results` and `mutmut show <id>`; configure paths in `setup.cfg` or `pyproject.toml` |
| JVM | PIT | Maven `mvn org.pitest:pitest-maven:mutationCoverage`, or the Gradle plugin |
| Rust | cargo-mutants | `cargo install cargo-mutants` then `cargo mutants` (`--file src/foo.rs` to scope) |
| Go | Gremlins | `gremlins unleash` (check the current docs for flags) |

Working with the results:

- Run on changed files in PRs and on the whole codebase nightly; full runs are slow.
- A surviving mutant in a conditional usually means a missing boundary test (exactly at the limit).
- A surviving "removed call" mutant on a side effect means the effect is never asserted.
- Equivalent mutants (behaviour truly unchanged) exist; mark them and move on instead of contorting tests.
- Set a ratchet: the break threshold equals the current score, raised over time (Stryker `thresholds.break`).

## Characterization of a good unit test

- Name states behaviour: `rejects_checkout_when_cart_is_empty`.
- One reason to fail; arrange-act-assert visible at a glance.
- Asserts outcomes (return values, state, emitted events, boundary spies), not internal calls.
- Runs in milliseconds, in any order, in parallel, with no network.
