---
name: memory-leaks
disable-model-invocation: true
description: >-
  Finds and fixes memory leaks: telling leaks from caches and fragmentation,
  three-snapshot heap diffs, retainer paths and dominator trees, with tools per
  runtime (DevTools heap snapshots for Node.js and browsers, tracemalloc and
  memray for Python, pprof and goleak for Go, jcmd and Eclipse MAT for the JVM,
  dotnet-gcdump, ASan and Valgrind). Use when memory grows until OOM, pods restart with OOMKilled,
  or RSS climbs over days.
---

# Memory Leaks

Prove it is a leak, reproduce it fast, diff heap snapshots to find what grows,
follow the retainer path to the reference that keeps it alive, and verify the
fix with a soak run that stays flat. Heap dumps can contain secrets and
personal data, and taking one pauses the process: handle dumps as sensitive,
and get the user's yes before dumping a production process.

## When to use

- Memory grows steadily across garbage collections until the process is killed.
- Kubernetes shows `OOMKilled` (exit code 137), or Cloud Run instances restart on memory limits.
- Goroutine, thread, file-handle or connection counts keep rising.
- A single-page app slows down the longer it stays open.

## When not to use

- Memory is high but flat: that is sizing or caching; tune limits and caches, and see `profiling` for allocation hot spots.
- CPU or latency problems: use `profiling`.
- Deadlocks and stuck goroutines caused by lock ordering: use `concurrency-bugs`.

## Workflow

1. **Confirm the shape.** Graph RSS and heap-used-after-GC over hours under steady load. A sawtooth that returns to the same floor is normal. A plateau is a cache or working set. A floor that rises with traffic or time is a leak.

   ```bash
   kubectl describe pod <pod> | grep -A3 "Last State"     # Reason: OOMKilled, Exit Code: 137
   kubectl top pod <pod>
   ```

   **Check:** You have a graph or numbers showing the post-GC floor rising, and the operations or time it correlates with.

2. **Reproduce quickly.** Loop the suspected operation (an endpoint, a job, a page navigation) in staging or locally. Shrink the heap limit to make failure fast (`node --max-old-space-size=256`, `-Xmx256m`).

   **Check:** Memory grows in proportion to iterations in your reproduction.

3. **Take three snapshots.** Warm up, snapshot 1; run N operations, snapshot 2; run N more, snapshot 3. Objects created between 1 and 2 that survive into 3 and grow with N are the leak.

   **Check:** You have three snapshots (or two diffs) from the same process.

4. **Find what grows and who retains it.** Sort the diff by retained size or object count, then follow the retainer path (or dominator tree) from a leaked object to a GC root: a global map, a listener list, a static field, a closure, a pending timer, a blocked goroutine.

   **Check:** You can name the exact field, collection or registration that holds the objects.

5. **Fix the reference, not the symptom.** Bound the cache, remove the listener, cancel the timer or goroutine, close the resource, or break the cycle (table below). Do not "fix" leaks with scheduled restarts or larger limits, except as a temporary mitigation the user accepts.

   **Check:** A test or reproduction loop shows the post-GC floor flat after the fix.

6. **Soak and guard.** Run the reproduction or a load test for several times the original time-to-failure. Add a regression guard: `goleak` in Go tests, a memory assertion in a long-running test, or a soak job before releases.

   **Check:** Memory stays flat across the soak, and the guard fails on the pre-fix code.

## Reference

### Tools by runtime

| Runtime | Snapshot and diff | Live signals |
| :--- | :--- | :--- |
| Node.js | `node --inspect` then DevTools Memory > Heap snapshot > Comparison; `node --heapsnapshot-signal=SIGUSR2`; `v8.writeHeapSnapshot()`; `--heapsnapshot-near-heap-limit=2` | `process.memoryUsage()` |
| Browser | DevTools Memory: heap snapshots (filter "Detached" for DOM leaks), allocation timeline | Performance monitor |
| Python | `tracemalloc` snapshot compare (below); `memray run -o out.bin app.py` then `memray flamegraph out.bin`; `objgraph.show_growth()` | RSS via `psutil` |
| Go | `go tool pprof -sample_index=inuse_space -base heap1.pb.gz heap2.pb.gz`; goroutines: `/debug/pprof/goroutine?debug=1` | `runtime.NumGoroutine()`, `go_memstats_*` metrics |
| JVM | `jcmd <pid> GC.heap_dump /tmp/heap.hprof`, analyse in Eclipse MAT (Leak Suspects, dominator tree); `jcmd <pid> GC.class_histogram` | `-XX:+HeapDumpOnOutOfMemoryError`; native: `-XX:NativeMemoryTracking=summary` with `jcmd <pid> VM.native_memory summary` |
| .NET | `dotnet-gcdump collect -p <pid>`; `dotnet-dump collect -p <pid>` | `dotnet-counters monitor -p <pid>` |
| C / C++ / Rust | `-fsanitize=address` (LeakSanitizer), `valgrind --leak-check=full ./app`, heaptrack | allocator stats (jemalloc) |

### Python: diff allocations with tracemalloc

```python
import tracemalloc

tracemalloc.start(25)                      # keep 25 frames per allocation
warm_up()
before = tracemalloc.take_snapshot()
for _ in range(1000):
    handle_request(sample_request())
after = tracemalloc.take_snapshot()
for stat in after.compare_to(before, "traceback")[:5]:
    print(stat)
    for line in stat.traceback.format():
        print("   ", line)
```

### Common leak causes

| Cause | Fix |
| :--- | :--- |
| Unbounded map or cache keyed by user, request or ID | LRU with max size and TTL; or a `WeakMap` / weak references |
| Event listeners or subscriptions never removed | Remove in cleanup; `AbortController` signals; unsubscribe on teardown |
| Timers and intervals never cleared | Clear on shutdown or component unmount |
| Goroutines blocked forever on a channel | Pass `context.Context` and select on `ctx.Done()` |
| Unclosed resources (Go `resp.Body`, files, DB connections) | `defer Close()`, `with` blocks, try-with-resources |
| `functools.lru_cache` on methods (holds `self`) | Cache at module level on immutable keys, or use a bounded per-instance cache |
| Static collections and ThreadLocals in the JVM | Clear on request end; avoid static mutable caches |
| `Rc` cycles in Rust | Use `Weak` for back-references |
| Detached DOM nodes held by JS | Drop references on unmount; clean up effects |

### Not a leak

Glibc malloc fragmentation in multithreaded processes (try `MALLOC_ARENA_MAX=2` or jemalloc), runtimes that keep freed memory reserved, and caches that plateau. Size container limits to the runtime: `-XX:MaxRAMPercentage=75` for the JVM, `--max-old-space-size` below the container limit for Node.js.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Call it a leak from one high reading | Graph the post-GC floor over time | Caches and warm-up look like leaks |
| Raise the memory limit and move on | Find the retainer; raise limits only as accepted mitigation | The crash just comes later and costs more |
| Nightly restarts as the fix | Fix the reference; restarts only as a stopgap | Restarts hide the bug and cause errors at restart time |
| Upload heap dumps to public tools or tickets | Keep dumps private, delete after analysis | Dumps contain secrets, tokens and personal data |
| Dump a busy production process without warning | Drain it first, get consent | Dumps pause the process, sometimes for seconds |
| Single snapshot analysis | Three-snapshot diff | One snapshot cannot show growth |

## Verification checklist

- [ ] Growth of the post-GC floor is shown with data.
- [ ] Reproduction grows with iterations; the leaking retainer is named.
- [ ] The fix removes the reference; the floor stays flat in a soak.
- [ ] A regression guard exists (goleak, memory test or soak job).
- [ ] Heap dumps handled as sensitive; production dumps had consent.

## Related

- Agents: `performance-optimizer`, `sre-engineer`, `silent-failure-hunter`.
- Workflows: `/root-cause`, `/perf-audit`.
- Knowledge: `profiling`, `concurrency-bugs`, `load-testing`, `nodejs-patterns`, `golang-services`, `kubernetes-gke`.
