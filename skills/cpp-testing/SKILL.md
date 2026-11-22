---
name: cpp-testing
description: >-
  Sets up and writes C and C++ tests with GoogleTest/gMock or Catch2 under
  CMake and CTest: fixtures, parameterized tests, mocking seams, death tests,
  libFuzzer fuzz targets with sanitizers, gcov/llvm-cov coverage, flaky-test
  repetition and a compiler-by-sanitizer CI matrix. Use when adding tests to a
  C++ codebase, choosing a framework, writing a fuzzer, measuring coverage or
  stabilizing C++ CI.
---

# C++ Testing

Make C++ tests fast to write, discovered automatically by CTest, and run under
sanitizers in CI, so memory bugs fail a test instead of a customer. Add fuzzing
wherever untrusted bytes are parsed.

## When to use

- A C or C++ project has no tests, or tests are not wired into CTest.
- Choosing between GoogleTest and Catch2, or adding mocks with gMock.
- Parsers, decoders or protocol handlers that need fuzzing.
- Coverage reports, flaky tests, or a CI matrix across compilers and sanitizers.

## When not to use

- Language-level design, ownership and CMake structure: use `cpp-modern`.
- General test strategy and TDD rhythm: use `tdd-testing` or run `/tdd`.
- Investigating a crash found in production: run `/root-cause` first, then add the regression test here.
- Load or throughput testing of a service: use `load-testing`.

## Workflow

1. **Detect what exists.** Look for a framework before adding one.

   ```bash
   grep -rn "gtest\|GTest::\|Catch2\|doctest\|enable_testing\|add_test" --include=CMakeLists.txt --include=*.cmake .
   ctest --test-dir build -N            # lists registered tests without running them
   ```

   **Check:** You know the framework (or that there is none) and how tests are registered.

2. **Pick a framework and wire it into CMake.** Keep an existing framework. For new projects: GoogleTest when you need gMock and death tests, Catch2 v3 for BDD-style sections and lighter syntax. Pin the dependency to a release tag or commit through FetchContent, vcpkg or Conan.

   ```cmake
   include(FetchContent)
   FetchContent_Declare(googletest
     GIT_REPOSITORY https://github.com/google/googletest.git
     GIT_TAG        <release-tag-or-commit>)   # pin; check the current release
   set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)   # MSVC runtime match
   FetchContent_MakeAvailable(googletest)

   enable_testing()
   add_executable(core_tests tests/parser_test.cpp)
   target_link_libraries(core_tests PRIVATE core GTest::gtest_main GTest::gmock)
   include(GoogleTest)
   gtest_discover_tests(core_tests)
   ```

   Catch2 v3: link `Catch2::Catch2WithMain`, then `include(Catch)` and `catch_discover_tests(core_tests)`. **Check:** `ctest --test-dir build -N` lists individual test cases, not one opaque executable.

3. **Create seams before writing mocks.** Code that calls the clock, filesystem, network or randomness directly cannot be unit tested. Introduce a small interface (virtual) or a template parameter at that boundary, and inject it. Mock only the boundaries you own; wrap third-party APIs first.

   **Check:** The unit under test can be constructed in a test with no network, disk or real time.

4. **Write tests: one behaviour each, named for the behaviour.** Use fixtures for shared setup, parameterized tests for tables of inputs, and `ASSERT_*` only where continuing would crash.

   **Check:** Each new test fails when the behaviour it names is broken (flip a condition and rerun).

5. **Fuzz untrusted input.** Add a libFuzzer target for each parser or decoder, build it with Clang and sanitizers, seed it with real samples, and commit crashing inputs as regression tests.

   ```bash
   clang++ -g -O1 -fsanitize=fuzzer,address,undefined fuzz/parse_fuzz.cpp src/parser.cpp -Iinclude -o parse_fuzz
   mkdir -p corpus && cp samples/* corpus/
   ./parse_fuzz corpus/ -max_total_time=300
   ./parse_fuzz crash-<hash>               # reproduce a finding
   ```

   libFuzzer requires Clang; MSVC has its own `/fsanitize=fuzzer` support (check current docs). **Check:** The fuzzer runs for the time budget without new crashes, and every past crash has a test.

6. **Measure coverage, then read it.** Use coverage to find untested branches in changed code, not as a target to game.

   ```bash
   # GCC: build with --coverage, run tests, then
   gcovr -r . --html-details -o coverage.html
   # Clang: build with -fprofile-instr-generate -fcoverage-mapping
   LLVM_PROFILE_FILE="cov-%p.profraw" ctest --test-dir build
   llvm-profdata merge -sparse cov-*.profraw -o cov.profdata
   llvm-cov report ./build/core_tests -instr-profile=cov.profdata
   ```

   PowerShell: `$env:LLVM_PROFILE_FILE = "cov-%p.profraw"` before `ctest`. **Check:** Every new branch in the diff is either covered or listed as intentionally untested.

7. **Run in a CI matrix.** At minimum: GCC and Clang on Linux, MSVC on Windows, plus one ASan+UBSan job and one TSan job if the code is concurrent. Run `ctest --output-on-failure -j` with a timeout.

   **Check:** The matrix is green, and a deliberately broken test turns it red.

## Patterns

### GoogleTest with gMock

```cpp
struct Clock { virtual ~Clock() = default; virtual std::int64_t now_ms() const = 0; };
struct MockClock : Clock { MOCK_METHOD(std::int64_t, now_ms, (), (const, override)); };

class TokenTest : public ::testing::Test {
 protected:
  ::testing::NiceMock<MockClock> clock;
};

TEST_F(TokenTest, ExpiredTokenIsRejected) {
  EXPECT_CALL(clock, now_ms()).WillRepeatedly(::testing::Return(10'000));
  Token t{"abc", /*expires_ms=*/5'000};
  EXPECT_FALSE(t.valid(clock));
}

class ParseInt : public ::testing::TestWithParam<std::pair<std::string, int>> {};
TEST_P(ParseInt, ParsesDecimal) {
  auto [in, want] = GetParam();
  EXPECT_EQ(parse_int(in), want);
}
INSTANTIATE_TEST_SUITE_P(Table, ParseInt, ::testing::Values(
    std::pair{"0", 0}, std::pair{"42", 42}, std::pair{"-7", -7}));
```

Use `StrictMock` only when unexpected calls are the behaviour under test;
otherwise it produces brittle tests. `EXPECT_DEATH(fn(), "regex")` checks
aborts and assertions.

### Catch2 v3

```cpp
#include <catch2/catch_test_macros.hpp>
TEST_CASE("ring buffer wraps", "[buffer]") {
  Ring<int, 2> r;
  r.push(1); r.push(2); r.push(3);
  SECTION("oldest value is dropped") { REQUIRE(r.front() == 2); }
  SECTION("size stays at capacity")  { CHECK(r.size() == 2); }
}
```

### Fuzz target

```cpp
extern "C" int LLVMFuzzerTestOneInput(const std::uint8_t* data, std::size_t size) {
  std::string_view input(reinterpret_cast<const char*>(data), size);
  (void)parse_message(input);  // must not crash, leak or hit UB for any input
  return 0;
}
```

### Hunting flaky tests

| Tool | Command |
| :--- | :--- |
| Repeat via CTest | `ctest --test-dir build -R Token --repeat until-fail:200` |
| Repeat and shuffle (GoogleTest) | `./core_tests --gtest_filter=TokenTest.* --gtest_repeat=200 --gtest_shuffle` |
| Order dependence (Catch2) | `./core_tests --order rand` |
| Data races | Rerun the flaky test in the TSan build |

Flakes usually come from real time, shared global state, test order or
threads. Fix the cause; never add retries to hide them.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| One `TEST` per file that checks twenty things | One behaviour per test with a descriptive name | Failures point at the broken behaviour immediately |
| Mock classes you don't own | Wrap them behind your own interface and mock that | Third-party API changes break every mock |
| `sleep` in tests to wait for threads | Inject clocks, use latches or condition variables with timeouts | Sleeps are slow and still flaky |
| Run tests only in Debug without sanitizers | Add ASan+UBSan and TSan jobs | Memory bugs pass silently in plain builds |
| Throw away fuzzer crash files | Commit them as regression inputs and unit tests | The same bug returns in the next refactor |
| Chase a coverage percentage | Cover changed branches and error paths | High coverage with weak assertions proves nothing |

## Verification checklist

- [ ] Tests are discovered per case by CTest and run with `ctest --output-on-failure`.
- [ ] New behaviour has a test that was seen failing before the fix.
- [ ] External boundaries are behind seams; no test touches real network or wall-clock time.
- [ ] Parsers of untrusted input have fuzz targets, and past crashes are regression tests.
- [ ] Sanitizer jobs (ASan+UBSan, TSan where relevant) pass in CI.
- [ ] Coverage of the changed code was reviewed, and gaps are fixed or justified.

## Related

- Workflows: `/tdd`, `/test-coverage`, `/verify`, `/build-fix`, `/root-cause`.
- Knowledge: `cpp-modern`, `c-systems-programming`, `tdd-testing`, `ci-cd-github-actions`, `static-analysis`, `concurrency-bugs`.
- Agents: `test-engineer`, `cpp-reviewer`, `cpp-build-resolver`.
