---
name: web-performance
disable-model-invocation: true
description: >-
  Diagnoses and fixes web performance problems: Core Web Vitals (LCP, INP,
  CLS) from field and lab data, bundle size and code splitting, image and font
  delivery, caching headers and CDNs, third-party scripts, backend p95/p99
  latency, and CPU profiling in Chrome DevTools, Node and Python. Use when a
  page feels slow, a vitals report is red, a bundle grew, or performance
  budgets need to be enforced in CI.
---

# Web Performance

Make the slow thing fast with evidence: read field data, reproduce it in the
lab, fix the biggest contributor, and lock the gain in with a budget.
Optimising without a baseline is guessing.

## When to use

- PageSpeed Insights, Search Console or RUM shows LCP, INP or CLS as "needs improvement" or "poor".
- Users report slow loads, janky typing or scrolling, or content jumping around.
- A bundle, image or third-party tag was added and the page got heavier.
- API or page TTFB p95/p99 went up after a release.
- The team wants performance budgets that fail CI.

## When not to use

- Writing new Next.js features: use `frontend-react-nextjs`, then come back to measure.
- Query plans and indexes: use `database-design` or the `database-architect` agent.
- Capacity planning and autoscaling: use `cloud-devops` or `kubernetes-gke`.
- Setting up tracing and metrics from scratch: use `observability-otel`.
- Search ranking beyond vitals: use `seo-audit`.

## Workflow

1. **Start from field data.** Check PageSpeed Insights (its field-data section comes from CrUX) for the URL and the origin, the Search Console Core Web Vitals report, or the site's own RUM. If the site has no RUM, add the `web-vitals` library with its attribution build (`web-vitals/attribution`) and send `name`, `value`, `rating`, `id` and the attribution fields you need to an endpoint. Attribution field names differ per metric and per major version, so read its README. Low-traffic or pre-launch sites have no CrUX data; say so and rely on lab data.

   **Check:** You have p75 LCP, INP and CLS for mobile on the affected URL group, and you know which metric fails.

2. **Reproduce in the lab on a production build.** Never measure the dev server.

   ```bash
   npm run build && npm run start
   npx lighthouse http://localhost:3000/pricing --only-categories=performance --output=html --output-path=./lh-pricing.html
   npx lighthouse http://localhost:3000/pricing --preset=desktop --only-categories=performance --output=json --output-path=./lh-pricing-desktop.json
   ```

   Lighthouse emulates mobile by default. Run it 3-5 times and use the median. For interactions, record in the DevTools Performance panel with CPU throttling (4x or 6x) and network throttling on.

   **Check:** The lab run reproduces the failing metric, and the report or trace is saved for before/after comparison.

3. **Attribute the metric to a cause.** Use the [Core Web Vitals playbook](references/core-web-vitals.md):
   - **LCP:** identify the LCP element, then split its time into TTFB, resource load delay, resource load duration and element render delay.
   - **INP:** find the slow interaction, then split it into input delay, processing time and presentation delay. Look for long tasks (over 50 ms) on the main thread.
   - **CLS:** find the shifting elements in the Layout Shifts track and identify what pushed them.

   **Check:** You can name one element, script or request, the phase it inflates, and by how many milliseconds.

4. **Fix the largest contributor, one change at a time.** Prefer removing work over speeding it up: drop unused JS, defer non-critical scripts, stop client-rendering the LCP element.

   **Check:** The same lab measurement (median of 3+) improved, and no other vital regressed.

5. **Audit the payload.**

   ```bash
   npx source-map-explorer "dist/assets/*.js"   # any build that emits source maps
   npx vite-bundle-visualizer                   # Vite
   # Next.js webpack builds: @next/bundle-analyzer, then ANALYZE=true npm run build
   ```

   PowerShell: `$env:ANALYZE = "true"; npm run build`. For Turbopack builds, check the installed Next.js docs for its analyzer. Split by route and by interaction with dynamic `import()`, `React.lazy` or `next/dynamic`. Replace heavy dependencies, and import from leaf modules instead of barrel files.

   **Check:** You can list the five largest modules in the initial chunk of the affected route and say why each one is needed for first render.

6. **Check the backend when TTFB or API calls dominate.** Read p50, p95 and p99 from traces or histograms, never averages. Reproduce the load with k6 (below), then profile the hot path (see profiling commands).

   **Check:** You can name the span, query or function that dominates p95.

7. **Lock the gain in.** Add Lighthouse CI assertions, a `size-limit` budget or k6 thresholds to CI. See [budgets in CI](references/budgets-in-ci.md).

   **Check:** CI fails on a deliberately bloated branch and passes on main.

## Patterns

### Thresholds (p75 of page loads, mobile and desktop separately)

| Metric | Good | Poor | Lab proxy |
| :--- | :--- | :--- | :--- |
| LCP | ≤ 2.5 s | > 4.0 s | LCP |
| INP | ≤ 200 ms | > 500 ms | Total Blocking Time |
| CLS | ≤ 0.1 | > 0.25 | CLS |
| TTFB (diagnostic) | ≤ 0.8 s | > 1.8 s | Server response time |

### Caching headers

| Resource | `Cache-Control` |
| :--- | :--- |
| Fingerprinted assets (`app.3f9c1.js`, fonts, hashed images) | `public, max-age=31536000, immutable` |
| HTML documents | `no-cache` (revalidate with `ETag`), or `public, s-maxage=60, stale-while-revalidate=300` when a CDN may cache them |
| Personalised responses | `private, no-store` |
| Shared API GETs | `public, s-maxage=<n>, stale-while-revalidate=<m>` plus a correct `Vary` |

Also: Brotli or gzip for text, HTTP/2 or HTTP/3, at most two or three `preconnect` hints for critical origins, and no redirect chains on entry URLs.

### Images, fonts and third parties

- **LCP image:** in the initial HTML, never `loading="lazy"`, `fetchpriority="high"`, AVIF or WebP, `srcset` with `sizes`. CSS background images are discovered late; preload them or use `<img>`.
- **All media:** explicit `width` and `height` (or `aspect-ratio`) so nothing shifts. Lazy-load below the fold.
- **Fonts:** self-hosted WOFF2, subset, `font-display: swap` (or `optional`), preload only the one or two critical files, and fallback metric overrides (`size-adjust`) to avoid shifts.
- **Third-party tags:** inventory them by origin in the Network panel, load them `async` or `defer` or after interaction, use facades for chat widgets and video embeds, and delete tags nobody owns.

### Profiling commands

| Runtime | Capture | Inspect |
| :--- | :--- | :--- |
| Browser | DevTools, Performance panel, record with CPU throttling | Same panel (main-thread flame chart, Interactions and Layout Shifts tracks) |
| Node | `node --cpu-prof --cpu-prof-dir=./prof server.js`, then exercise and stop the process | Load the `.cpuprofile` in the DevTools Performance panel or speedscope |
| Node (live) | `node --inspect server.js`, then open `chrome://inspect` | DevTools CPU profile and heap snapshots |
| Python | `py-spy record -o profile.svg --pid <PID>` or `py-spy top --pid <PID>` | Flame graph SVG; `--format speedscope` for speedscope |
| Go | `go tool pprof -http=:8081 http://localhost:6060/debug/pprof/profile?seconds=30` | pprof web UI (needs `net/http/pprof` imported) |

py-spy needs elevated privileges on macOS and `SYS_PTRACE` inside containers.

### Load test with thresholds (k6)

```js
// load.js — run: k6 run -e BASE_URL=http://localhost:8080 load.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 20,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<800'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(`${__ENV.BASE_URL}/api/items`);
  check(res, { 'status is 200': (r) => r.status === 200 });
}
```

Typical backend p95 causes: N+1 queries, missing indexes, no connection pooling, synchronous calls to slow dependencies on the request path, cold starts, lock contention, and oversized payloads.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Chase the Lighthouse score | Fix the metric that fails in field data | Lab runs on one device and network; users don't |
| Measure on the dev server | Measure `build` + `start` output | Dev builds skip minification and caching |
| Lazy-load the hero image | Load it eagerly with high fetch priority | Lazy loading delays the LCP request |
| Report average latency | Report p50, p95 and p99 | Averages hide the tail users complain about |
| Preload many resources | Preload only the LCP resource and critical fonts | Extra preloads compete for bandwidth |
| Ship several fixes in one change | Change one thing, re-measure | You can't tell which change helped or hurt |
| Patch CLS with guessed `min-height` | Reserve exact space with dimensions or `aspect-ratio` | Guesses break on other viewports |

## Verification checklist

- [ ] Field data (or a stated lack of it) and a saved lab baseline exist for the affected pages.
- [ ] The root cause is named with a phase breakdown and numbers.
- [ ] After the fix, the median lab metric improved and no other vital regressed.
- [ ] Bundle changes were checked with an analyzer, and caching headers were verified with `curl -I`.
- [ ] A budget or threshold now runs in CI.

## Related

- Workflows: `/verify`, `/root-cause`, `/code-review`, `/e2e`.
- Knowledge: `frontend-react-nextjs`, `observability-otel`, `database-design`, `backend-patterns`, `seo-audit`, `cloud-devops`, `browser-automation`.
- Agents: `performance-optimizer`, `database-architect`, `cloud-devops-engineer`.
