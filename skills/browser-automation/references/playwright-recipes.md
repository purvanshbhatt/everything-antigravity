# Playwright recipes

For turning browser checks into repeatable tests. Check option names against
the Playwright version in `package.json` (`npx playwright --version`).

## Setup

```bash
npm init playwright@latest              # scaffolds config, an example test and a CI workflow
npx playwright install --with-deps chromium
```

Python: `pip install pytest-playwright`, then `playwright install chromium`.

## Config with evidence on failure

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
```

## Locators and waiting

Prefer, in order: `getByRole`, `getByLabel`, `getByPlaceholder`, `getByText`,
then `getByTestId`. Use web-first assertions that retry until a timeout:

```ts
await page.getByRole('button', { name: 'Save' }).click();
await expect(page.getByRole('status')).toHaveText('Saved');
```

Never use `page.waitForTimeout` in tests; wait for an element, a URL
(`expect(page).toHaveURL(...)`) or a response (`page.waitForResponse(...)`).

## Visual regression

```ts
test('pricing page matches the baseline', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page).toHaveScreenshot('pricing.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.01,
    mask: [page.getByTestId('last-updated')],   // hide volatile content
  });
});
```

```bash
npx playwright test --update-snapshots     # create or refresh baselines after an intended change
```

Screenshots differ across operating systems, fonts and browser versions.
Generate and compare baselines in the same environment as CI (for example the
official Playwright Docker image matching your Playwright version), and review
every baseline update like code.

## Signing in with test accounts

The test reads credentials for a dedicated test account from environment
variables or the project's seed data on a local or staging host. The agent
never types real user credentials, and real accounts are never used.

```ts
// e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';   // add playwright/.auth to .gitignore

setup('sign in as the seeded test user', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL ?? '');
  await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.context().storageState({ path: authFile });
});
```

In the config, add a `setup` project (`testMatch: /.*\.setup\.ts/`) and give
the other projects `storageState: 'playwright/.auth/user.json'` and
`dependencies: ['setup']`.

## Network control

```ts
// Stub an API response
await page.route('**/api/items', (route) => route.fulfill({ json: [{ id: 1, name: 'Alpha' }] }));

// Simulate a failure
await page.route('**/api/items', (route) => route.abort());

// Simulate a slow backend to see loading states
await page.route('**/api/items', async (route) => {
  await new Promise((r) => setTimeout(r, 2000));
  await route.continue();
});
```

## Emulation

| Need | Option |
| :--- | :--- |
| Phone or tablet | `devices['iPhone 13']`, `devices['Pixel 7']` |
| Dark mode | `colorScheme: 'dark'` |
| Reduced motion | `reducedMotion: 'reduce'` |
| Locale and time zone | `locale: 'de-DE'`, `timezoneId: 'Europe/Berlin'` |
| Offline | `await context.setOffline(true)` |

## Debugging

```bash
npx playwright test --ui                  # interactive runner with time travel
npx playwright test --headed -g "checkout"
npx playwright test --debug               # step through with the inspector
npx playwright show-report
npx playwright show-trace path/to/trace.zip
npx playwright codegen http://localhost:3000   # record locators, then clean them up by hand
```

Python equivalents: `pytest --headed --browser chromium`,
`--tracing retain-on-failure`, `--video retain-on-failure` and
`--screenshot only-on-failure`.

## Recording outside the test runner

```ts
const context = await browser.newContext({ recordVideo: { dir: 'artifacts/video' } });
// ... drive the page ...
await context.close();   // the video file is written when the context closes
```

## Flake checklist

- Each test creates its own data, or resets state; no ordering dependencies.
- No fixed sleeps; only web-first assertions and explicit waits on events.
- Retries only in CI, and any test that needed a retry is investigated, not ignored.
- Third-party scripts are stubbed or blocked in tests where they add noise.
