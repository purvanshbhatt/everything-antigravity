---
name: rust-testing
description: >-
  Writes and runs Rust tests in depth: unit tests in cfg(test) modules,
  integration tests in tests/, doc tests, cargo-nextest, proptest property
  tests, insta snapshot tests, async tests with tokio, criterion benchmarks,
  coverage with cargo-llvm-cov, fuzzing with cargo-fuzz, and miri for unsafe
  code. Use when adding or fixing Rust tests, proving a performance change, or
  checking unsafe code for undefined behaviour.
---

# Rust Testing

Rust gives three test kinds for free: unit tests next to the code, integration
tests against the public API, and doc tests that keep examples honest. Add
properties for invariants, snapshots for large outputs, criterion for speed
claims and miri for every `unsafe` block.

## When to use

- Adding tests to a crate, binary or workspace.
- Parsers, encoders and state machines that need property or fuzz testing.
- Large or structured outputs (CLI text, JSON, ASTs) that are tedious to assert by hand.
- Performance changes that need a benchmark baseline.
- Any crate containing `unsafe`, raw-pointer code or manual `Send`/`Sync` impls.

## When not to use

- Ownership design, error types and async service structure: use `rust-systems`.
- Test strategy across a system: use `tdd-testing`. Profiling: use `profiling`.
- Build or dependency failures: delegate to the `rust-build-resolver` agent.
- A diff review: delegate to the `rust-reviewer` agent.

## Workflow

1. **Baseline the suite.**

   ```bash
   cargo test --workspace --all-targets          # unit + integration + examples/benches compile
   cargo test --workspace --doc                  # doc tests
   cargo clippy --workspace --all-targets -- -D warnings
   ```

   **Check:** All pass, or pre-existing failures are recorded.

2. **Put each test at the right level.** Unit tests in `#[cfg(test)] mod tests` inside the module (they can reach private items); integration tests in `tests/*.rs` (each file is a separate crate using only the public API, shared helpers in `tests/common/mod.rs`); usage examples as doc tests on public items.

   **Check:** Integration tests compile without `pub(crate)` leaks added just for testing.

3. **Write focused tests that explain failures.** Return `Result<(), Box<dyn std::error::Error>>` so `?` works; use `assert_eq!` with a message; `#[should_panic(expected = "...")]` only for documented panics. Use `pretty_assertions` for readable diffs of large structs.

   **Check:** Breaking the code under test produces a failure message that names the problem.

4. **Add properties for invariants.** Use proptest for round-trips, ordering, idempotence and "never panics" on arbitrary input. Commit the `proptest-regressions/` files it writes on failure.

   **Check:** Introducing a bug makes proptest fail and shrink to a minimal case.

5. **Snapshot large outputs with insta.** `assert_snapshot!`, `assert_debug_snapshot!`, or `assert_json_snapshot!` (feature `json`). Review changes with `cargo insta review`; never bulk-accept without reading the diff.

   **Check:** Snapshots live in `snapshots/` next to the tests, and CI fails on unreviewed changes (insta does not write new snapshots when it detects CI).

6. **Test async code deterministically.** `#[tokio::test]` for async tests; `#[tokio::test(start_paused = true)]` (tokio `test-util` feature) to control time with `tokio::time::advance` instead of real sleeps.

   **Check:** Timeout and retry tests run in milliseconds of wall time.

7. **Benchmark with criterion.** Benchmarks in `benches/` with `harness = false`; save a baseline on the main branch and compare.

   ```bash
   cargo bench --bench parse -- --save-baseline main
   # apply the change
   cargo bench --bench parse -- --baseline main
   ```

   **Check:** Criterion reports the change as outside the noise threshold before you claim a speed-up.

8. **Run miri on unsafe code, fuzz parsers.**

   ```bash
   rustup +nightly component add miri
   cargo +nightly miri test                       # slow; scope with a test-name filter
   cargo install cargo-fuzz && cargo +nightly fuzz run parse_input -- -max_total_time=60
   ```

   **Check:** miri reports no undefined behaviour; the fuzzer runs its time budget without crashes.

## Patterns

### Unit, doc and property tests

```rust
/// Parses "12.34" into cents.
///
/// ```
/// assert_eq!(money::parse_cents("12.34").unwrap(), 1234);
/// ```
pub fn parse_cents(s: &str) -> Result<i64, ParseError> { /* ... */ }

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    #[test]
    fn rejects_three_decimals() {
        assert_eq!(parse_cents("1.234"), Err(ParseError::Precision));
    }

    proptest! {
        #[test]
        fn format_then_parse_round_trips(cents in -1_000_000_000i64..1_000_000_000) {
            prop_assert_eq!(parse_cents(&format_cents(cents)).unwrap(), cents);
        }

        #[test]
        fn never_panics(s in "\\PC*") {
            let _ = parse_cents(&s);
        }
    }
}
```

### Snapshot and async tests

```rust
#[test]
fn renders_help() {
    let out = cli::render_help();
    insta::assert_snapshot!(out);
}

#[tokio::test(start_paused = true)]
async fn retries_then_times_out() {
    let started = tokio::time::Instant::now();
    let err = fetch_with_retry(FailingClient::default()).await.unwrap_err();
    assert!(matches!(err, FetchError::Timeout));
    assert!(started.elapsed() >= std::time::Duration::from_secs(3)); // virtual time
}
```

### Criterion benchmark

```toml
# Cargo.toml
[dev-dependencies]
criterion = "0.5"        # check crates.io for the current version

[[bench]]
name = "parse"
harness = false
```

```rust
// benches/parse.rs
use criterion::{criterion_group, criterion_main, Criterion};
use std::hint::black_box;

fn bench_parse(c: &mut Criterion) {
    c.bench_function("parse_cents", |b| b.iter(|| money::parse_cents(black_box("12345.67"))));
}

criterion_group!(benches, bench_parse);
criterion_main!(benches);
```

### Runner and tooling choices

| Need | Tool | Notes |
| :--- | :--- | :--- |
| Faster, isolated runs | `cargo nextest run` | Process per test, retries for quarantine; does not run doc tests, so keep `cargo test --doc` |
| Coverage | `cargo llvm-cov --workspace --html` or `--lcov --output-path lcov.info` | Works on Linux, macOS and Windows |
| Mocks | Traits with hand-written fakes; `mockall` for large traits | Prefer fakes; mocks couple tests to calls |
| Compile-fail tests for macros | `trybuild` | Asserts error messages |
| Concurrency permutations | `loom` | Exhaustively explores interleavings of small primitives |
| Show output | `cargo test -- --nocapture`; serial: `-- --test-threads=1` | Use serial only to diagnose shared-state bugs |
| Ignored slow tests | `#[ignore]`, run with `cargo test -- --ignored` | Run them in a scheduled CI job |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `unwrap()` chains that panic without context | Return `Result` from the test or use `expect("why")` | The panic message should explain the failure |
| `pub` items added only for tests | Unit tests inside the module, or `#[cfg(test)]` helpers | Widens the public API forever |
| Real `sleep` in async tests | `start_paused = true` and `time::advance` | Slow and flaky |
| `cargo insta accept` without review | `cargo insta review`, diff by diff | Snapshots silently bless regressions |
| Benchmarks without `black_box` | Wrap inputs and results in `std::hint::black_box` | The optimiser deletes the work |
| `unsafe` code without miri in CI | A miri job on the crates that contain `unsafe` | UB often passes normal tests |

## Verification checklist

- [ ] `cargo test --workspace --all-targets` and `cargo test --doc` pass.
- [ ] Public items with examples have doc tests that compile and run.
- [ ] Invariants have proptest coverage; regression files are committed.
- [ ] Snapshot changes were reviewed, not bulk-accepted.
- [ ] Speed claims come with a criterion baseline comparison.
- [ ] Crates with `unsafe` pass `cargo +nightly miri test`.

## Related

- Knowledge: `rust-systems`, `tdd-testing`, `profiling`, `concurrency-bugs`, `webassembly`.
- Workflows: `/tdd`, `/test-coverage`, `/verify`.
- Agents: `rust-reviewer`, `rust-build-resolver`, `test-engineer`.
