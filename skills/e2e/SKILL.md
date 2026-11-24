---
name: e2e
disable-model-invocation: true
description: >-
  Builds and maintains Playwright end-to-end tests for critical user journeys
  with page objects, role-based locators, isolated test data and trace-on-retry
  flake handling, and runs them headed, headless or in CI with artifacts. Use
  when the user asks for E2E, browser or UI flow tests, or when a change alters
  a user-facing journey. Invoke with /e2e.
---

# End-to-End Testing

E2E tests prove that a real user can complete the journeys the business depends on. They are slow and expensive, so keep the suite small, make every test independent, and make every failure diagnosable from its trace.

## When to use

- The user says "E2E", "Playwright", "browser test" or "test the signup/checkout flow".
- A change alters a critical journey: authentication, checkout, onboarding, core create/edit/delete, permissions.
- A bug only reproduces through the UI and needs a regression test.

## When not to use

- Logic a unit or integration test can prove: `/tdd`.
- A one-off exploratory look at a page: use Antigravity's browser subagent directly; no test file is needed.
- Accessibility audits: delegate to the `accessibility-auditor` subagent. Page speed: `web-performance`.
- Automating or scraping third-party sites: `browser-automation`.

## Workflow

1. **Choose the journeys.** List candidate journeys, score each by business impact and change frequency, and keep the top few. Write each as Given/When/Then with the success signal a user would see.

   **Check:** Each journey has one observable success condition, and the whole list runs in a few minutes.

2. **Check the setup.** Run `npx playwright --version`. If Playwright is absent, propose `npm init playwright@latest` and wait for the user's yes, since it adds dependencies, config and example files. Install browsers with `npx playwright install` (add `--with-deps` on Linux CI images). Configure `baseURL`, `webServer`, `trace: 'on-first-retry'`, CI-only retries and `forbidOnly`; see [the config reference](references/playwright-config.md).

   **Check:** `npx playwright test --list` prints the tests without errors.

3. **Explore before writing.** Walk the journey with Antigravity's browser subagent, or record it with `npx playwright codegen <url>`, to learn the real roles, labels and network calls, and capture a screenshot of each state. Exploration output informs the test; it is not the test.

   **Check:** You know the accessible role and name of every element the journey touches.

4. **Model pages, not clicks.** One page object per page or major component. Methods express user intent (`applyCoupon(code)`), locators are role-based, and assertions stay in the tests.

   **Check:** Tests read as user steps, and no selector strings appear in test bodies.

5. **Isolate test data.** Each test creates what it needs through an API, fixture or seed script, with unique values, and never depends on another test's data or on run order. Reuse login through a setup project that saves `storageState`, and keep `playwright/.auth/` gitignored. Never run against production or with real user accounts; credentials for test accounts come from environment variables or CI secrets.

   **Check:** Each test passes when run alone and when the suite runs with several workers.

6. **Write the test, then try to break it.** Run it headed once to watch it, then headless, then hunt for flakes before committing.

   ```bash
   npx playwright test e2e/checkout.spec.ts --headed --project=chromium
   npx playwright test e2e/checkout.spec.ts --repeat-each=10
   ```

   **Check:** 10 of 10 headless repeats pass.

7. **Fix flakes at the cause.** Replace sleeps with web-first assertions (`await expect(locator).toBeVisible()`); wait on a specific response (`page.waitForResponse`) only when the UI gives no signal; use `expect.poll` for eventually consistent backends. Diagnose with the trace: `npx playwright show-trace <path-to-trace.zip>`. If a test must be quarantined, mark it `test.fixme()` with an issue link and tell the user. Raising retries is not a fix.

   **Check:** The suite contains no `waitForTimeout`, and every quarantined test has an issue link.

8. **Wire it into CI.** Run headless, shard when slow (`--shard=1/4`), and upload `playwright-report/` and `test-results/` as artifacts so traces, screenshots and videos can be downloaded after a failure.

   **Check:** A deliberately failing CI run produces a downloadable trace.

Delegate suite-wide runs, flake triage and quarantine bookkeeping to the `e2e-runner` subagent with the journey list and the base URL.

## Page object and test

```ts
// e2e/pages/checkout.page.ts
import type { Locator, Page } from '@playwright/test';

export class CheckoutPage {
  readonly couponInput: Locator;
  readonly applyButton: Locator;
  readonly total: Locator;

  constructor(private readonly page: Page) {
    this.couponInput = page.getByLabel('Coupon code');
    this.applyButton = page.getByRole('button', { name: 'Apply' });
    this.total = page.getByTestId('order-total');
  }

  async goto(): Promise<void> {
    await this.page.goto('/checkout');
  }

  async applyCoupon(code: string): Promise<void> {
    await this.couponInput.fill(code);
    await this.applyButton.click();
  }
}
```

```ts
// e2e/checkout.spec.ts
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { CheckoutPage } from './pages/checkout.page';

test('applies a valid coupon to the order total', async ({ page }) => {
  const code = `E2E-${randomUUID().slice(0, 8)}`;
  // Test-only seed endpoint; page.request shares cookies with the page, so the cart lands in this session.
  await page.request.post('/api/test/seed', { data: { coupon: { code, percentOff: 10 }, cartTotal: 100 } });

  const checkout = new CheckoutPage(page);
  await checkout.goto();
  await checkout.applyCoupon(code);

  await expect(checkout.total).toHaveText('$90.00');
});
```

## Locator priority

| Order | Locator | Use for |
| :--- | :--- | :--- |
| 1 | `getByRole(role, { name })` | Buttons, links, headings, form controls |
| 2 | `getByLabel(text)` | Labelled form fields |
| 3 | `getByPlaceholder` / `getByText` | Unlabelled inputs (report it as an accessibility gap) and static text |
| 4 | `getByTestId(id)` | Dynamic or non-semantic elements; set `testIdAttribute` if the app doesn't use `data-testid` |
| 5 | CSS or XPath | Last resort, with a comment explaining why |

## Commands

| Purpose | Command |
| :--- | :--- |
| All tests, headless | `npx playwright test` |
| Headed, one browser | `npx playwright test --headed --project=chromium` |
| UI mode | `npx playwright test --ui` |
| Step through with the inspector | `npx playwright test --debug` |
| Filter by title | `npx playwright test -g "applies a valid coupon"` |
| Rerun last failures | `npx playwright test --last-failed` |
| Flake hunt | `npx playwright test <file> --repeat-each=10` |
| Force traces on every run | `npx playwright test --trace on` |
| Open the HTML report | `npx playwright show-report` |
| CI shard | `npx playwright test --shard=1/4` |

Commands are identical in PowerShell; only environment variables differ. Bash: `BASE_URL=http://localhost:3000 npx playwright test`. PowerShell: `$env:BASE_URL = "http://localhost:3000"; npx playwright test`.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `page.waitForTimeout(3000)` | Web-first assertions or a specific response | Sleeps are slow and still flaky |
| CSS chains like `.btn-primary > span` | `getByRole('button', { name })` | Styling changes break them; roles track what users see |
| Tests that rely on each other's data | Per-test seeded data with unique values | Order dependence breaks parallel runs |
| Logging in through the UI in every test | A `storageState` setup project | Saves minutes and isolates auth failures |
| Raising retries to hide flakes | Trace, find the cause, `test.fixme()` with an issue if blocked | Retries mask races that real users hit |
| E2E for every edge case | Unit and integration tests for edges, E2E for journeys | Slow suites stop being run |
| Running against production or real accounts | A dedicated test environment and test users | Real data and real users get hurt |

## Verification checklist

- [ ] Each test maps to a named critical journey with one success condition.
- [ ] Locators are role- or label-first, and selectors live only in page objects.
- [ ] Each test seeds its own data and passes in parallel.
- [ ] No arbitrary sleeps; a 10x headless repeat run passes.
- [ ] Trace on first retry, screenshots and video on failure, and artifacts uploaded in CI.
- [ ] Every quarantined test has `test.fixme()` and an issue link, and the user knows about it.

## Related

- Workflows: `/tdd`, `/verify`, `/feature-dev`, `/root-cause`, `/test-coverage`.
- Agents: `e2e-runner`, `accessibility-auditor`, `test-engineer`.
- Knowledge: `browser-automation`, `frontend-react-nextjs`, `accessibility-a11y`, `ci-cd-github-actions`, `web-performance`.
