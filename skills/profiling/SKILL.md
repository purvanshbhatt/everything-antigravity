---
name: profiling
description: >-
  Profiles CPU, wall-clock and allocation hot spots across runtimes: pprof for
  Go, py-spy and cProfile for Python, --cpu-prof and DevTools for Node.js,
  async-profiler and JFR for the JVM, perf and cargo flamegraph for native and
  Rust, dotnet-trace, Cloud Profiler in production, and how to read flame
  graphs and prove a fix with benchmarks. Use when code is slow, CPU is high,
  latency regressed, or before optimising anything.
---

# Profiling

Measure before changing anything. Reproduce the slowness under realistic
input, capture a profile with a sampling profiler, find the widest frames, fix
one thing, and prove the gain with the same benchmark. Attaching a profiler to
a production process needs the user's explicit yes.

## When to use

- An endpoint, job, build step or function is slower than it should be.
- CPU is high or a latency percentile regressed after a change.
- Choosing between optimisation ideas; you need data, not guesses.
- Verifying that a performance fix actually helped.

## When not to use

- Memory that grows until OOM: use `memory-leaks` (heap profiling lives there).
- Hangs, deadlocks or nondeterministic timing bugs: use `concurrency-bugs`.
- System-wide capacity questions under load: use `load-testing`.
- Page load and Core Web Vitals: use `web-performance`. For the full measure-fix-prove loop, use `/perf-audit`.

## Workflow

1. **Define the metric and the target.** "p95 of `GET /search` from 480 ms to under 200 ms at 50 req/s" or "nightly job from 40 to under 15 minutes". Decide whether the problem is CPU time (busy) or wall time (waiting on I/O, locks, network).

   **Check:** The metric, current value, target and measurement command are written down.

2. **Reproduce in a production-like build.** Optimised build, realistic data size, same runtime flags. Add a benchmark or a repeatable script; run it at least five times and note the variance.

   **Check:** Repeated runs agree within about 5 percent, so a later improvement will be visible.

3. **Capture a profile** with the runtime's sampling profiler (table below). Profile CPU for busy code and wall-clock or off-CPU for waiting code. Profile for at least 30 seconds of the slow behaviour.

   **Check:** The profile file exists and contains the code path you expect.

4. **Read the flame graph.** Width is time; height is stack depth; colour usually means nothing. Look for wide plateaus near the top (self time), unexpected frames (logging, regex compilation, JSON encoding, reflection, locks), and work repeated per item that could happen once. Use `go tool pprof -top` or the tool's table view to rank self time.

   **Check:** You can name the top three frames by self or cumulative time and explain why each is on the path.

5. **Form one hypothesis and change one thing.** Typical fixes: cache or hoist repeated work, batch I/O, remove N+1 queries, use a better algorithm or data structure, avoid allocations in hot loops, move blocking calls off the event loop.

   **Check:** The diff touches only the hot path you identified.

6. **Re-measure with the same benchmark** and compare profiles.

   ```bash
   go test -bench=Search -count=10 ./search > new.txt && benchstat old.txt new.txt
   go tool pprof -top -diff_base=old.prof new.prof
   ```

   **Check:** The improvement exceeds run-to-run noise and the target is met, or you return to step 4.

7. **Guard against regressions.** Keep the benchmark in the repo and, where it is stable enough, run it in CI with a threshold.

   **Check:** The benchmark runs in CI or is documented for release checks.

## Reference

### Profilers by runtime

| Runtime | CPU / wall profile | Notes |
| :--- | :--- | :--- |
| Go | `go test -bench=. -cpuprofile cpu.prof`; live: `go tool pprof -http=:8081 http://host:6060/debug/pprof/profile?seconds=30` | Import `net/http/pprof` on an internal-only port |
| Python | `py-spy record -o profile.svg --pid <pid>` or `py-spy record -o profile.svg -- python app.py`; `python -m cProfile -o out.prof app.py` | py-spy samples without code changes; add `--idle` to include waiting threads |
| Node.js | `node --cpu-prof app.js` (writes a `.cpuprofile`); `node --inspect` then DevTools Performance | Open `.cpuprofile` files in DevTools |
| JVM | `asprof -d 30 -e cpu -f flame.html <pid>` (async-profiler 3.x); `jcmd <pid> JFR.start duration=60s filename=rec.jfr` | Use `-e wall` for wall-clock; JFR is low overhead for production |
| Rust / C / C++ | `cargo flamegraph`; `perf record -F 99 -g -p <pid> -- sleep 30` then `perf report` | Keep debug symbols in release builds for readable stacks |
| .NET | `dotnet-trace collect -p <pid>`; `dotnet-counters monitor -p <pid>` | Open traces in PerfView or Visual Studio |
| Windows native | `wpr -start CPU` ... `wpr -stop trace.etl`, view in Windows Performance Analyzer | Run from an elevated prompt |
| Browser | DevTools Performance panel; React Profiler | Throttle CPU to match low-end devices |
| Production fleet | Cloud Profiler agents (Go, Java, Node.js, Python) | Continuous, low overhead; compare by version |

Attaching py-spy, perf or async-profiler to another process needs ptrace or perf permissions (root, `SYS_PTRACE` in containers, or a lower `kernel.perf_event_paranoid`). Ask before changing those settings.

### Python: profile a block

```python
import cProfile
import pstats

with cProfile.Profile() as prof:
    run_report(month="2026-10")
pstats.Stats(prof).sort_stats("cumulative").print_stats(15)
```

### Common hot-path culprits

| Symptom in profile | Likely fix |
| :--- | :--- |
| Many small database calls under one request | Batch or join; fix N+1 |
| JSON or serialisation dominates | Smaller payloads, faster encoder, avoid re-encoding |
| Regex compile or reflection per call | Compile or resolve once and reuse |
| Logging frames are wide | Lower level on hot paths, lazy formatting |
| GC or allocator frames are wide | Reuse buffers, avoid per-item allocations |
| Mostly idle in wall profile | Waiting on I/O or locks: parallelise, cache, or fix the slow dependency |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Optimise by intuition | Profile first | The real bottleneck is rarely where you expect |
| Profile a debug or tiny-input build | Optimised build with realistic data | Hot paths differ by build and input size |
| Use instrumenting profilers for timing | Sampling profilers | Instrumentation overhead distorts results |
| Change several things at once | One change per measurement | You cannot attribute the gain or the regression |
| Report one run | Repeat runs and compare with benchstat or similar | Noise hides or fakes improvements |
| Micro-optimise cold code | Fix the widest frames | Saving 90 percent of 1 percent is nothing |

## Verification checklist

- [ ] Metric, baseline and target recorded before changes.
- [ ] Profile captured on a realistic build and workload.
- [ ] Each change is justified by a named hot frame.
- [ ] Improvement exceeds noise across repeated runs.
- [ ] A benchmark or check guards against regression.
- [ ] Production attaches and permission changes had explicit user consent.

## Related

- Agents: `performance-optimizer`, `sre-engineer`.
- Workflows: `/perf-audit`, `/verify`.
- Knowledge: `memory-leaks`, `concurrency-bugs`, `load-testing`, `web-performance`, `sql-optimization`, `observability-otel`, `golang-testing`, `rust-testing`.
