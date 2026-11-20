# Testing React and Next.js

## Layers

| Layer | Tool | Covers |
| :--- | :--- | :--- |
| Pure logic, hooks, client components | Vitest + Testing Library + jsdom | Rendering, user events, accessible queries |
| Server actions and data functions | Vitest (node environment) with auth and DB mocked | Validation, authorization, revalidation calls |
| Async Server Components, routing, streaming, full flows | Playwright against `next build && next start` | What the user actually sees |

Vitest does not render async Server Components, so test them through Playwright.

## Vitest setup

```bash
npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/user-event @testing-library/jest-dom vite-tsconfig-paths
```

```ts
// vitest.config.mts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: { environment: 'jsdom', setupFiles: ['./vitest.setup.ts'] },
});
```

```ts
// vitest.setup.ts
import '@testing-library/jest-dom/vitest';
```

Add `// @vitest-environment node` at the top of server-action test files.

## Component test

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { Counter } from './counter';

test('increments on click', async () => {
  render(<Counter />);
  await userEvent.click(screen.getByRole('button', { name: /increment/i }));
  expect(screen.getByRole('status')).toHaveTextContent('1');
});
```

Query by role and accessible name first (`getByRole`, `getByLabelText`). A test
that can only find an element by `data-testid` often points at an accessibility gap.

## Server action test

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { project: { create: vi.fn() } } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { createProject } from './actions';

const form = (data: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
};

describe('createProject', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects anonymous callers', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await createProject({}, form({ name: 'x', visibility: 'private' }));
    expect(res.message).toBeDefined();
    expect(db.project.create).not.toHaveBeenCalled();
  });

  it('returns field errors for invalid input', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'u1' } as never);
    const res = await createProject({}, form({ name: '', visibility: 'public' }));
    expect(res.errors?.name).toBeDefined();
    expect(res.errors?.visibility).toBeDefined();
  });
});
```

## Playwright setup

```bash
npm init playwright@latest
npx playwright install --with-deps chromium
```

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

Run against the production build, because the dev server differs in caching,
error overlays and timing. For authenticated flows, use test accounts from the
project's seed or fixture files and a Playwright setup project that saves
`storageState`. Never use real user credentials.
