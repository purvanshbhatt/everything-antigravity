---
name: react-testing
description: >-
  Tests React components the way users use them with React Testing Library,
  Vitest or Jest, user-event and MSW: role-based queries, async UI, network
  mocking at the HTTP layer, provider wrappers, hooks and axe accessibility
  checks, while avoiding implementation-detail and snapshot-heavy tests. Use
  when writing, fixing or reviewing component tests, or stabilizing a flaky
  React test suite.
---

# React Testing

Tests should fail when users would notice a bug and pass through refactors
that users would not notice. Query by role and label, drive with real events,
and mock the network, not your own modules.

## When to use

- Adding tests for a new or changed component, hook or form.
- A test suite is flaky, slow, or breaks on every refactor.
- Setting up Vitest or Jest with Testing Library and MSW in a React project.
- Reviewing tests that assert on state, props or snapshots.

## When not to use

- Full user journeys across pages: use `/e2e` and the `e2e-runner` agent.
- Pixel-level regressions: use `visual-regression`.
- Async Server Components: unit test their data functions and cover the page with Playwright (see `frontend-react-nextjs`).
- General test strategy and TDD loop: use `tdd-testing` or `/tdd`.

## Workflow

1. **Detect the runner and set up once.** Look for `vitest.config.*` or a `test` block in `vite.config.*`, else `jest.config.*`. For a Vite project:

   ```bash
   npm i -D vitest jsdom @testing-library/react @testing-library/dom @testing-library/user-event @testing-library/jest-dom msw
   ```

   ```ts
   // vitest.config.ts
   import { defineConfig } from 'vitest/config';
   import react from '@vitejs/plugin-react';
   export default defineConfig({
     plugins: [react()],
     test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] },
   });
   ```

   ```ts
   // src/test/setup.ts
   import '@testing-library/jest-dom/vitest';
   import { afterAll, afterEach, beforeAll } from 'vitest';
   import { cleanup } from '@testing-library/react';
   import { server } from './msw-server';

   beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
   afterEach(() => { cleanup(); server.resetHandlers(); }); // explicit cleanup: Vitest globals are off
   afterAll(() => server.close());
   ```

   **Check:** `npx vitest run` executes a smoke test; an unmocked request fails loudly.

2. **Write the test from the user's side.** Arrange with `render`, act with `userEvent.setup()`, assert on what is visible or announced. Use the query priority table below.

   **Check:** The test contains no `container.querySelector`, no state or prop inspection, and no component internals.

3. **Mock the network with MSW**, not `fetch`, `axios` or your API module. Keep default happy-path handlers in `msw-server.ts`; override per test with `server.use(...)` for errors, empty states and slow responses.

   ```ts
   // src/test/msw-server.ts
   import { setupServer } from 'msw/node';
   import { http, HttpResponse } from 'msw';
   export const server = setupServer(http.get('/api/todos', () => HttpResponse.json([])));
   ```

   **Check:** Each component that fetches has tests for success, empty, error and (if it shows one) loading.

4. **Handle async correctly.** Use `await screen.findBy...` for things that appear, `waitForElementToBeRemoved` for spinners, and `waitFor` with one assertion inside. Never `setTimeout` sleeps. With fake timers, pass them to user-event: `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`.

   **Check:** No "not wrapped in act(...)" warnings; each one means the test ended before the UI settled, so await the resulting UI.

5. **Wrap providers once.** Create `renderWithProviders` that mounts router (`MemoryRouter` or a routes stub), a fresh `QueryClient` per test with `retry: false`, theme and i18n. Never share a QueryClient across tests.

   **Check:** Tests do not leak cache or route state; running a single file alone and the full suite give the same result.

6. **Check accessibility in the same tests.** Add `vitest-axe` or `jest-axe` and assert no violations on key states (default, error, open dialog). jsdom cannot compute colour contrast, so keep contrast for browser audits.

   **Check:** Axe passes, and every interactive element was found by role with an accessible name.

7. **De-flake before merging.** Run the suspect file repeatedly:

   ```bash
   for i in $(seq 20); do npx vitest run src/features/todos || break; done
   ```

   ```powershell
   1..20 | ForEach-Object { npx vitest run src/features/todos; if ($LASTEXITCODE -ne 0) { break } }
   ```

   **Check:** 20 consecutive passes; the root cause (shared state, real timers, unawaited UI, test order) is fixed rather than retried.

## Patterns

### Query priority

| Priority | Query | Use for |
| :--- | :--- | :--- |
| 1 | `getByRole('button', { name: /save/i })` | Almost everything interactive or structural |
| 2 | `getByLabelText('Email')` | Form fields |
| 3 | `getByPlaceholderText`, `getByText`, `getByDisplayValue` | Non-interactive text, filled values |
| 4 | `getByAltText`, `getByTitle` | Images, titled elements |
| 5 | `getByTestId` | Last resort when no accessible handle exists (and consider fixing the markup) |

`getBy` throws if absent, `queryBy` returns `null` (use for asserting absence), `findBy` waits.

### Behaviour test with an error path

```tsx
import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw-server';
import { TodoList } from './TodoList';

test('adds a todo, then shows the server error when the quota is hit', async () => {
  const user = userEvent.setup();
  server.use(http.post('/api/todos', () => HttpResponse.json({ id: '1', title: 'Buy milk' }, { status: 201 })));
  render(<TodoList />);

  await user.type(screen.getByRole('textbox', { name: /new todo/i }), 'Buy milk');
  await user.click(screen.getByRole('button', { name: /add/i }));
  expect(await screen.findByText('Buy milk')).toBeInTheDocument();

  server.use(http.post('/api/todos', () => HttpResponse.json({ message: 'Quota exceeded' }, { status: 429 })));
  await user.type(screen.getByRole('textbox', { name: /new todo/i }), 'Walk dog');
  await user.click(screen.getByRole('button', { name: /add/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Quota exceeded');
});
```

### Hooks

Test a hook through a small component when possible. For reusable hooks, use `renderHook` from `@testing-library/react` with the same provider wrapper, and drive updates inside `act`.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `fireEvent.change` for typing | `await user.type(...)` | user-event fires the full focus, key and input sequence |
| Mock your own API client module | Mock HTTP with MSW | Module mocks hide serialization, URL and status bugs |
| Large `toMatchSnapshot()` of DOM | Assert specific visible outcomes | Snapshots get re-approved blindly |
| `await new Promise(r => setTimeout(r, 500))` | `findBy*` or `waitFor` | Sleeps are slow and still flaky |
| Assert `setState` calls or hook internals | Assert what the user sees | Refactors break tests with no behaviour change |
| Many assertions inside one `waitFor` | One assertion in `waitFor`, the rest after | Retries hide which condition failed and slow failures |

## Verification checklist

- [ ] Setup has explicit cleanup, MSW with `onUnhandledRequest: 'error'`, and jest-dom matchers.
- [ ] Queries are role- or label-first; `getByTestId` is rare and justified.
- [ ] Success, empty, error and loading states are covered for data-driven components.
- [ ] No sleeps, no act warnings, and the suspect files pass 20 runs in a row.
- [ ] Axe checks run on key states.
- [ ] `npx vitest run` (or `npx jest`) is green locally and in CI.

## Related

- Knowledge: `react-patterns`, `tdd-testing`, `forms-validation`, `accessibility-a11y`, `visual-regression`, `api-testing`, `frontend-react-nextjs`.
- Workflows: `/tdd`, `/test-coverage`, `/e2e`, `/verify`.
- Agents: `test-engineer`, `e2e-runner`, `react-reviewer`.
