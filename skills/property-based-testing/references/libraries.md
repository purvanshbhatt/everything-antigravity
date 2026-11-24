# Property-based testing: library reference

Syntax for the common libraries. APIs move between major versions, so check the installed version's docs when a name does not resolve.

| Language | Library | Install |
| :--- | :--- | :--- |
| Python | Hypothesis | `pip install hypothesis` (pytest plugin included) |
| JS / TS | fast-check | `npm i -D fast-check` (plus `@fast-check/vitest` or `@fast-check/jest` if wanted) |
| Java / Kotlin | jqwik | `net.jqwik:jqwik` test dependency on the JUnit Platform |
| Rust | proptest | `cargo add --dev proptest` |
| Go | rapid | `go get pgregory.net/rapid` |

## Hypothesis (Python)

```python
import os
from hypothesis import given, example, settings, strategies as st

# conftest.py: one place for budgets and CI determinism
settings.register_profile("ci", derandomize=True, max_examples=200, deadline=None)
settings.register_profile("nightly", max_examples=5000, deadline=None)
settings.load_profile(os.getenv("HYPOTHESIS_PROFILE", "default"))

@st.composite
def money(draw):
    cents = draw(st.integers(min_value=-10**9, max_value=10**9))
    currency = draw(st.sampled_from(["EUR", "USD", "JPY"]))
    return Money(cents, currency)

@given(money())
@example(Money(0, "JPY"))                 # pinned counterexample from an earlier failure
def test_adding_zero_is_identity(m):
    assert m + Money(0, m.currency) == m
```

- Run options: `pytest --hypothesis-profile=ci`, `--hypothesis-seed=123`, `--hypothesis-show-statistics`.
- Builders: `st.builds(User, name=st.text(min_size=1))`, `st.from_type(Order)`, `st.one_of(...)`, `st.lists(x, max_size=50, unique=True)`.
- Preconditions: `assume(cond)` inside the test; keep rejections rare or the health check fails.
- Local failures are saved in `.hypothesis/` and replayed first. Keep that folder out of version control and pin important cases with `@example`.
- Stateful: subclass `hypothesis.stateful.RuleBasedStateMachine`, mark operations with `@rule(...)` and checks with `@invariant()`, then expose `TestX = XMachine.TestCase`.

## fast-check (JavaScript and TypeScript)

```ts
import fc from 'fast-check';

fc.configureGlobal({ numRuns: 200, seed: Number(process.env.FC_SEED ?? 20261123) });

const lineItem = fc.record({
  sku: fc.constantFrom('A1', 'B2', 'C3'),
  qty: fc.integer({ min: 1, max: 99 }),
  cents: fc.integer({ min: 0, max: 1_000_000 }),
});

test('order total does not depend on line order', () => {
  fc.assert(
    fc.property(fc.array(lineItem, { maxLength: 30 }), (items) => {
      expect(total([...items].reverse())).toBe(total(items));
    }),
    { examples: [[[]]] },                 // pinned: the empty order
  );
});
```

- A failure prints the seed and a `path`; replay with `fc.assert(prop, { seed, path })`.
- Async code: `await fc.assert(fc.asyncProperty(arb, async (x) => { ... }))`.
- Combinators: `.map`, `.chain` (dependent values), `.filter` (sparingly), `fc.oneof`, `fc.tuple`, `fc.uniqueArray`.
- Test-runner helpers: `import { test, fc } from '@fast-check/vitest'`, then `test.prop([fc.string()])('name', (s) => { ... })`.
- Model-based: define command classes with `check`, `run` and `toString`, then `fc.assert(fc.property(fc.commands([...]), (cmds) => fc.modelRun(setup, cmds)))`.
- String options changed between v3 and v4 (for example how full Unicode is requested); check the docs for your version.

## jqwik (Java and Kotlin)

```java
import net.jqwik.api.*;

class MoneyProperties {

    @Property(tries = 500)
    boolean addingZeroIsIdentity(@ForAll("amounts") long cents) {
        return Money.of(cents).plus(Money.ZERO).equals(Money.of(cents));
    }

    @Provide
    Arbitrary<Long> amounts() {
        return Arbitraries.longs().between(-1_000_000_000L, 1_000_000_000L);
    }

    @Example                                // pinned counterexample, runs once like a unit test
    boolean minimumValueRegression() {
        return Money.of(-1_000_000_000L).plus(Money.ZERO).equals(Money.of(-1_000_000_000L));
    }
}
```

- Replay a reported failure with `@Property(seed = "<reported seed>")`, then remove the seed once it is pinned as an `@Example`.
- Arbitraries: `Arbitraries.strings().alpha().ofMaxLength(20)`, `.list().ofMaxSize(50)`, `Combinators.combine(a, b).as(Type::new)`.
- Stateful: jqwik's action-chain support runs random sequences of actions against a model.

## proptest (Rust)

```rust
use proptest::prelude::*;

prop_compose! {
    fn line_item()(qty in 1u32..100, cents in 0u64..1_000_000) -> LineItem {
        LineItem { qty, cents }
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(500))]

    #[test]
    fn total_ignores_order(items in prop::collection::vec(line_item(), 0..30)) {
        let mut reversed = items.clone();
        reversed.reverse();
        prop_assert_eq!(total(&reversed), total(&items));
    }
}
```

- Failures are written to `proptest-regressions/`. Commit those files: they replay before any new cases.
- Override the case count without editing code: `PROPTEST_CASES=5000 cargo test` (PowerShell: `$env:PROPTEST_CASES = "5000"; cargo test`).
- Strategies: `any::<T>()`, ranges, regex strings such as `"[a-z]{1,12}"`, `prop_oneof![...]`, `.prop_map`, `.prop_flat_map`.
- Stateful testing: the `proptest-state-machine` crate.

## rapid (Go)

```go
func TestRoundTrip(t *testing.T) {
    rapid.Check(t, func(t *rapid.T) {
        s := rapid.String().Draw(t, "s")
        got, err := Decode(Encode(s))
        if err != nil || got != s {
            t.Fatalf("round trip changed %q into %q (err %v)", s, got, err)
        }
    })
}
```

- Raise the budget with `go test -run TestRoundTrip -rapid.checks=5000`.
- On failure rapid prints how to replay it; copy that into the PR and pin the input as a table-driven case.
- For crash-finding on bytes, Go's built-in fuzzing (`func FuzzX(f *testing.F)`, `go test -fuzz=FuzzX`) complements rapid; its corpus lives in `testdata/fuzz/`.
