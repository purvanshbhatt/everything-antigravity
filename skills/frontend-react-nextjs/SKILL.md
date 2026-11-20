---
name: frontend-react-nextjs
description: >-
  Builds and reviews React 19 and Next.js App Router code: server and client
  component boundaries, data fetching and caching, zod-validated server
  actions, Suspense streaming, forms, state placement, styling, error and
  loading boundaries, image and font optimization, and Vitest, Testing Library
  and Playwright tests. Use when adding or changing pages, layouts, components,
  route handlers or server actions in a Next.js app.
---

# React and Next.js (App Router)

Ship App Router code that renders on the server by default, sends the least
JavaScript possible, and treats every server action as a public endpoint.
Next.js changes caching and request APIs between majors, so pin behaviour to
the installed version before writing a line.

## When to use

- Creating or changing `app/` routes: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts`.
- Deciding where `'use client'` goes, or fixing boundary errors and hydration mismatches.
- Adding a mutation (form or button) through a server action, plus revalidation after the write.
- Choosing where state lives: URL, server, TanStack Query or component.
- Writing component, server-action or end-to-end tests for a React or Next.js UI.

## When not to use

- Pages Router-only apps (`pages/`, `getServerSideProps`): follow the project's existing patterns and the Pages Router docs.
- Slow LCP, INP or CLS: use `web-performance` or the `performance-optimizer` agent.
- Accessibility audits: use `accessibility-a11y` or the `accessibility-auditor` agent.
- Login, sessions and tokens: use `auth-patterns`. API contract design: use `api-design`.
- Building a full E2E suite: use `/e2e`.

## Workflow

1. **Pin the version and the house style.**

   ```bash
   npm ls next react react-dom      # pnpm why next | yarn why next | bun pm ls
   ```

   Read `next.config.*`, `tsconfig.json`, `app/layout.tsx` and one existing route of the same kind. If `node_modules/next/dist/docs/` exists (recent versions bundle version-matched docs there), read the relevant page before coding; otherwise use nextjs.org/docs with its version selector. Known breaks to watch: Next 15 made `params`, `searchParams`, `cookies()` and `headers()` async; Next 16 renamed `middleware.ts` to `proxy.ts`, wants a profile argument on `revalidateTag`, and deprecated the `next/image` `priority` prop in favour of `preload`. Details: [caching by version](references/caching-by-version.md).

   **Check:** You can state the Next.js and React majors, the package manager, and the caching model in use (defaults, `fetch` options, or Cache Components with `'use cache'`).

2. **Draw the server/client boundary first.** Server Components are the default. Add `'use client'` only to the smallest leaf that needs state, effects, event handlers, browser APIs or a client-only library. Keep layouts and pages on the server and pass server-rendered content into client components as `children`. Start every module that touches secrets, the database or privileged logic with `import 'server-only'`.

   **Check:** `grep_search` for `'use client'` in the changed files; each one has a reason. No client module imports a DB client, a secret or a `server-only` module. Props that cross the boundary are serializable (no functions other than server actions, no class instances).

3. **Fetch on the server, in parallel, near the consumer.** Use async Server Components and call data functions directly (never `fetch` your own route handler from the server). Start independent requests together with `Promise.all`, or put them behind separate `<Suspense>` boundaries; sequential `await`s create waterfalls. Wrap a data function in React `cache()` when several components need it in one request. Choose caching per source on purpose: static, time-revalidated, tagged, or dynamic.

   **Check:** For each read you can say whether it is cached, what revalidates it, and which tag or path invalidates it.

4. **Mutate through validated server actions.** Authenticate and authorize inside every action, validate with zod `safeParse`, return field errors as state, then revalidate. See the pattern below.

   **Check:** Tests show the action rejects an anonymous caller, a caller without permission, and invalid input. `next build` passes.

5. **Stream and contain failures.** Add `loading.tsx` for route-level skeletons and `<Suspense fallback>` around slow, independent sections. Add `error.tsx` (it must be a Client Component) for each segment that can fail on its own, `not-found.tsx` with `notFound()`, and `global-error.tsx` at the root.

   **Check:** With network throttling on, the shell renders before slow data. A forced `throw` shows the segment's error UI, and its retry works.

6. **Optimise images and fonts.** Use `next/image` with `width`/`height`, or `fill` plus `sizes`. Mark only the LCP image with `preload` (Next 16+) or `priority` (15 and earlier). Allow remote hosts in `images.remotePatterns`. Load fonts with `next/font` (with a `variable` for Tailwind); don't add `<link>` tags to font CDNs.

   **Check:** Lighthouse reports no unsized images and no font-driven layout shift.

7. **Test at the right layer.** Use Vitest with Testing Library for client components and pure logic. Unit-test server actions as plain async functions with auth and DB mocked. Use Playwright for async Server Components and whole flows, because Vitest doesn't render async Server Components. Setup: [testing](references/testing.md).

   ```bash
   npx vitest run
   npx playwright test
   npx next build        # type-checks and catches boundary errors
   ```

   **Check:** All three are green, and new behaviour has a test that failed before the change.

## Patterns

### State placement

| State | Home | Tooling |
| :--- | :--- | :--- |
| Filters, tabs, pagination, search text (shareable) | URL | `searchParams` prop in pages; `useSearchParams` with `router.replace` in client code, or `nuqs` |
| Server-owned data shown on navigation | Server Components | async reads plus explicit caching and revalidation |
| Server data with polling, infinite scroll, refetch-on-focus or optimistic cache | TanStack Query | `useQuery`/`useMutation`, seeded from server data |
| Form pending state and errors | React | `useActionState`, `useFormStatus`, `useOptimistic` |
| Ephemeral UI (open, hover, draft input) | Component | `useState`, `useReducer` |
| Cross-tree client state (theme, wizard draft) | Context or a small store such as Zustand | Keep server data out of it |

### Server action with validation

```ts
// app/projects/actions.ts
'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

const CreateProject = z.object({
  name: z.string().trim().min(1).max(100),
  visibility: z.enum(['private', 'team']),
});

export type FormState = { errors?: Record<string, string[] | undefined>; message?: string };

export async function createProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();                       // never trust ids sent by the client
  if (!session) return { message: 'Sign in to continue.' };

  const parsed = CreateProject.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors }; // zod 3: parsed.error.flatten().fieldErrors

  const project = await db.project.create({ data: { ...parsed.data, ownerId: session.userId } });
  revalidatePath('/projects');
  redirect(`/projects/${project.id}`);                      // throws by design: keep it outside try/catch
}
```

```tsx
// app/projects/new/project-form.tsx
'use client';
import { useActionState } from 'react';
import { createProject, type FormState } from '../actions';

export function ProjectForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createProject, {});
  const nameError = state.errors?.name?.[0];
  return (
    <form action={formAction}>
      <label htmlFor="name">Name</label>
      <input id="name" name="name" required aria-invalid={!!nameError}
             aria-describedby={nameError ? 'name-error' : undefined} />
      {nameError && <p id="name-error">{nameError}</p>}
      <select name="visibility" defaultValue="private" aria-label="Visibility">
        <option value="private">Private</option>
        <option value="team">Team</option>
      </select>
      {state.message && <p role="alert">{state.message}</p>}
      <button type="submit" disabled={pending}>{pending ? 'Creating...' : 'Create'}</button>
    </form>
  );
}
```

### Styling

- **Tailwind CSS v4:** CSS-first config (`@import "tailwindcss";` plus `@theme` tokens). v3 uses `tailwind.config.*`; check `package.json` first.
- **CSS Modules** (`*.module.css`) for scoped styles with no runtime cost. Avoid runtime CSS-in-JS that needs client providers in Server Component trees.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Put `'use client'` on a page or layout | Push it down to the interactive leaf | The whole subtree ships as JS and loses server data access |
| Read `userId` or `role` from form fields | Derive identity from the session inside the action | Server actions are public POST endpoints |
| Put secrets in `NEXT_PUBLIC_*` variables | Use server-only env vars behind `import 'server-only'` | `NEXT_PUBLIC_` values are inlined into the client bundle |
| Fetch initial data in `useEffect` | Read in a Server Component, or use TanStack Query | Waterfalls, no streaming, race conditions |
| Call `redirect()` inside `try/catch` | Call it after the `try` block | It works by throwing; the `catch` swallows it |
| Render `Date.now()`, random values or locale formats in client markup | Compute on the server or after mount | Server and client HTML differ, causing hydration errors |
| Copy caching advice from old posts | Read the installed version's docs | Defaults changed in Next 15 and again in 16 |

## Verification checklist

- [ ] The Next.js and React versions are known, and the code uses that version's APIs.
- [ ] Every `'use client'` is justified; nothing privileged is importable from client code.
- [ ] Every server action authenticates, authorizes, validates with zod and has negative tests.
- [ ] Each read has a stated caching and revalidation strategy, and writes invalidate it.
- [ ] Loading, error and not-found states exist for new segments.
- [ ] `vitest run`, `playwright test` and `next build` pass.

## Related

- Workflows: `/feature-dev`, `/tdd`, `/e2e`, `/verify`, `/code-review`.
- Knowledge: `web-performance`, `accessibility-a11y`, `auth-patterns`, `api-design`, `tdd-testing`, `browser-automation`.
- Agents: `typescript-reviewer`, `performance-optimizer`, `accessibility-auditor`, `e2e-runner`, `test-engineer`.
