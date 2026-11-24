---
name: visual-regression
disable-model-invocation: true
description: >-
  Sets up visual regression testing that catches real UI changes without
  flaking: Playwright toHaveScreenshot baselines, thresholds and masks,
  deterministic rendering (fonts, animations, clock, network), per-platform
  baselines in Docker or CI, Storybook component snapshots with Chromatic or
  similar services, and a baseline review workflow. Use when adding screenshot
  tests, visual tests are flaky, or CSS changes keep slipping through review.
---

# Visual Regression

A screenshot test is only useful if it fails for real changes and never for
noise. Make rendering deterministic first, compare at the smallest stable
surface (component before page), and treat baseline updates as code changes
that a person reviews.

## When to use

- CSS, design-token or component-library changes keep causing unnoticed regressions.
- Adding screenshot tests to Playwright or Storybook.
- Existing visual tests fail randomly or differ between laptops and CI.
- Choosing between self-hosted Playwright snapshots and a hosted service.

## When not to use

- Functional browser flows (click, assert text, navigation): use `/e2e`.
- Accessibility checks: use `/a11y-audit`.
- One-off visual QA and polish of a page: use `/ui-polish`.
- Component behaviour tests: use `react-testing`.

## Workflow

1. **Choose the surface.** Component stories cover states cheaply (hover, error, empty, long text, RTL, dark mode); a handful of full-page shots cover layout and composition.

   **Check:** You have a list of components and states plus no more than 10-20 critical pages to snapshot.

2. **Make rendering deterministic** (table below): fixed viewport and device scale factor, bundled fonts, animations disabled, frozen clock, mocked network and seeded data.

   **Check:** Running the same test 10 times locally produces zero diffs (`npx playwright test visual --repeat-each=10`).

3. **Write the assertion with masks and an explicit tolerance.**

   ```typescript
   import { test, expect } from "@playwright/test";

   test("pricing page", async ({ page }) => {
     await page.clock.setFixedTime(new Date("2026-01-15T10:00:00Z"));
     await page.route("**/api/plans", (r) => r.fulfill({ path: "tests/fixtures/plans.json" }));
     await page.goto("/pricing");
     await page.evaluate(async () => { await document.fonts.ready; });
     await expect(page).toHaveScreenshot("pricing.png", {
       fullPage: true,
       animations: "disabled",
       mask: [page.getByTestId("live-chat"), page.locator("[data-timestamp]")],
       maxDiffPixelRatio: 0.001,
     });
   });
   ```

   **Check:** The test fails when you change a margin by a few pixels and passes on reruns.

4. **Generate baselines in the CI environment.** Playwright stores baselines per browser and platform, and font rendering differs by OS. Generate and update them inside the same container image CI uses (the official Playwright image matching your `@playwright/test` version, for example `mcr.microsoft.com/playwright:v<version>-noble`).

   ```bash
   docker run --rm -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v<version>-noble \
     npx playwright test visual --update-snapshots
   ```

   PowerShell: use `${PWD}` for the volume path. Commit the baseline PNGs.

   **Check:** CI passes on a branch with no UI changes.

5. **Review diffs like code.** Upload the Playwright HTML report (expected, actual and diff images) as a CI artifact on failure. Baseline updates go in their own commit with a short reason, and a reviewer looks at the images.

   **Check:** No pipeline step updates baselines automatically.

6. **Quarantine flake quickly.** A test that flakes twice gets fixed (mask, wait for a specific state, stabilize data) or temporarily skipped with an issue link, never silenced with a huge threshold.

   **Check:** Visual job flake rate stays near zero over a week of runs.

## Reference

### Determinism checklist

| Source of noise | Fix |
| :--- | :--- |
| Animations and transitions | `animations: "disabled"`; `reducedMotion: "reduce"` in the test `use` options |
| Text caret and focus rings | `caret: "hide"` (the default); blur inputs before capture |
| Clock-dependent text | `page.clock.setFixedTime(...)` (Playwright 1.45+) |
| Network data | `page.route` with fixtures; seeded test database |
| Web fonts | Self-host fonts in the app; wait for `document.fonts.ready` |
| Lazy images and skeletons | Wait for a specific loaded state, not a timeout |
| Ads, chat widgets, maps, video | `mask` them, or hide them with a test stylesheet (`stylePath` option, Playwright 1.41+) |
| OS font rendering | Same container image for local updates and CI |
| Viewport and pixel density | Fixed `viewport` and `deviceScaleFactor` per project |

### Thresholds

| Option | Meaning | Guidance |
| :--- | :--- | :--- |
| `threshold` | Per-pixel colour difference tolerance (0 to 1) | Keep the default unless anti-aliasing noise is proven |
| `maxDiffPixels` | Absolute count of differing pixels allowed | Small components |
| `maxDiffPixelRatio` | Fraction of differing pixels allowed | Full pages; keep it tiny (0.001 or less) |

Set project-wide defaults in `playwright.config.ts` under `expect: { toHaveScreenshot: { ... } }` and override per test only with a comment explaining why.

### Tool choice

| Option | Fits |
| :--- | :--- |
| Playwright snapshots in the repo | Small to medium suites; no external service; baselines reviewed in pull requests |
| Storybook plus Chromatic | Component libraries and design systems; hosted review UI; cross-browser; `npx chromatic` with the project token from CI secrets, `--only-changed` to snapshot only affected stories (verify flags in current docs) |
| Other hosted services (Percy and similar) or self-hosted (Lost Pixel, BackstopJS) | Existing tooling, budget or data-residency constraints |

Hosted services upload screenshots of your UI to a third party: confirm that is acceptable for unreleased or sensitive screens.

### Antigravity tips

Use the browser subagent for a quick manual look at a page or to capture screenshots for a walkthrough artifact, but keep regression baselines in Playwright or the chosen service so they run in CI. When a visual test fails, attach the diff image to the walkthrough so the user can approve or reject the change.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Generate baselines on a laptop, compare in Linux CI | Same container for both | Font rendering differs by OS and fails every run |
| Raise thresholds until flakes stop | Remove the noise source | Large thresholds also hide real regressions |
| `waitForTimeout(2000)` before capture | Wait for a specific element or state | Timing-based waits are both slow and flaky |
| Snapshot every page at every breakpoint | Components for states, few pages for layout | Huge suites get rubber-stamped |
| Auto-update baselines in CI | Human-reviewed update commits | Regressions get accepted silently |
| Snapshot live third-party content | Mask or mock it | Content changes outside your control fail the build |

## Verification checklist

- [ ] Snapshot scope is a list of component states plus a few critical pages.
- [ ] Repeated local runs (10x) produce zero diffs.
- [ ] Baselines are generated in the same container image as CI and committed.
- [ ] Dynamic regions are masked; clock, network and fonts are controlled.
- [ ] Failure reports with diffs are uploaded as CI artifacts.
- [ ] Baseline updates are reviewed by a person and never automated.

## Related

- Workflows: `/e2e`, `/ui-polish`, `/a11y-audit`.
- Knowledge: `browser-automation`, `design-systems`, `react-testing`, `ci-cd-github-actions`, `test-data-management`.
- Agents: `e2e-runner`, `frontend-engineer`.
