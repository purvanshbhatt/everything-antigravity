---
name: rust-systems
description: >-
  Builds and reviews Rust services and CLIs: ownership patterns that avoid
  fighting the borrow checker, thiserror versus anyhow, tokio async (spawn,
  select!, cancellation, blocking work), axum, serde, unit, integration and
  proptest tests, clippy lint policy, unsafe policy, cargo features, release
  profiles and cross-compilation. Use when writing, reviewing or debugging a
  Rust crate, service or command-line tool.
---

# Rust Services and CLIs

Write Rust that compiles on the first or second try by choosing ownership
shapes up front, keeps errors typed in libraries and contextual in binaries,
and never blocks the async runtime. Most borrow-checker fights are design
problems: change the data shape, not the lifetimes.

## When to use

- Creating or extending a Rust binary, library, axum service or CLI.
- Borrow-checker errors that resist local fixes, or `Send`/`'static` errors from `tokio::spawn`.
- Async services that stall, leak tasks or ignore shutdown.
- Setting lint policy, features, release profiles or cross-compilation targets.
- Reviewing `unsafe` code or deciding whether it is needed.

## When not to use

- API contract design: use `api-design`. Container builds: use `docker-containers`.
- Game engines and real-time rendering: use `game-architecture` or `threejs-webgl`.
- Performance profiling methodology across stacks: use `web-performance` (then `cargo flamegraph` here).
- A second opinion on a diff: delegate to the `code-reviewer` agent with the Rust checklist from this skill.

## Workflow

1. **Read the crate's settings first.** Check `Cargo.toml` (`edition`, `rust-version`, `[features]`, `[lints]`, `[profile.*]`), `rust-toolchain.toml`, and whether it is a workspace.

   ```bash
   rustc --version && cargo --version
   cargo tree --depth 1          # direct dependencies and their versions
   cargo check --all-targets
   ```

   **Check:** `cargo check --all-targets` passes before your change, or you have recorded the existing errors.

2. **Choose data shapes that the borrow checker likes.** Long-lived structs own their data (`String`, `Vec<T>`, `Arc<T>`); functions borrow (`&str`, `&[T]`, `impl AsRef<Path>`) and return owned values. Share immutable state with `Arc<T>`, and mutable state with `Arc<Mutex<T>>` held briefly. Replace reference graphs with IDs into a `Vec` or a slotmap. See the ownership table below.

   **Check:** New public types have no lifetime parameters unless they are short-lived views (parsers, iterators).

3. **Model errors per crate type.** Libraries define `thiserror` enums that callers can match. Binaries and application glue use `anyhow::Result` with `.context("...")` at each I/O boundary. Service handlers map domain errors to responses in one `IntoResponse` implementation. `unwrap()` is for tests; elsewhere, use `expect("why this can't fail")` only for real invariants.

   **Check:** `grep_search` for `unwrap()` outside tests; each remaining one is justified or replaced.

4. **Keep the runtime unblocked and every task owned.** Use `spawn_blocking` for blocking I/O or CPU work, `JoinSet` or `TaskTracker` for groups of tasks, `CancellationToken` for shutdown, and `tokio::time::timeout` around external calls. Know which futures are cancel-safe before putting them in `select!`. Details: [tokio and axum](references/async-tokio.md).

   **Check:** On Ctrl+C the service stops accepting work, finishes or cancels in-flight tasks, and exits before its deadline.

5. **Validate at the serde boundary.** Derive `Deserialize` on input DTOs with `#[serde(deny_unknown_fields)]`, convert to domain types with `TryFrom`, and keep domain types free of invalid states (newtypes such as `Email(String)` with a checked constructor).

   **Check:** A test shows unknown fields and invalid values are rejected with a clear error.

6. **Test at three levels.** Unit tests in `#[cfg(test)] mod tests`, integration tests in `tests/` against the public API (or the axum `Router` via `tower::ServiceExt::oneshot`), and `proptest` for parsers, encoders and invariants.

   ```bash
   cargo test --all-features
   cargo nextest run        # if the project uses cargo-nextest
   ```

   **Check:** New behaviour has a test that failed before the change, and property tests cover round trips or invariants.

7. **Run the gates.**

   ```bash
   cargo fmt --all --check
   cargo clippy --all-targets --all-features -- -D warnings
   cargo test --all-features
   cargo deny check          # or: cargo audit (RustSec advisories)
   ```

   **Check:** All gates pass. Advisories are fixed by upgrading, or explicitly accepted by the user with a reason in `deny.toml`.

## Patterns

### Ownership moves that end most fights

| Symptom | Move |
| :--- | :--- |
| "borrowed value does not live long enough" in a struct | Own the data (`String`, not `&str`), or use `Arc<str>` for cheap clones |
| Mutating one field while another is borrowed | Destructure (`let Self { a, b, .. } = self;`) to split the borrows |
| Need to move a value out of `&mut self` | `std::mem::take`, `std::mem::replace` or `Option::take` |
| Insert-or-update in a map | The entry API: `map.entry(k).or_default().push(v)` |
| Parent and child point at each other | Store IDs or indices into a `Vec` or slotmap; use `Weak` only when you must |
| Sometimes borrowed, sometimes owned | `Cow<'a, str>` |
| `tokio::spawn` needs `'static` | Move owned data in (`async move`), clone an `Arc` before spawning |
| Future is not `Send` | Don't hold a `std::sync::MutexGuard` or `Rc` across `.await`; scope the guard in a block |

Cloning an `Arc` or a small `String` at a boundary is fine. Profile before
adding lifetimes to save a clone.

### Errors

```rust
// library crate
#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("user {0} not found")]
    NotFound(u64),
    #[error("database error")]
    Db(#[from] sqlx::Error),
}

// binary crate
use anyhow::{Context, Result};

fn load_config(path: &std::path::Path) -> Result<Config> {
    let text = std::fs::read_to_string(path)
        .with_context(|| format!("reading config {}", path.display()))?;
    toml::from_str(&text).context("parsing config")
}
```

### Lint and unsafe policy in Cargo.toml

```toml
[lints.rust]
unsafe_code = "forbid"          # relax to "deny" plus targeted allows only in a dedicated module

[lints.clippy]
pedantic = { level = "warn", priority = -1 }
missing_errors_doc = "allow"
missing_panics_doc = "allow"
must_use_candidate = "allow"
```

Pedantic lints are opinionated; allow the noisy ones explicitly so the rest
stay useful. Lint names and group membership change between toolchains, so run
`cargo clippy` and adjust. In workspaces, put the table under
`[workspace.lints]` and add `lints.workspace = true` to each member.

When `unsafe` is genuinely required (FFI, a measured hot path): isolate it in
one small module with a safe API, write a `// SAFETY:` comment on every block
explaining why the invariants hold, test it under Miri
(`cargo +nightly miri test`), and get a second reviewer. Edition 2024 makes
some previously safe operations `unsafe`, such as `std::env::set_var`.

### Features

Features must be additive: enabling one may never remove behaviour or break
another. Use `dep:` syntax for optional dependencies, keep `default` small,
and test combinations with `cargo hack --feature-powerset check` (cargo-hack)
for libraries. Inspect what is actually enabled with `cargo tree -e features`
and find duplicate versions with `cargo tree -d`.

### Release builds and cross-compilation

Profile settings and cross-compilation recipes are in [build and release](references/build-and-release.md).

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Add lifetimes until it compiles | Change ownership: own, share with `Arc`, or use IDs | Lifetime-heavy APIs spread through every caller |
| `std::thread::sleep` or blocking I/O in async code | `tokio::time::sleep`, async I/O, or `spawn_blocking` | Stalls every task on that worker thread |
| Hold a `std::sync::Mutex` guard across `.await` | Scope the guard, or use `tokio::sync::Mutex` when you must hold it across awaits | Non-`Send` futures and deadlocks |
| Unbounded channels between tasks | Bounded `mpsc::channel(n)` | Backpressure instead of memory growth |
| `Box<dyn Error>` in library APIs | `thiserror` enums | Callers can't match on causes |
| Fire-and-forget `tokio::spawn` | `JoinSet` or `TaskTracker`, and handle `JoinError` | Panics and errors vanish; shutdown can't wait |
| Mutually exclusive cargo features | Separate crates or runtime config | Feature unification breaks downstream builds |

## Verification checklist

- [ ] Public types own their data unless they are deliberate short-lived views.
- [ ] Libraries expose typed errors; binaries add context at I/O boundaries.
- [ ] No blocking calls in async paths; every spawned task is tracked and cancellable.
- [ ] Input DTOs reject unknown fields and convert into validated domain types.
- [ ] `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test` and `cargo deny`/`cargo audit` pass.
- [ ] Any `unsafe` is isolated, has `SAFETY` comments, and was tested under Miri.

## Related

- Workflows: `/tdd`, `/feature-dev`, `/verify`, `/build-fix`, `/code-review`.
- Knowledge: `api-design`, `backend-patterns`, `docker-containers`, `ci-cd-github-actions`, `observability-otel`, `tdd-testing`, `security-audit`.
- Agents: `code-reviewer`, `build-error-resolver`, `test-engineer`, `performance-optimizer`.
