---
name: cpp-modern
disable-model-invocation: true
description: >-
  Writes and reviews modern C++20/23: RAII and the rule of zero, unique_ptr
  versus shared_ptr, move semantics and noexcept, string_view and span
  lifetimes, ranges, concepts, std::expected, target-based CMake with presets,
  warnings as errors, clang-tidy and ASan/UBSan/TSan builds. Use when writing,
  modernizing, reviewing or debugging C++ code, CMake builds or memory and
  lifetime bugs.
---

# Modern C++

Write C++ where ownership is visible in types, resources clean themselves up,
and the build catches lifetime and undefined-behaviour bugs before users do.
Most C++ crashes are ownership bugs; fix the ownership model, not the symptom.

## When to use

- Writing or extending a C++17/20/23 library, service, tool or engine module.
- Replacing raw `new`/`delete`, manual cleanup or C-style arrays with RAII types.
- Setting up or untangling CMake: targets, presets, dependencies, warnings.
- Crashes, leaks, dangling references or "works in Debug, breaks in Release".

## When not to use

- Test frameworks, fuzzing and coverage: use `cpp-testing`.
- Plain C or kernel-style code with POSIX APIs: use `c-systems-programming`.
- Build is red and you just need it green: run `/build-fix` or delegate to the `cpp-build-resolver` agent.
- Compiling to the browser or WASI: use `webassembly`.

## Workflow

1. **Read the build contract first.** Find the standard, compilers and dependency manager before writing code.

   ```bash
   cmake --version
   grep -rn "CMAKE_CXX_STANDARD\|cxx_std_\|target_compile_features" --include=CMakeLists.txt .
   ls CMakePresets.json vcpkg.json conanfile.* 2>/dev/null     # PowerShell: Get-ChildItem CMakePresets.json, vcpkg.json -ErrorAction SilentlyContinue
   ```

   **Check:** You can state the C++ standard, the supported compilers (GCC, Clang, MSVC) and how dependencies arrive (vcpkg, Conan, FetchContent, system).

2. **Configure an out-of-source build with diagnostics on.** Generate `compile_commands.json` so clang-tidy and editors see real flags.

   ```bash
   cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Debug -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
   cmake --build build
   ctest --test-dir build --output-on-failure
   ```

   If `CMakePresets.json` exists, use `cmake --preset <name>` instead. **Check:** A clean configure and build succeed before your change, or the existing errors are recorded.

3. **Design ownership before code.** Pick the owning type per resource (table below). Default to values and `std::unique_ptr`; reach for `std::shared_ptr` only when lifetime is genuinely shared and unknowable. Non-owning parameters are `T&`, `const T&`, `T*` (nullable), `std::string_view` or `std::span<T>`.

   **Check:** No raw `new`/`delete` in new code; `grep_search` for `new ` and `delete ` returns only placement-new or justified cases.

4. **Apply the rule of zero.** Let members manage resources so the class needs no destructor, copy or move operations. When you must write one special member, write or `= delete` all five, and mark move operations `noexcept` so `std::vector` moves instead of copying on reallocation.

   **Check:** Every user-written destructor has matching copy/move decisions, and move constructors are `noexcept`.

5. **Constrain templates with concepts and prefer ranges.** Replace SFINAE with `requires` clauses or standard concepts (`std::integral`, `std::ranges::range`). Use `std::ranges::` algorithms and views for clarity, but materialize results before the source goes out of scope.

   **Check:** Template errors point at the violated concept, not 200 lines of instantiation.

6. **Build with warnings as errors and sanitizers.** Add a sanitizer preset or build directory and run the tests under it. AddressSanitizer and ThreadSanitizer cannot be combined; run them as separate builds.

   ```bash
   cmake -S . -B build-asan -G Ninja -DCMAKE_BUILD_TYPE=Debug \
     -DCMAKE_CXX_FLAGS="-fsanitize=address,undefined -fno-omit-frame-pointer"
   cmake --build build-asan && ctest --test-dir build-asan --output-on-failure
   clang-tidy -p build src/*.cpp          # uses compile_commands.json
   ```

   MSVC: `/W4 /permissive- /WX`, and `/fsanitize=address` for ASan. **Check:** Tests pass clean under ASan+UBSan, and under TSan for anything multithreaded.

7. **Hand off review.** For non-trivial diffs, delegate to the `cpp-reviewer` agent with the diff, the target standard and the ownership decisions from step 3.

## Patterns

### Ownership cheat sheet

| Situation | Type |
| :--- | :--- |
| Single owner, heap needed (polymorphism, large, pimpl) | `std::unique_ptr<T>` via `std::make_unique` |
| Truly shared lifetime (graph nodes, async callbacks) | `std::shared_ptr<T>` via `std::make_shared`; break cycles with `std::weak_ptr` |
| Optional value | `std::optional<T>` (not a pointer) |
| Borrowed string or buffer | `std::string_view`, `std::span<const T>`; never store them past the call |
| OS handle, lock, file | A small RAII class, or `unique_ptr` with a custom deleter |
| Fallible result without exceptions | `std::expected<T, E>` (C++23; check library support) |

### Target-based CMake

```cmake
cmake_minimum_required(VERSION 3.24)
project(app LANGUAGES CXX)

add_library(core src/core.cpp)
target_compile_features(core PUBLIC cxx_std_20)
target_include_directories(core PUBLIC include)
if(MSVC)
  target_compile_options(core PRIVATE /W4 /permissive- /WX)
else()
  target_compile_options(core PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Werror)
endif()

add_executable(app src/main.cpp)
target_link_libraries(app PRIVATE core)
```

Never set global `CMAKE_CXX_FLAGS` in project files for warnings; options on
targets propagate correctly and do not leak into dependencies.

### Moves and lifetimes

```cpp
class Buffer {
 public:
  explicit Buffer(std::size_t n) : data_(std::make_unique<std::byte[]>(n)), size_(n) {}
  // rule of zero: unique_ptr gives correct, noexcept moves and deleted copies
  std::span<const std::byte> view() const noexcept { return {data_.get(), size_}; }
 private:
  std::unique_ptr<std::byte[]> data_;
  std::size_t size_;
};

std::string_view bad() { std::string s = "temp"; return s; }  // dangling: s dies here
```

- `std::move` is only a cast; the moved-from object is valid but unspecified.
- Do not write `return std::move(local);` because it blocks copy elision.
- Lambdas that capture `this` or references and outlive the scope dangle; capture by value or `shared_from_this()`.
- Range views are lazy and borrow from lvalues: a view over a local container must not be returned or stored past that container's life. Range algorithms called on temporaries return `std::ranges::dangling` instead of an iterator; treat that compile error as a real bug.

### Feature availability

C++23 library features (`std::expected`, `std::print`, `std::ranges::to`,
`std::flat_map`) and C++20 modules land unevenly across GCC, Clang, MSVC and
their standard libraries. Check the compiler support tables on cppreference
for each feature you plan to use, and test on every compiler in the CI matrix.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `shared_ptr` everywhere "to be safe" | `unique_ptr` or values; share only when lifetime is truly shared | Hidden ownership, atomic refcount cost, cycles that leak |
| Store `string_view`/`span` members from arguments | Store `std::string`/`std::vector`, or document the lifetime contract | Dangling views are silent use-after-free |
| Throwing or non-`noexcept` move constructors | `noexcept` moves (or rule of zero) | Containers fall back to copying, or lose strong guarantees |
| `using namespace std;` in headers | Qualify names or use local `using` | Pollutes every includer and causes ambiguities |
| Global flags via `CMAKE_CXX_FLAGS` | `target_compile_options`, `target_compile_features` | Leaks into third-party code and breaks other toolchains |
| Detached `std::thread` | `std::jthread` with `std::stop_token` | Joins on destruction and supports cooperative stop |
| Ignore UBSan reports because "it works" | Fix the undefined behaviour | Optimizers exploit UB differently per compiler and level |

## Verification checklist

- [ ] Ownership of every heap resource is expressed by a type; no raw owning pointers in new code.
- [ ] Special members follow rule of zero or a complete rule of five, with `noexcept` moves.
- [ ] No views (`string_view`, `span`, range views) outlive the data they borrow.
- [ ] Builds warning-free with warnings as errors on every compiler in the matrix.
- [ ] Tests pass under ASan+UBSan, and TSan for concurrent code; clang-tidy is clean or findings are justified.
- [ ] C++23 features used are confirmed available on all target toolchains.

## Related

- Workflows: `/build-fix`, `/verify`, `/code-review`, `/tdd`.
- Knowledge: `cpp-testing`, `c-systems-programming`, `rust-systems`, `profiling`, `memory-leaks`, `concurrency-bugs`, `static-analysis`, `webassembly`.
- Agents: `cpp-reviewer`, `cpp-build-resolver`, `performance-optimizer`.
