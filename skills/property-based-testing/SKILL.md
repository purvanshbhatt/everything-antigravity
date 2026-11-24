---
name: property-based-testing
disable-model-invocation: true
description: >-
  Writes property-based tests that state invariants instead of examples, with
  Hypothesis, fast-check, jqwik, proptest and rapid: round trips, idempotence,
  oracles, metamorphic and stateful model tests, generators that reach edge
  cases, shrinking to minimal counterexamples, CI seeds and run budgets. Use
  for parsers, serializers, data structures, money or date math, or when
  example tests keep missing edge cases.
---

# Property-Based Testing

An example test checks one input. A property test states a rule that must hold for every input, lets a library generate hundreds of inputs, and shrinks any failure to the smallest input that still breaks the rule. It finds the edge cases nobody thought to write down. This skill covers choosing properties, building generators and running them reproducibly.

## When to use

- Code that transforms data with a clear rule: parsers, serializers, encoders, formatters, normalizers, query builders.
- Data structures and algorithms: sorting, merging, caches, ring buffers, diffing, CRDTs.
- Arithmetic with traps: money, rounding, time zones, units, pagination boundaries.
- A rewrite or optimization that must behave exactly like the old version.
- Bugs keep arriving from inputs nobody wrote a test for: empty values, Unicode, duplicates, extreme numbers.

## When not to use

- Behaviour is best shown by a few named business cases (pricing tiers, permission rules): write example tests with `/tdd`.
- Checking whether existing tests would catch bugs at all: use `mutation-testing`.
- Feeding hostile bytes into native code for crashes and memory errors: coverage-guided fuzzing in `rust-testing` or `cpp-testing`.
- UI flows: use `/e2e`.

## Workflow

1. **Pick the unit and list candidate properties.** Read the function or module with `view_file` and write down, in plain words, what must always be true of its output. Use the property table below as a checklist. Aim for two or three properties that together pin the behaviour.

   **Check:** Each property is one sentence that does not describe how the code computes its answer.

2. **Make sure the property is not the implementation.** If checking the property needs the same algorithm as the code, it proves nothing. Prefer relations (round trip, idempotence), invariants (length, order, sum), or a simple slow oracle that is obviously correct.

   **Check:** A reviewer could believe the property without reading the implementation.

3. **Build the generator from valid parts.** Construct valid inputs with `map`, `builds` or composite generators instead of generating anything and filtering. Include the awkward values on purpose: empty collections, one element, duplicates, negative zero, NaN where the domain allows it, very large numbers, combining characters and emoji, leap days and DST transitions.

   **Check:** Generation statistics (`--hypothesis-show-statistics`, fast-check `fc.statistics`) show the interesting cases occur, and the filter rejection rate is low.

4. **Write the test with a budget.** Start with the library default (usually 100 cases). Raise it for cheap, critical code; lower it for slow code and add a time limit. Library syntax is in [library reference](references/libraries.md).

   ```python
   from hypothesis import given, strategies as st

   @given(st.lists(st.integers()))
   def test_sort_keeps_elements_and_orders_them(xs):
       out = my_sort(xs)
       assert sorted(out) == sorted(xs)                         # same multiset
       assert all(a <= b for a, b in zip(out, out[1:]))        # ordered
   ```

   ```ts
   import fc from 'fast-check';

   test('decode inverts encode', () => {
     fc.assert(fc.property(fc.string(), (s) => {
       expect(decode(encode(s))).toBe(s);
     }), { numRuns: 300 });
   });
   ```

   **Check:** The test passes on correct code, and fails when you deliberately break the code (invert a comparison, drop a character).

5. **Read the shrunk counterexample.** When a property fails, the library reports a minimal input and a seed. Reproduce it with the seed, decide whether the code or the property is wrong, and fix the right one. A property that is wrong for a legitimate input needs a narrower generator or a precondition, stated in a comment.

   **Check:** You can explain why the shrunk input breaks the rule in one sentence.

6. **Promote the counterexample to a permanent case.** Pin every found failure so it runs on every build, regardless of seed: `@example(...)` in Hypothesis, the `examples` option in fast-check, `@Example` methods in jqwik, and committed `proptest-regressions/` files in proptest.

   **Check:** The pinned case fails on the old code and passes on the fix.

7. **Make CI reproducible.** In CI, run a fixed seed or a derandomized profile so a red build means a code change, and print the seed on failure. Run a larger randomized budget in a nightly or scheduled job to keep exploring. Write any new failure from the nightly back as a pinned example.

   **Check:** The same commit gives the same result twice in CI, and the nightly job reports its seed.

## Patterns

### Properties that pay off

| Property | Rule | Good for |
| :--- | :--- | :--- |
| Round trip | `decode(encode(x)) == x` | Serializers, codecs, parsers with printers, URL building |
| Idempotence | `f(f(x)) == f(x)` | Normalizers, formatters, dedupe, upserts, migrations |
| Invariant | Output keeps a measurable fact: length, sum, set of elements, sortedness | Sorting, partitioning, ledgers, collections |
| Oracle | Fast code agrees with a slow, obvious version | Optimizations, caches, rewrites, ports between languages |
| Metamorphic | A known change to the input causes a known change to the output | Search ranking, filters, geometry, ML preprocessing |
| Algebraic | Commutative, associative or identity laws hold | Merges, CRDTs, money addition, set operations |
| Robustness | Any input either succeeds or fails with the documented error type | Parsers and validators facing user input |
| Stateful model | A random sequence of operations on the real system matches a simple model | Caches, queues, repositories, APIs with state |

### Stateful testing in one paragraph

Model the system with the simplest structure that could be right (a dictionary for a cache, a list for a queue). Generate random sequences of commands, apply each to both the real system and the model, and compare after every step. Hypothesis has `RuleBasedStateMachine`, fast-check has `fc.commands` with `fc.modelRun`, and jqwik has action chains. Shrinking then gives the shortest command sequence that diverges, which is usually a readable bug report.

### Generator rules of thumb

- Build valid values directly; filter only for rare exclusions.
- Keep sizes bounded (`max_size`, `maxLength`) so runs stay fast and failures stay readable.
- For domain types, write one shared generator per type and reuse it across tests.
- For floats, decide on NaN and infinity explicitly; most money code should not use floats at all.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Recompute the expected value with the same algorithm | Use a relation, an invariant or a simpler oracle | A copied bug passes its own test |
| Generate anything, then filter heavily | Construct valid values | Slow runs, health-check failures, weak coverage |
| Let CI pick a new random seed with no record | Fixed or derandomized seed in CI, exploration nightly | Unreproducible red builds erode trust |
| Fix the failure and move on | Pin the shrunk case as an explicit example | The seed that found it will not run again |
| Raise case counts until the suite is slow | Set budgets per test; big runs nightly | Developers start skipping slow suites |
| Replace all example tests | Keep named examples for documentation | Examples explain intent; properties hunt edge cases |

## Verification checklist

- [ ] Each property is stated in plain words and does not mirror the implementation.
- [ ] Generators produce valid inputs, including empty, duplicate, extreme and Unicode cases where they apply.
- [ ] Each new property was seen failing against a deliberately broken version of the code.
- [ ] Every counterexample found is pinned as an explicit example or committed regression file.
- [ ] CI runs are reproducible (fixed seed or derandomized) and print the seed on failure.
- [ ] Run budgets keep the suite within its time limit; any larger exploration runs on a schedule.

## Related

- Workflows: `/tdd`, `/test-coverage`, `/root-cause`.
- Knowledge: `mutation-testing`, `tdd-testing`, `python-testing`, `rust-testing`, `golang-testing`, `fintech-ledgers`.
- Agents: `test-engineer`.
