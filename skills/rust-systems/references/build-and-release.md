# Rust build, release and cross-compilation

## Release profiles

```toml
[profile.release]
lto = "thin"          # "fat" squeezes a little more at a large build-time cost
codegen-units = 1     # better optimisation, slower builds
strip = true          # smaller binaries; keep symbols in a separate profile for profiling

[profile.profiling]   # cargo build --profile profiling
inherits = "release"
debug = true
strip = false
```

- `panic = "abort"` shrinks binaries and speeds up panics, but in a tokio service a panic in any task then kills the whole process instead of being reported through `JoinError`. Use it for CLIs, and only deliberately for services.
- For minimum size (CLIs, embedded), try `opt-level = "z"` or `"s"` and measure with `cargo bloat` (cargo-bloat).
- Build in CI with `--locked` so the committed `Cargo.lock` is used as-is.

## Supply chain and policy

```bash
cargo deny init            # creates deny.toml (advisories, bans, licenses, sources)
cargo deny check
cargo audit                # RustSec advisories, if cargo-deny isn't used
cargo update -p <crate>    # targeted upgrade of one dependency
```

Set `rust-version` (MSRV) in `Cargo.toml` and check it in CI with
`cargo +<msrv> check --locked`.

## Cross-compilation options

| Goal | Approach | Command |
| :--- | :--- | :--- |
| Static Linux binary (pure Rust deps) | musl target | `rustup target add x86_64-unknown-linux-musl` then `cargo build --release --target x86_64-unknown-linux-musl` |
| Linux arm64 or other targets with C deps | cross-rs (needs Docker or Podman) | `cross build --release --target aarch64-unknown-linux-gnu` |
| Target an older glibc without containers | cargo-zigbuild (needs Zig) | `cargo zigbuild --release --target aarch64-unknown-linux-gnu.2.17` |
| macOS universal binary | Build both Apple targets, then merge | `lipo -create -output app target/aarch64-apple-darwin/release/app target/x86_64-apple-darwin/release/app` |

Notes:

- C dependencies (OpenSSL above all) are the usual cross-compilation blocker. Prefer pure-Rust TLS (rustls) through each crate's feature flags; feature names differ per crate, so check its docs.
- musl's default allocator is slow under heavy allocation; benchmark, and consider a different global allocator if it matters.
- On Windows the default toolchain is MSVC (`x86_64-pc-windows-msvc`), which needs the Visual Studio Build Tools.

## Container image

```dockerfile
FROM rust:<pinned-version> AS build
WORKDIR /src
COPY . .
RUN cargo build --release --locked

FROM gcr.io/distroless/cc-debian12
COPY --from=build /src/target/release/app /app
USER nonroot
ENTRYPOINT ["/app"]
```

- Use the `cc` distroless variant for glibc-linked binaries, and `static` or `scratch` for fully static musl builds.
- cargo-chef caches dependency builds in their own layer; use it when image builds are slow.
- Pin the Rust image to the toolchain in `rust-toolchain.toml`.

## CI gate order

```bash
cargo fmt --all --check
cargo clippy --all-targets --all-features --locked -- -D warnings
cargo test --all-features --locked
cargo deny check
cargo build --release --locked
```

For libraries with features, add `cargo hack --feature-powerset check` (or
`--each-feature` when the powerset is too large).
