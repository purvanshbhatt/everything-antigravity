---
trigger: glob
globs: "**/*.c, **/*.cc, **/*.cpp, **/*.h, **/*.hpp"
description: C and C++ conventions
---

# C and C++

## Build and tooling

- Use the project's build (CMake, Meson, Bazel, Make). In CMake, use target-scoped commands (`target_link_libraries`, `target_compile_options`, `target_include_directories`), never global `include_directories` or `link_libraries`.
- Respect the configured standard (`CMAKE_CXX_STANDARD`, `-std=`). Do not raise it as a side effect.
- Compile with high warnings and treat them as errors where configured: `-Wall -Wextra -Wpedantic -Werror` (GCC/Clang) or `/W4 /WX` (MSVC). Format with `clang-format` and lint with `clang-tidy` when present.
- Run tests under AddressSanitizer and UndefinedBehaviorSanitizer (`-fsanitize=address,undefined`) in debug or CI; use ThreadSanitizer for concurrent code.

## Memory and ownership (C++)

- RAII for every resource. No raw owning `new`/`delete`; use `std::make_unique`, `std::make_shared` only when ownership is truly shared, and containers.
- Raw pointers and references are non-owning. Prefer `std::span` and `std::string_view` for views, and never let a view outlive its owner.
- Follow the rule of zero; if you must define one of copy/move/destructor, define or delete all five.
- No C-style casts. Use `static_cast`; `reinterpret_cast` and `const_cast` need a comment.

## Correctness (C++)

- `const` by default: parameters, member functions, locals. `constexpr` where possible. `enum class` over plain `enum`.
- Mark overrides `override`, leaf classes `final`, and functions whose result must be used `[[nodiscard]]`.
- Signed overflow is undefined behaviour: validate sizes, use `std::size_t` consistently and avoid mixing signed/unsigned comparisons.
- Bounds-check at trust boundaries (`.at()` or explicit checks). Avoid `operator[]` on untrusted indexes.
- Concurrency: guard shared state with `std::mutex` plus `std::scoped_lock` / `std::lock_guard`; use `std::atomic` for simple flags; prefer `std::jthread` (C++20) so threads join on destruction. Never detach threads that touch shared state.
- Exceptions or error codes: follow the codebase. With `std::expected` (C++23) or error codes, never ignore a returned error.

## C

- Check every return value: `malloc`, `fopen`, `read`, `write`, `snprintf`.
- No `gets`, `strcpy`, `strcat` or `sprintf`; use `snprintf` and explicit length tracking. Always NUL-terminate.
- Allocate with `p = malloc(n * sizeof *p)` after checking `n` for overflow; free exactly once and set the pointer to `NULL`.
- Use `static` for file-local functions and globals; minimize mutable globals.

## Headers

- Use include guards or `#pragma once` consistently with the project.
- Include what you use; no `using namespace` in headers.
- Keep implementation details out of public headers (pimpl or internal headers).

## Security

- Treat all external input (files, network, argv, env) as hostile: validate lengths before copying, and never pass untrusted data as a format string (`printf(user)`).
- Never call `system()` or `popen()` with interpolated input.

## Tests

- GoogleTest or Catch2 per the project, registered with `ctest`. Run one test: `ctest -R <name> --output-on-failure`.
