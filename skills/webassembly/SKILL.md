---
name: webassembly
disable-model-invocation: true
description: >-
  Builds and integrates WebAssembly: deciding when wasm beats JavaScript,
  compiling Rust with wasm-bindgen or wasm-pack and C/C++ with Emscripten or
  wasi-sdk, designing a narrow JS boundary, WASI targets and runtimes such as
  wasmtime, the component model and WIT, size and speed tuning (wasm-opt,
  SIMD, threads with cross-origin isolation), testing and debugging. Use when
  compiling code to wasm for browsers, servers, plugins or edge runtimes.
---

# WebAssembly

WebAssembly runs compiled code in a sandbox at near-native speed, but every
call across the JS or host boundary costs copying and conversion. Use it for
compute-heavy kernels, existing native libraries and portable plugins, and
design a narrow, batch-oriented interface around it.

## When to use

- Moving CPU-heavy work (codecs, parsers, simulation, crypto, image processing) into the browser or an edge runtime.
- Reusing an existing Rust, C or C++ library from JavaScript.
- Running sandboxed plugins or untrusted code on a server with WASI.
- Shrinking bundle size or improving startup of an existing wasm module.

## When not to use

- DOM-heavy UI code or small utilities: plain TypeScript is simpler and often faster.
- Native Rust application design: use `rust-systems`; C++ design: use `cpp-modern`.
- Browser performance work in general: use `web-performance` or `/perf-audit`.
- Shader and GPU work: use `shaders-glsl` or `threejs-webgl`.

## Workflow

1. **Justify wasm with a measurement.** Benchmark the hot path in JavaScript first and estimate how often it would cross the boundary. Proceed when the work per call is large (milliseconds, not microseconds) or a native library has no JS equivalent.

   **Check:** You have a baseline number and a target, written in the implementation plan artifact.

2. **Pick the toolchain and target.**

   | Source | Browser or bundler | Server, CLI, plugin (WASI) |
   | :--- | :--- | :--- |
   | Rust | `wasm32-unknown-unknown` with wasm-bindgen (directly or via wasm-pack) | `wasm32-wasip1` or `wasm32-wasip2` (component) |
   | C/C++ | Emscripten (`emcc`), which also emits JS glue | wasi-sdk (Clang with a WASI sysroot) |
   | Others | Go, AssemblyScript, Kotlin/Wasm, .NET: check each project's docs | Same |

   Target names, tool maintenance status and component-model tooling change quickly; check `rustup target list` and each tool's current docs. **Check:** `rustup target list --installed` (or `emcc --version`) shows the chosen target.

3. **Design a narrow boundary.** Expose a few coarse functions that take and return buffers, numbers or simple structs. Keep state inside wasm behind a handle object instead of passing large graphs back and forth. Strings cost an encode and copy each way.

   **Check:** The hot path makes one or a few boundary calls per batch, not one per element.

4. **Build.**

   ```bash
   # Rust for the browser
   rustup target add wasm32-unknown-unknown
   wasm-pack build --release --target web            # or: --target bundler | nodejs
   # Without wasm-pack: cargo build --release --target wasm32-unknown-unknown, then
   # wasm-bindgen target/wasm32-unknown-unknown/release/app.wasm --out-dir pkg --target web

   # C/C++ for the browser
   emcc src/lib.c -O3 -sEXPORTED_FUNCTIONS=_process,_malloc,_free \
     -sEXPORTED_RUNTIME_METHODS=ccall,cwrap -sMODULARIZE -sEXPORT_ES6 -o dist/lib.js

   # Rust for WASI
   rustup target add wasm32-wasip1
   cargo build --release --target wasm32-wasip1
   wasmtime run --dir=./data target/wasm32-wasip1/release/app.wasm
   ```

   PowerShell: put multi-line commands on one line, or end lines with a backtick. **Check:** The module loads in its host and returns a correct result for a known input.

5. **Optimize size, then speed.** Apply the release profile below, run `wasm-opt`, and inspect what remains.

   ```bash
   wasm-opt -Oz pkg/app_bg.wasm -o pkg/app_bg.wasm   # Binaryen; wasm-pack may already run it
   twiggy top -n 20 pkg/app_bg.wasm                  # largest functions and data
   ```

   Enable SIMD with `RUSTFLAGS="-C target-feature=+simd128"` (PowerShell: `$env:RUSTFLAGS = "-C target-feature=+simd128"`) only when every target runtime supports it. **Check:** Size and benchmark numbers beat the step 1 baseline; record both.

6. **Serve it correctly.** Serve `.wasm` as `application/wasm` so `WebAssembly.instantiateStreaming` works, compress with Brotli or gzip, and cache with content-hashed names. Threads need `SharedArrayBuffer`, which requires cross-origin isolation (`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`).

   **Check:** DevTools shows the module streamed with the right MIME type, and `crossOriginIsolated` is `true` if threads are used.

7. **Test on both sides of the boundary.** Unit test pure logic natively (`cargo test`), test the bindings in the real host (`wasm-pack test --headless --chrome` or `--node` with `wasm-bindgen-test`), and add an end-to-end check in the app.

   **Check:** Native tests, wasm tests and one browser or runtime integration test pass in CI.

## Patterns

### Rust with wasm-bindgen: coarse calls, state behind a handle

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Histogram { bins: Vec<u32> }

#[wasm_bindgen]
impl Histogram {
    #[wasm_bindgen(constructor)]
    pub fn new(bins: usize) -> Histogram { Histogram { bins: vec![0; bins] } }

    /// One call per frame: JS passes a whole Uint8Array, not one pixel at a time.
    pub fn add_frame(&mut self, pixels: &[u8]) {
        let n = self.bins.len();
        for &p in pixels { self.bins[(p as usize * n) / 256] += 1; }
    }

    pub fn bins(&self) -> Vec<u32> { self.bins.clone() }   // copied once into a Uint32Array
}
```

```js
import init, { Histogram } from "./pkg/app.js";
await init();
const h = new Histogram(16);
h.add_frame(new Uint8Array(imageData.data.buffer));   // one copy into linear memory per frame
console.log(h.bins());
h.free();                       // release wasm memory owned by the handle
```

Add the `console_error_panic_hook` crate in debug builds so Rust panics show
readable messages in the browser console.

### Release profile for small modules

```toml
[profile.release]
opt-level = "z"        # or "s"; benchmark "3" if speed matters more than size
lto = true
codegen-units = 1
panic = "abort"
strip = true
```

### Limits to plan around

| Limit | Implication |
| :--- | :--- |
| No direct DOM or OS access | Everything goes through imported host functions (JS glue or WASI) |
| wasm32 linear memory is at most 4 GiB and never shrinks | Stream large data; reuse buffers; memory64 support varies by runtime |
| Boundary crossings copy strings and complex values | Batch work; pass typed-array views into linear memory |
| Threads need cross-origin isolation in browsers | Headers may break third-party embeds; plan before adopting |
| Memory bugs in C/C++ still corrupt the module's own memory | The sandbox protects the host, not your data; keep sanitizers in native tests |
| Debugging | DWARF debug info works in Chrome DevTools with the C/C++ debugging extension; keep a native build for profiling |

### Component model and WASI 0.2

Components describe their imports and exports in WIT and can be composed
across languages. Typical tools: `wit-bindgen` for bindings, `wasm-tools`
for inspecting and building components, `wasmtime` to run them, and `jco` to
run components in JavaScript. This area changes fast; check the Bytecode
Alliance docs for the current toolchain before choosing it for production.
For untrusted plugins, grant only needed directories and use the runtime's
fuel or epoch interruption and memory limits.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Port a whole app to wasm for speed | Move only measured hot kernels | Boundary overhead can make the result slower |
| Call wasm once per array element | Pass whole buffers and batch | Each crossing has fixed cost |
| Ship debug builds | Release profile plus `wasm-opt` | Debug modules are many times larger and slower |
| Forget to free wasm-bindgen handles | Call `.free()` or use explicit lifetimes in JS | Linear memory leaks and never shrinks |
| Serve `.wasm` as `application/octet-stream` | `application/wasm` | Streaming compilation fails and falls back slowly |
| Give WASI plugins the whole filesystem | Preopen only required directories | Capability-based security is the point of WASI |

## Verification checklist

- [ ] A baseline measurement justified wasm, and the result beats it.
- [ ] The boundary is coarse-grained; hot paths do not cross per element.
- [ ] Release profile, `wasm-opt` and size inspection were applied; size is recorded.
- [ ] The module is served as `application/wasm`, compressed and cached; isolation headers are set if threads are used.
- [ ] Native, wasm and integration tests pass in CI.
- [ ] Untrusted modules run with minimal capabilities and resource limits.

## Related

- Workflows: `/perf-audit`, `/build-fix`, `/verify`.
- Knowledge: `rust-systems`, `cpp-modern`, `c-systems-programming`, `web-performance`, `bun-deno`, `cdn-edge-cloudflare`, `profiling`.
- Agents: `performance-optimizer`, `rust-reviewer`, `cpp-reviewer`.
