---
trigger: glob
globs: "**/*.rs"
description: Rust conventions
---

# Rust

## Tooling

- Code must pass `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings` and `cargo test`. Do not add `#[allow(...)]` to silence a lint without a reason comment.
- Respect the crate's `edition` and `rust-version` (MSRV). Run `cargo audit` or `cargo deny check` when available after dependency changes.
- Keep Cargo features additive; a feature must never remove functionality.

## Errors

- Return `Result<T, E>` and propagate with `?`. Libraries define typed errors (`thiserror`); applications may use `anyhow` with `.context("reading config")`.
- No `unwrap()`, `expect()` or `panic!` in library or service code paths that can fail at runtime. `expect("reason")` is allowed for true invariants, with the invariant stated in the message. Tests and examples may unwrap.
- Error types implement `std::error::Error` and `Display`, and keep the source error via `#[source]` or `#[from]`.
- Never silently discard a `Result` with `let _ =` unless commented.

## Ownership and types

- Borrow before cloning. Take `&str`, `&[T]` or `impl AsRef<Path>` in parameters; return owned types. Clone only where it simplifies code without cost on hot paths, and say so.
- Use newtypes for IDs and units (`struct UserId(u64)`), and enums for state machines instead of boolean flags.
- Mark public enums and structs that may grow with `#[non_exhaustive]`, and builder-style or pure functions with `#[must_use]`.
- Derive `Debug` on public types; redact secrets in manual `Debug` impls.
- Avoid `Rc<RefCell<T>>` / `Arc<Mutex<T>>` sprawl; restructure ownership first.
- Use `checked_*`, `saturating_*` or `wrapping_*` arithmetic on untrusted or size-derived values; avoid lossy `as` casts, prefer `TryFrom`.

## Unsafe

- Prefer `#![forbid(unsafe_code)]` in crates that do not need it.
- Every `unsafe` block has a `// SAFETY:` comment proving its invariants, and stays as small as possible behind a safe API. Run Miri on unsafe code when feasible.

## Async

- Use the runtime the project already uses (usually tokio). Never block inside async code: move blocking I/O or CPU work to `spawn_blocking` or a dedicated thread.
- Do not hold a `std::sync::Mutex` guard across `.await`; scope it, or use `tokio::sync::Mutex` when the lock must span an await.
- Every spawned task has an owner (`JoinSet`, stored `JoinHandle`) and a cancellation path. Add timeouts to network calls.

## Style and tests

- `///` docs on all public items, with `# Errors` and `# Panics` sections where relevant; doctests must compile.
- Unit tests in `#[cfg(test)] mod tests` next to the code; integration tests in `tests/`.
- Use `proptest` or `quickcheck` for parsers and invariants when the project has them.
- Run one test with `cargo test name_substring -- --nocapture`.
