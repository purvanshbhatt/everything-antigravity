# Performance budgets in CI

A budget only works if it fails the build. Start from the current numbers, set
the budget slightly above them, and ratchet down as fixes land.

## Lighthouse CI

`lighthouserc.json`:

```json
{
  "ci": {
    "collect": {
      "startServerCommand": "npm run start",
      "url": ["http://localhost:3000/", "http://localhost:3000/pricing"],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time": ["warn", { "maxNumericValue": 200 }],
        "resource-summary:script:size": ["error", { "maxNumericValue": 350000 }]
      }
    },
    "upload": { "target": "filesystem", "outputDir": "./lhci-report" }
  }
}
```

```bash
npm run build
npx @lhci/cli autorun
```

The `temporary-public-storage` upload target publishes reports to a public
URL. Use `filesystem` (as above) or a self-hosted LHCI server for private apps.
Check the LHCI docs for the assertion names your version supports.

## Bundle size with size-limit

```bash
npm i -D size-limit @size-limit/file
```

`.size-limit.json`:

```json
[
  { "name": "main bundle", "path": "dist/assets/index-*.js", "limit": "170 kB" },
  { "name": "vendor", "path": "dist/assets/vendor-*.js", "limit": "120 kB" }
]
```

```bash
npx size-limit          # exits non-zero when a limit is exceeded
```

## Backend latency with k6

k6 exits with a non-zero code when any threshold fails, so a plain
`k6 run load.js` step gates the pipeline. Run it against an ephemeral or
staging environment, never production without approval.

## GitHub Actions sketch

```yaml
jobs:
  perf:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run build
      - run: npx size-limit
      - run: npx @lhci/cli autorun
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: lhci-report, path: lhci-report }
```

Pin action and tool versions to what your repository already uses. See
`ci-cd-github-actions` for caching, permissions and pinning by SHA.

## Budget starting points

| Budget | Starting point | Notes |
| :--- | :--- | :--- |
| LCP (lab, mobile) | 2.5 s | Lab is optimistic for slow devices; keep field p75 as the real target |
| TBT (lab) | 200 ms | Proxy for INP |
| CLS | 0.1 | Same in lab and field |
| Initial JS per route (compressed) | Current size + 5% | Ratchet down after each win |
| API p95 | Agree per endpoint, for example 300 ms | Gate with k6 thresholds |
