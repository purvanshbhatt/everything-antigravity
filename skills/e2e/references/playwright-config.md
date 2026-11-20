# Playwright Configuration Reference

A baseline configuration for `/e2e`: deterministic in CI, debuggable locally. Option names below are from Playwright's `@playwright/test` API; check `npx playwright --version` and the current docs before relying on anything newer.

## playwright.config.ts

```ts
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,          // a stray test.only fails CI instead of silently skipping the suite
  retries: process.env.CI ? 2 : 0,       // retries exist to capture traces, not to hide flakes
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run start',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
```

Notes:

- Add `firefox` and `webkit` projects only for journeys where engine differences have bitten you; each browser multiplies run time.
- If the app uses a test-id attribute other than `data-testid`, set `use.testIdAttribute`.
- Point `webServer.command` at a production-like build (`npm run build && npm run start`) in CI; dev servers hide build-only bugs.

## Authentication setup project

```ts
// e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}: set test-account credentials in the environment or CI secrets`);
  return value;
}

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(requireEnv('E2E_USER_EMAIL'));
  await page.getByLabel('Password').fill(requireEnv('E2E_USER_PASSWORD'));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.context().storageState({ path: authFile });
});
```

Add `playwright/.auth/` to `.gitignore`: the file contains live session cookies. Use dedicated test accounts only, never a real user's credentials.

## Test data

| Approach | Use when | Cleanup |
| :--- | :--- | :--- |
| Test-only seed endpoint (enabled only in test environments) | The app can expose one safely | Endpoint deletes by test prefix, or the database resets per run |
| Playwright fixture calling the public API | The API supports creating the entities | Fixture teardown deletes what it created |
| Database seed script before the run | Large shared reference data (catalogues, plans) | Fresh database per CI run |

Unique values per test (`randomUUID()`, `test.info().workerIndex`) prevent collisions between parallel workers.

## CI (GitHub Actions)

```yaml
# .github/workflows/e2e.yml (check the current major versions of each action before use)
name: e2e
on: [pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
        env:
          E2E_USER_EMAIL: ${{ secrets.E2E_USER_EMAIL }}
          E2E_USER_PASSWORD: ${{ secrets.E2E_USER_PASSWORD }}
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: |
            playwright-report/
            test-results/
          retention-days: 14
```

For long suites, use a matrix over shard indices and pass `--shard=${{ matrix.shard }}/${{ strategy.job-total }}`, then merge the blob reports in a follow-up job (see the Playwright sharding docs for the current merge command).

## Flake triage order

1. Open the trace from the failed retry: `npx playwright show-trace <path-to-trace.zip>`.
2. Look at the action that failed and the DOM snapshot before it: was the element present but disabled, covered, or re-rendered?
3. Check the network tab in the trace for slow or failed requests the UI didn't surface.
4. Reproduce locally with `--repeat-each=20` on that file.
5. Fix the cause (missing web-first assertion, shared data, animation, race in the app). If the race is in the app, it's a product bug: file it.
