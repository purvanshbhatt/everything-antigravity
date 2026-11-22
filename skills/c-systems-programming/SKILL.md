---
name: c-systems-programming
description: >-
  Writes and reviews C for systems work with a memory-safety discipline:
  ownership conventions, bounds and size-overflow checks, the common undefined
  behaviour traps, hardened compiler and linker flags, ASan/UBSan, Valgrind and
  static analyzers, and correct POSIX usage (errno, short reads, EINTR, signals,
  fork/exec, file descriptors). Use when writing, auditing or debugging C code,
  daemons, CLIs or libraries with a C API.
---

# C Systems Programming

C gives no safety net, so the discipline must live in conventions, compiler
flags and tools. Every buffer has a known size, every allocation has one owner,
every system call's return value is checked, and every build runs under
sanitizers in CI.

## When to use

- Writing or reviewing C code: daemons, CLIs, libraries with a C ABI, FFI shims.
- Crashes, memory corruption, leaks or behaviour that changes with optimization level.
- Hardening build flags, or adding sanitizers, Valgrind or static analysis.
- Using POSIX APIs: files, sockets, processes, signals, threads.

## When not to use

- C++ code, even if it looks like C: use `cpp-modern`.
- Microcontrollers, RTOS and HAL work: use `embedded-firmware`.
- Test framework setup and fuzzing harnesses: use `cpp-testing` (GoogleTest and libFuzzer work for C too).
- A greenfield component where memory safety is a requirement: consider `rust-systems` before committing to C.

## Workflow

1. **Establish the toolchain and standard.** Read the `Makefile`, `CMakeLists.txt` or `meson.build`; note `-std=`, target platforms and the libc (glibc, musl, macOS libSystem, MSVC CRT).

   ```bash
   cc --version
   grep -rn "\-std=\|CMAKE_C_STANDARD\|c_std" Makefile CMakeLists.txt meson.build 2>/dev/null
   ```

   **Check:** You can name the C standard, compilers and target OSes. POSIX APIs do not exist on native Windows; use WSL or MSYS2 there, or a portability layer.

2. **Turn on warnings and hardening.** Use the flag set below for development builds and fix every warning before adding features.

   **Check:** A clean rebuild produces zero warnings with `-Werror` (or `/WX` on MSVC).

3. **Write with explicit ownership and sizes.** Document who frees each pointer (in the header comment or a naming convention such as `_create`/`_destroy`, `_borrow`). Pass buffers as pointer plus length. Use one `goto cleanup` exit path per function that acquires several resources.

   **Check:** Every `malloc`/`fopen`/`open`/`socket` has exactly one matching release on every path, including error paths.

4. **Check every boundary.** Validate lengths before copying, check size arithmetic for overflow before allocating, check every return value, and use `snprintf` with truncation detection instead of `sprintf`/`strcpy`.

   **Check:** `grep_search` for `strcpy\|strcat\|sprintf\|gets\|atoi` returns nothing in new code.

5. **Run under sanitizers and Valgrind.** Run the test suite in an ASan+UBSan build, and use Valgrind for leak and uninitialized-read checks where sanitizers are unavailable.

   ```bash
   cc -std=c17 -g -O1 -fsanitize=address,undefined -fno-omit-frame-pointer src/*.c -o app_asan
   UBSAN_OPTIONS=print_stacktrace=1:halt_on_error=1 ./app_asan
   valgrind --leak-check=full --error-exitcode=1 ./app       # Linux; use a non-sanitized build
   ```

   MSVC: `/fsanitize=address`. Clang also offers MemorySanitizer (`-fsanitize=memory`, Linux) for uninitialized reads, and ThreadSanitizer for data races; each needs its own build. **Check:** Tests pass with no sanitizer reports and Valgrind exits 0.

6. **Add static analysis.** Run at least one analyzer and triage results: `gcc -fanalyzer`, `clang --analyze` or `scan-build make`, `cppcheck --enable=warning,portability src/`, or `clang-tidy`. MSVC: `/analyze`.

   **Check:** New findings are fixed or suppressed with a written reason.

7. **Review.** Delegate a second pass to the `cpp-reviewer` agent with the diff and the ownership conventions; ask it to trace every error path.

## Patterns

### Development and release flags

| Purpose | GCC/Clang | MSVC |
| :--- | :--- | :--- |
| Warnings | `-Wall -Wextra -Wpedantic -Wshadow -Wconversion -Wformat=2 -Werror` | `/W4 /WX` |
| Fortified libc calls | `-O2 -D_FORTIFY_SOURCE=2` (needs optimization; level 3 on newer toolchains, verify) | `/sdl` |
| Stack protection | `-fstack-protector-strong` | `/GS` (default) |
| Position independent | `-fPIE -pie` | `/DYNAMICBASE` (default) |
| Linker hardening (ELF) | `-Wl,-z,relro,-z,now` | n/a |
| Debug memory errors | `-fsanitize=address,undefined -fno-omit-frame-pointer -g` | `/fsanitize=address /Zi` |

### Undefined behaviour that bites in practice

| UB | Typical source | Defence |
| :--- | :--- | :--- |
| Signed integer overflow | `len + 1`, loop counters, `a * b` sizes | Use `size_t` for sizes; check before arithmetic; UBSan |
| Out-of-bounds access | Off-by-one, missing NUL terminator | Pointer plus length everywhere; ASan |
| Use after free / double free | Unclear ownership, error paths | One owner; set pointer to `NULL` after `free` |
| Uninitialized reads | Struct fields, error paths | Initialize at declaration (`= {0}`); MSan or Valgrind |
| Strict aliasing violation | Casting `char*` buffers to `struct*` or `uint32_t*` | `memcpy` into a typed local |
| Shift too far | `1 << 31` on `int`, shift by width | Shift unsigned types; check the count |
| Overlapping `memcpy` | In-place buffer moves | `memmove` |
| Data race | Shared globals across threads | Mutexes or C11 `_Atomic`; TSan |

### Safe allocation and copying

```c
#include <errno.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

/* Returns NULL and sets errno on overflow or allocation failure. Caller frees. */
void *array_alloc(size_t count, size_t elem_size) {
    if (elem_size != 0 && count > SIZE_MAX / elem_size) { errno = EOVERFLOW; return NULL; }
    return calloc(count, elem_size);    /* calloc also zeroes the memory */
}

/* Copies src into dst[dst_len]; returns 0, or -1 if truncated. Always NUL-terminates. */
int copy_str(char *dst, size_t dst_len, const char *src) {
    if (dst_len == 0) return -1;
    int n = snprintf(dst, dst_len, "%s", src);
    return (n < 0 || (size_t)n >= dst_len) ? -1 : 0;
}
```

### POSIX rules that prevent most bugs

- `read`/`write`/`send`/`recv` may transfer fewer bytes than asked; loop until done, and retry on `EINTR`.
- Read `errno` only immediately after a call that reported failure; save it before calling anything else.
- Parse numbers with `strtol`/`strtoul`: set `errno = 0`, then check `errno`, `endptr` and range. `atoi` cannot report errors.
- Open descriptors with `O_CLOEXEC` (and sockets with `SOCK_CLOEXEC` where available) so children do not inherit them.
- Signal handlers may call only async-signal-safe functions; set a `volatile sig_atomic_t` flag and handle it in the main loop. Install handlers with `sigaction`, not `signal`.
- Prefer `posix_spawn` or `fork` plus `execve` with an argument vector; never build shell command strings from input for `system` or `popen`.
- Reap children with `waitpid` and check `WIFEXITED`/`WEXITSTATUS`.
- Check `close` results on files you wrote; a failed `close` can mean lost data.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `strcpy`, `strcat`, `sprintf`, `gets` | `snprintf` with truncation checks, explicit lengths | Unbounded writes are the classic overflow |
| `strncpy` as a "safe" copy | `snprintf` or a length-checked `memcpy` plus NUL | `strncpy` may leave the result unterminated |
| `malloc(n * size)` | Check overflow first, or `calloc(n, size)` | Wrapped size allocates too little and overflows later |
| Ignore return values of `write`, `close`, `fclose` | Check and propagate errors | Silent data loss and partial writes |
| Assume `-O0` behaviour is the real behaviour | Test optimized builds under UBSan | Optimizers exploit UB and change results |
| `system()` with interpolated input | `posix_spawn`/`execve` with argv | Shell injection |

## Verification checklist

- [ ] Zero warnings under the development flag set with warnings as errors.
- [ ] Every allocation and descriptor has one documented owner and is released on all paths.
- [ ] All size arithmetic is overflow-checked; no unbounded string functions remain.
- [ ] Every system call result is checked; short reads/writes and `EINTR` are handled.
- [ ] Tests pass under ASan+UBSan (and TSan for threads); Valgrind is clean where used.
- [ ] A static analyzer ran, and findings are fixed or justified.

## Related

- Workflows: `/build-fix`, `/code-review`, `/security-scan`, `/root-cause`.
- Knowledge: `cpp-modern`, `cpp-testing`, `embedded-firmware`, `rust-systems`, `memory-leaks`, `concurrency-bugs`, `static-analysis`, `linux-admin`.
- Agents: `cpp-reviewer`, `cpp-build-resolver`, `security-guard`.
