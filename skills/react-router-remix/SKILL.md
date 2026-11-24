---
name: react-router-remix
disable-model-invocation: true
description: >-
  Builds data-driven routes with React Router v7 (framework and data modes) and
  Remix v2: route config, typed loaders and actions, Form and useFetcher,
  pending and optimistic UI, nested layouts, error boundaries, streaming with
  Await, sessions, and upgrading Remix v2 to React Router v7. Use when writing
  or reviewing loaders, actions or route modules, or migrating a Remix app.
---

# React Router v7 and Remix

Let the router own data: loaders read, actions write, and the router
revalidates after every mutation. Forms post to actions so the app works
before JavaScript loads. React Router v7 framework mode is the successor to
Remix v2; the concepts carry over almost one to one.

## When to use

- Adding or changing route modules: `loader`, `action`, `ErrorBoundary`, `meta`.
- Building forms, inline edits or optimistic UI with `<Form>` and `useFetcher`.
- Streaming slow data, or fixing waterfalls and stale data after mutations.
- Upgrading Remix v2 to React Router v7.

## When not to use

- Next.js apps: use `frontend-react-nextjs`.
- Component design and hook discipline: use `react-patterns`.
- Form schema and error UX in general: use `forms-validation`.

## Workflow

1. **Identify the mode and version.**

   ```bash
   npm ls react-router @react-router/dev @remix-run/react
   ```

   Framework mode has `react-router.config.ts` and `app/routes.ts`; data mode uses `createBrowserRouter` with route objects; declarative mode uses `<BrowserRouter>` without loaders. Minor versions add features behind future flags (for example middleware); check the changelog before using one.

   **Check:** You can state the mode, version and whether SSR is on (`ssr` in `react-router.config.ts`).

2. **Declare routes.**

   ```ts
   // app/routes.ts
   import { type RouteConfig, index, layout, prefix, route } from '@react-router/dev/routes';

   export default [
     index('routes/home.tsx'),
     layout('routes/app-layout.tsx', [
       ...prefix('projects', [
         index('routes/projects.tsx'),
         route(':projectId', 'routes/project.tsx'),
       ]),
     ]),
   ] satisfies RouteConfig;
   ```

   To keep Remix-style file routing, return `flatRoutes()` from `@react-router/fs-routes` instead.

   **Check:** `npx react-router typegen` produces `./+types/<route>` modules without errors.

3. **Read in loaders, typed by route.** Authenticate in every loader that needs it: nested loaders run in parallel, so a layout loader's check does not protect child loaders.

   ```tsx
   // app/routes/project.tsx
   import { data, Form, isRouteErrorResponse, useNavigation } from 'react-router';
   import { z } from 'zod';
   import type { Route } from './+types/project';

   const Rename = z.object({ name: z.string().trim().min(1).max(100) });

   export async function loader({ params, request }: Route.LoaderArgs) {
     const user = await requireUser(request);                  // redirects to /login when signed out
     const project = await db.project.find(params.projectId, user.id);
     if (!project) throw data('Project not found', { status: 404 });
     return { project };
   }

   export async function action({ params, request }: Route.ActionArgs) {
     const user = await requireUser(request);
     const parsed = Rename.safeParse(Object.fromEntries(await request.formData()));
     if (!parsed.success) return data({ errors: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
     await db.project.rename(params.projectId, user.id, parsed.data.name);
     return { errors: undefined };
   }

   export default function Project({ loaderData, actionData }: Route.ComponentProps) {
     const busy = useNavigation().state === 'submitting';
     const nameError = actionData?.errors?.name?.[0];
     return (
       <Form method="post">
         <label htmlFor="name">Name</label>
         <input id="name" name="name" defaultValue={loaderData.project.name} aria-invalid={!!nameError} />
         {nameError && <p role="alert">{nameError}</p>}
         <button disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
       </Form>
     );
   }

   export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
     return isRouteErrorResponse(error) ? <h1>{error.status} {error.data}</h1> : <h1>Something went wrong</h1>;
   }
   ```

   **Check:** Signed-out requests to the route and its action are rejected; an unknown id renders the 404 boundary.

4. **Write through actions.** `<Form>` submits and navigates; `useFetcher()` (`fetcher.Form`, `fetcher.submit`) mutates without navigating, for likes, toggles and inline edits. After any action, the router revalidates active loaders; narrow it with `shouldRevalidate` only when measured as wasteful.

   **Check:** After a mutation, every visible view of that data updates without manual refetch code.

5. **Show pending and optimistic state.** Read `useNavigation()` for page-level pending UI; read `fetcher.state` and `fetcher.formData` to render the optimistic value until the action returns.

   **Check:** With network throttled, the UI responds immediately and settles to server truth; errors revert it.

6. **Stream slow, non-critical data.** Await critical data in the loader; return slow data as an un-awaited promise and render it with `<Suspense>` plus `<Await resolve={...}>`.

   **Check:** The page shell renders before the slow section.

7. **Handle sessions safely.** Use `createCookieSessionStorage` with `secrets` from the environment and `httpOnly`, `secure`, `sameSite: 'lax'`. Rotate secrets by prepending a new one to the array.

   **Check:** Session cookies are `HttpOnly` and `Secure` in production responses.

8. **Test and build.** Use `createRoutesStub` from `react-router` for component tests that need loaders or actions, and Playwright for flows.

   ```bash
   npx react-router typegen && npx tsc --noEmit
   npx vitest run && npx playwright test
   npx react-router build
   ```

   **Check:** All are green.

## Patterns

### Migrating Remix v2 to React Router v7

| Step | Action |
| :--- | :--- |
| 1 | On Remix v2, enable each v3 future flag in turn and fix breakages (`v3_fetcherPersist`, `v3_relativeSplatPath`, `v3_throwAbortReason`, `v3_lazyRouteDiscovery`, `v3_singleFetch`; verify the list in the upgrade guide) |
| 2 | Commit; ask the user before the bulk package swap |
| 3 | Replace `@remix-run/*` with `react-router`, `@react-router/node` (or the platform package) and `@react-router/dev`; the official upgrade guide documents a codemod |
| 4 | Swap the Vite plugin for `reactRouter()`; add `app/routes.ts` with `flatRoutes()` to keep file routes |
| 5 | Replace `json()` and `defer()` with plain objects, promises or `data()` |
| 6 | Run typegen, typecheck, tests and a manual pass over forms and redirects |

### Picking a client-side tool

| Need | Use |
| :--- | :--- |
| Data before render | `loader` (server) or `clientLoader` (browser-only data) |
| Write and navigate | `<Form method="post">` |
| Write in place | `useFetcher` |
| SPA without a server | `ssr: false` plus `clientLoader`/`clientAction` and `HydrateFallback` |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `useEffect` + `fetch` for route data | A loader | Waterfalls, no SSR, no revalidation |
| Auth only in the parent layout loader | Check in every loader and action | Loaders run in parallel; children are unprotected |
| `onSubmit` with `preventDefault` and manual fetch | `<Form>` or `fetcher.Form` | Loses progressive enhancement and auto revalidation |
| Hand-written loader types | Generated `Route.*` types | Types drift from the code |
| Returning secrets in loader data | Return only what the UI needs | Loader data is serialized to the client |

## Verification checklist

- [ ] Mode and version known; typegen and typecheck pass.
- [ ] Every loader and action authenticates and authorizes on its own.
- [ ] Actions validate input and return field errors with a 4xx status.
- [ ] Mutations revalidate; pending and optimistic UI behave under throttling.
- [ ] Error boundaries exist for routes that can fail.
- [ ] Tests and `react-router build` pass.

## Related

- Knowledge: `react-patterns`, `forms-validation`, `state-management`, `auth-patterns`, `react-testing`, `vite-bundlers`.
- Workflows: `/framework-migration`, `/e2e`, `/verify`.
- Agents: `react-reviewer`, `frontend-engineer`, `migration-specialist`.
