---
name: perf-audit
description: >-
  Audits and fixes performance end to end: sets a target metric and budget,
  measures a reproducible baseline (Lighthouse, field Core Web Vitals, load
  tests, benchmarks), profiles to find the dominant bottleneck, fixes one
  cause at a time and proves each win with before-and-after numbers and a
  regression guard. Use when a page, endpoint, query, job or app is slow, or
  a launch needs a performance sign-off. Invoke with /perf-audit.
---

# Perf Audit

Measure, find the biggest bottleneck, fix it, prove it, repeat. Never optimize
without a profile, never claim a win without a comparable measurement, and
leave a guard in CI so the win survives.

Usage: `/perf-audit <target> [metric]` (for example `/perf-audit /checkout LCP`, `/perf-audit GET /api/orders p95`).

## When to use

- "This page is slow", "the API p95 doubled", "the nightly job takes four hours", "make startup faster".
- Red Core Web Vitals, a bundle-size jump, or a pre-launch performance review.
- After a framework migration or dependency upgrade that regressed speed.

## When not to use

- Pure frontend diagnosis knowledge (CWV causes, image and font delivery): read `web-performance` directly.
- Capacity planning and load models: `load-testing`.
- A leak that grows until a crash: `memory-leaks`. A slow single query: `sql-optimization` first.

## Workflow

1. **Set the target.** Name the surface (page, endpoint, job, query, startup, memory), the metric and the goal, taken from an SLO, a budget or the user. Defaults when none exist: Core Web Vitals "good" thresholds at the 75th percentile (LCP at most 2.5 s, INP at most 200 ms, CLS at most 0.1); for APIs, an explicit p95 agreed with the user.

   **Check:** The artifact states metric, current value (or "unknown"), target and environment.

2. **Measure a reproducible baseline.** Use a production build on a stable machine, realistic data volume, and several runs; report the median and spread.

   ```bash
   # Web (lab): run 3-5 times, keep the JSON; mobile emulation is the default
   npx lighthouse http://localhost:3000/checkout --only-categories=performance --output=json --output-path=./perf/baseline-1.json
   # HTTP endpoint: fixed connections and duration
   npx autocannon -c 50 -d 30 http://localhost:3000/api/orders
   k6 run load/orders.js                     # when the project has k6 scripts
   # CLI or batch job
   hyperfine --warmup 3 "node scripts/build-report.js"
   ```

   ```sql
   EXPLAIN (ANALYZE, BUFFERS) SELECT ...;    -- PostgreSQL; the real query with real parameters
   ```

   Pull field data (CrUX, RUM, APM traces) when available; lab numbers explain, field numbers decide.

   **Check:** Baseline median and spread, commit, machine and data size are recorded.

3. **Profile to find the bottleneck.** Delegate to the `performance-optimizer` subagent with the slow path, the metric, the baseline and the run command, or profile directly:

   | Runtime | Profile with |
   | :--- | :--- |
   | Browser | DevTools Performance panel trace (long tasks, layout, network waterfall) |
   | Node.js | `node --cpu-prof app.js` (open the `.cpuprofile` in DevTools) |
   | Python | `py-spy record -o profile.svg --pid <pid>` or `-- python app.py` |
   | Go | `go test -bench=. -cpuprofile cpu.out` then `go tool pprof -http=:8081 cpu.out` |
   | JVM | async-profiler or JDK Flight Recorder |
   | Database | `pg_stat_statements`, slow query log, `EXPLAIN (ANALYZE, BUFFERS)` |
   | Distributed | Traces in the APM or OpenTelemetry backend: the longest span on the critical path |

   Rank hotspots by share of total time. Amdahl's law: a 50% speedup of something that is 4% of the time saves 2%.

   **Check:** The top three hotspots are listed with their share of time and `path:line`.

4. **Fix one cause at a time.** Form a hypothesis ("orders list does an N+1 over line items"), make the smallest fix, and commit it alone.

   | Symptom | Typical fix |
   | :--- | :--- |
   | N+1 queries | Batch, join or dataloader |
   | Sequential scan on a filtered column | Index that matches the filter and sort |
   | Repeated identical work | Memoize or cache, with an explicit invalidation rule |
   | Sync I/O or serial awaits on the request path | Concurrency with limits, streaming, background jobs |
   | Large JS bundles | Route-level code splitting, remove heavy dependencies, tree-shake |
   | Slow LCP | Preload or prioritize the LCP resource, right-size images, modern formats, fewer render-blocking resources |
   | Poor INP | Break up long tasks, defer non-urgent work, reduce re-renders |
   | CLS | Reserve space (`width`/`height`, `aspect-ratio`) for media, ads and embeds |
   | Chatty network | Batch requests, compress, cache headers, HTTP caching or CDN |

   **Check:** Each fix is a separate commit with the hypothesis in its message.

5. **Re-measure the same way.** Same command, machine, data and run count. Keep a fix only if the improvement exceeds the run-to-run spread; revert fixes that don't help. Then run `/verify quick` to confirm behaviour is unchanged.

   **Check:** Before and after medians are recorded per fix; correctness gates pass.

6. **Repeat until the target is met or the remaining hotspots are not worth it.** Stop when the target is hit; report diminishing returns honestly.

   **Check:** Metric meets the target, or the report explains what remains and its cost.

7. **Guard against regressions.** Add a budget the project's CI can enforce: Lighthouse CI assertions (`npx @lhci/cli autorun` with a config), bundle-size limits, k6 `thresholds`, or benchmark tests with tolerances.

   ```js
   export const options = { thresholds: { http_req_duration: ['p(95)<300'], http_req_failed: ['rate<0.01'] } };
   ```

   **Check:** The guard fails when the old, slow version is checked against it, or this was reasoned through explicitly.

## Report format

```markdown
## Perf audit: <target>  (metric: p95 latency, target <= 300 ms)
| Change | Before (median, spread) | After | Delta | Commit |
| :--- | :--- | :--- | :--- | :--- |
| Batch line-item query (N+1) | 840 ms (±40) | 310 ms (±25) | -63% | abc123 |
| Index orders(customer_id, created_at) | 310 ms | 190 ms | -39% | def456 |
**Result:** 190 ms p95 (target met). Guard: k6 threshold in CI.
**Not done:** <remaining hotspots and estimated value>
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Optimize what you assume is slow | Profile first | Intuition about hotspots is usually wrong |
| Measure once on a dev build | Several runs on a production build | Variance and dev tooling swamp real effects |
| Change several things, then measure | One fix per measurement | You can't attribute or revert wins |
| Cache without an invalidation rule | Define TTL or event-based invalidation | Stale data bugs replace slow-page bugs |
| Report "much faster" | Report medians, spread and conditions | Numbers can be checked; adjectives can't |

## Verification checklist

- [ ] Metric, target and environment stated.
- [ ] Baseline is reproducible, with median and spread.
- [ ] Hotspots come from a profile, ranked by share of time.
- [ ] One fix per commit; each kept fix beats the noise; unhelpful fixes reverted.
- [ ] Correctness verified after fixes.
- [ ] A regression guard exists in CI.

## Related

- Knowledge: `web-performance`, `profiling`, `memory-leaks`, `sql-optimization`, `load-testing`, `redis-caching`, `mobile-performance`, `observability-otel`.
- Workflows: `/verify`, `/root-cause`.
- Agents: `performance-optimizer`, `database-architect`.
