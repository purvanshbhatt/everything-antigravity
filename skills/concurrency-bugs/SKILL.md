---
name: concurrency-bugs
description: >-
  Debugs concurrency defects: data races, check-then-act and lost updates,
  deadlocks, livelocks, ordering and visibility bugs, async pitfalls (missing
  await, blocked event loops) and duplicate processing across services. Covers
  making flaky timing bugs reproducible, race detectors and sanitizers, thread
  dumps, and fixes with the right primitive. Use for intermittent failures,
  hangs, flaky tests, double charges or counters that drift under load.
---

# Concurrency Bugs

Concurrency bugs are interleavings, not mysteries. Make the failure
reproducible, let a detector or a thread dump show the shared state or the
lock cycle, name the exact interleaving that breaks the invariant, and fix it
with the right primitive. Never "fix" a race with a sleep.

## When to use

- A test or job fails intermittently, especially under load or in CI.
- The process hangs, or CPU is at zero while requests time out.
- Counters, balances or inventory drift; records are processed twice or lost.
- Async code behaves differently depending on timing.

## When not to use

- Deterministic slowness: use `profiling`.
- Memory growth: use `memory-leaks` (goroutine leaks start there, and come back here if a lock is involved).
- Message delivery semantics and idempotency design: use `message-queues` and `event-driven-architecture`.
- A general bug with no timing component: use `/root-cause`.

## Workflow

1. **Classify the symptom.**

   | Symptom | Suspect |
   | :--- | :--- |
   | Wrong value, sometimes | Data race, lost update, check-then-act |
   | Hang, threads idle | Deadlock, missed signal, channel nobody reads |
   | Hang, CPU busy | Livelock, spin loop, retry storm |
   | Works locally, fails on more cores or in CI | Ordering or visibility, unsynchronised shared state |
   | Duplicate side effects | Retries without idempotency, concurrent workers on the same item |
   | Event loop stalls | Blocking call in async code |

   **Check:** The symptom and suspect class are recorded with the evidence (logs, timings, frequency).

2. **Make it reproducible.** Run the test many times, add load and CPU pressure, and shrink timeouts. Inject delays at suspected points temporarily to widen the window.

   ```bash
   go test -race -count=200 -run TestTransfer ./...
   pytest -x --count=200 tests/test_transfer.py      # pytest-repeat plugin
   ```

   PowerShell loop for any command: `1..200 | ForEach-Object { npm test -- -t "transfer"; if ($LASTEXITCODE) { break } }`.

   **Check:** You can trigger the failure on demand, or you have a failure rate (for example 3 in 200) to compare against later.

3. **Run the detector or capture state at the hang.**

   | Runtime | Races | Hangs and deadlocks |
   | :--- | :--- | :--- |
   | Go | `go test -race ./...`, `go run -race` | `SIGQUIT` (Ctrl+\\) dumps all goroutines; `/debug/pprof/goroutine?debug=2` |
   | C / C++ | `-fsanitize=thread` (ThreadSanitizer) | `gdb -p <pid>` then `thread apply all bt` |
   | Rust | `loom` model checking for lock-free code; `cargo +nightly miri test` | Thread dump via debugger |
   | JVM | jcstress for low-level races | `jcmd <pid> Thread.print` or `jstack <pid>` (reports "Found one Java-level deadlock") |
   | Python | Stress tests; the GIL does not make `x += 1` atomic | `py-spy dump --pid <pid>`; `faulthandler.dump_traceback_later(30)` |
   | Node.js / asyncio | Review every `await` between read and write of shared state | asyncio debug mode (`asyncio.run(main(), debug=True)`) reports slow callbacks and never-awaited coroutines |

   **Check:** You have the detector report (two conflicting accesses with stacks) or a dump showing which threads wait on which locks.

4. **Name the interleaving.** Write it as a sequence: "T1 reads balance=100; T2 reads balance=100; T1 writes 70; T2 writes 50; T1's debit is lost." For deadlocks, write the lock cycle: "T1 holds A, waits for B; T2 holds B, waits for A."

   **Check:** The interleaving explains every observed symptom, and a reviewer can follow it.

5. **Fix with the right primitive** (table below). Prefer removing shared mutable state over adding locks.

   **Check:** The fix makes the broken interleaving impossible, not just less likely.

6. **Verify under stress.** Re-run the reproduction with many more iterations than it took to fail, with the detector on. Keep a stress or race test in CI.

   **Check:** Zero failures across at least ten times the iterations that previously failed, and the detector is clean.

## Reference

### Fix patterns

| Bug | Fix |
| :--- | :--- |
| Shared counter or flag | Atomic type (`sync/atomic`, `AtomicLong`, `std::atomic`) or a mutex |
| Check-then-act (`if not exists: create`) | Lock around both, an atomic compare-and-swap, or a unique constraint plus insert-and-handle-conflict |
| Lost update in a database | `UPDATE t SET qty = qty - 1 WHERE id = ? AND qty > 0`, optimistic version column, or `SELECT ... FOR UPDATE` in a transaction |
| Deadlock from lock ordering | Acquire locks in one global order; hold fewer locks; add timeouts (`tryLock`, `context` deadlines) |
| Lock held during I/O | Copy data under the lock, release, then do I/O |
| Goroutine or task blocked forever | `select` on `ctx.Done()`; buffered channels only with a reason; close channels from the sender |
| Async read-await-write race | Single writer (queue or actor), per-key mutex, or a transactional store |
| Blocking call in async code | Async client, or offload (`asyncio.to_thread`, a worker thread pool) |
| Duplicate processing | Idempotency key with a unique constraint; at-least-once delivery means handlers must be idempotent |
| Visibility or ordering (lock-free code) | Proper memory ordering, or replace with a lock or channel |

### Go: race in one line, fixed

```go
// Broken: concurrent map writes and lost increments.
// counts[key]++ from many goroutines

type Counter struct {
    mu     sync.Mutex
    counts map[string]int
}

func (c *Counter) Inc(key string) {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.counts[key]++
}
```

### Testing tips

Inject the clock and the scheduler where you can, so timing-dependent logic runs deterministically. Use barriers or latches in tests to force the dangerous interleaving on purpose, then assert the invariant. Keep race-detector runs in CI for Go, and TSan builds for C and C++.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Add `sleep` until the test passes | Force the interleaving and fix it | Sleeps hide races; they return under load |
| Retry flaky tests and move on | Reproduce with repetition and a detector | Flaky tests are often real production races |
| Wrap everything in one global lock | Smallest critical section; remove sharing | Global locks kill throughput and cause new deadlocks |
| Assume the GIL or a single thread makes code safe | Reason about every `await` and every yield point | Async and GIL-released code interleave freely |
| Check-then-insert without a constraint | Unique constraint and handle the conflict | Two requests always pass the check eventually |
| Claim a fix after one green run | Stress at ten times the failing iteration count | Rare interleavings need volume to appear |

## Verification checklist

- [ ] Failure reproduced on demand, or a baseline failure rate measured.
- [ ] Detector output or thread dump identifies the shared state or lock cycle.
- [ ] The interleaving is written out and explains every symptom.
- [ ] The fix makes the interleaving impossible; no sleeps added.
- [ ] Stress runs with the detector are clean at ten times the failing count.
- [ ] A race or stress test remains in CI.

## Related

- Agents: `silent-failure-hunter`, `code-reviewer`, `go-reviewer`, `rust-reviewer`, `java-reviewer`.
- Workflows: `/root-cause`, `/tdd`.
- Knowledge: `memory-leaks`, `profiling`, `golang-testing`, `kotlin-coroutines`, `swift-concurrency`, `message-queues`, `database-design`.
