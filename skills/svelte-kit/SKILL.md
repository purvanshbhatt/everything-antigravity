---
name: svelte-kit
disable-model-invocation: true
description: >-
  Builds Svelte 5 and SvelteKit apps with runes ($state, $derived, $effect,
  $props, $bindable), snippets, universal vs server load functions, form actions
  with progressive enhancement, hooks and locals, env modules, adapters for
  Node, static and serverless hosts, and Vitest and Playwright tests. Use when
  writing, migrating or reviewing .svelte components or SvelteKit routes.
---

# Svelte 5 and SvelteKit

Use runes for explicit reactivity, keep privileged code in server-only
modules, and build mutations as form actions that work before JavaScript
loads. SvelteKit's file conventions decide where code runs, so choose the
file before writing the code.

## When to use

- Writing or migrating components to Svelte 5 runes and snippets.
- Adding routes, `load` functions, form actions, `+server.ts` endpoints or hooks.
- Picking or configuring an adapter for deployment.
- Debugging state leaking between users, waterfalls, or forms that break without JS.

## When not to use

- Generic form schema and error UX: use `forms-validation`.
- Client vs server state choices across frameworks: use `state-management`.
- Container builds and Cloud Run deploys: use `/dockerize` and `cloud-run`.

## Workflow

1. **Pin versions and migrate deliberately.**

   ```bash
   npm ls svelte @sveltejs/kit
   npx sv migrate svelte-5          # Svelte 4 -> 5 codemod; commit first and review the diff
   npm run check                    # svelte-kit sync && svelte-check in the default template
   ```

   **Check:** You know the Svelte and Kit versions, the adapter in `svelte.config.js`, and `npm run check` passes.

2. **Write components with runes.** `$props()` for inputs, `$state` for local state, `$derived` (or `$derived.by`) for computed values, `$bindable()` for two-way props, and snippets (`{#snippet}` with `{@render}`) instead of slots. Event handlers are attributes: `onclick`, not `on:click`.

   ```svelte
   <script lang="ts">
     type Item = { id: string; name: string };
     let { items, onselect }: { items: Item[]; onselect: (id: string) => void } = $props();
     let query = $state('');
     const filtered = $derived(items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase())));
   </script>

   <label>Filter <input bind:value={query} /></label>
   <ul>
     {#each filtered as item (item.id)}
       <li><button onclick={() => onselect(item.id)}>{item.name}</button></li>
     {/each}
   </ul>
   ```

   **Check:** No `$effect` assigns state that could be a `$derived`; keyed `each` blocks use stable ids.

3. **Keep shared state request-safe.** A `$state` exported from a `.svelte.ts` module is a singleton on the server, shared by every request. Per-user data travels through `load` return values, `event.locals`, or context (`setContext`/`getContext`).

   **Check:** No module-level state holds user-specific data.

4. **Pick the right load file.** `+page.server.ts` runs only on the server (database, secrets, cookies). `+page.ts` is universal (runs on server, then in the browser on navigation) and suits public APIs. Avoid `await parent()` before independent fetches; start them in parallel.

   **Check:** Privileged imports come only from `$lib/server/*` and `$env/static/private` (or `$env/dynamic/private`); the build fails if client code imports them.

5. **Mutate with form actions and `use:enhance`.**

   ```ts
   // src/routes/todos/+page.server.ts
   import { fail, redirect } from '@sveltejs/kit';
   import { z } from 'zod';
   import type { Actions, PageServerLoad } from './$types';
   import { db } from '$lib/server/db';

   const NewTodo = z.object({ title: z.string().trim().min(1).max(200) });

   export const load: PageServerLoad = async ({ locals }) => {
     if (!locals.user) redirect(303, '/login');          // Kit 2: redirect() throws by itself
     return { todos: await db.todo.list(locals.user.id) };
   };

   export const actions = {
     create: async ({ request, locals }) => {
       if (!locals.user) return fail(401, { message: 'Sign in to continue' });
       const parsed = NewTodo.safeParse(Object.fromEntries(await request.formData()));
       if (!parsed.success) return fail(400, { errors: z.flattenError(parsed.error).fieldErrors }); // zod 3: .flatten()
       await db.todo.create(locals.user.id, parsed.data.title);
     },
   } satisfies Actions;
   ```

   In the page: `<form method="POST" action="?/create" use:enhance>` and read results with `let { data, form } = $props();`.

   **Check:** With JavaScript disabled, creating a todo and seeing a validation error both work.

6. **Authenticate in hooks, authorize in handlers.** `src/hooks.server.ts` `handle` resolves the session into `event.locals.user` (typed in `src/app.d.ts`). Every action, server load and `+server.ts` endpoint still checks permissions for the resource it touches.

   **Check:** Tests call actions and endpoints anonymously and as a user without access, and get rejections.

7. **Choose and configure the adapter** (table below). Behind a proxy with `adapter-node`, set `ORIGIN` (or `PROTOCOL_HEADER` and `HOST_HEADER`) or form actions fail the CSRF origin check.

   **Check:** `npm run build && npm run preview` serves the changed routes; deploy only after the user confirms the target.

8. **Test.** Vitest for logic and components (`@testing-library/svelte`, or `vitest-browser-svelte` in browser mode); Playwright for routes, actions and enhancement.

   **Check:** `npx vitest run` and `npx playwright test` are green.

## Patterns

### Adapters

| Target | Adapter | Notes |
| :--- | :--- | :--- |
| Cloud Run, any container or VM | `@sveltejs/adapter-node` | Run `node build`; reads `PORT`; set `ORIGIN` |
| Static hosting, Firebase Hosting, GCS | `@sveltejs/adapter-static` | `export const prerender = true` in root layout; `fallback` for SPA mode |
| Vercel, Netlify, Cloudflare | Platform adapter | Check edge-runtime limits for Node APIs |
| Unsure during prototyping | `adapter-auto` | Replace with an explicit adapter before production |

### File cheat sheet

| File | Runs on | Purpose |
| :--- | :--- | :--- |
| `+page.svelte` | Server (SSR) and client | UI |
| `+page.ts` | Server and client | Universal load (public data) |
| `+page.server.ts` | Server | Server load, form actions |
| `+server.ts` | Server | JSON or other HTTP endpoints |
| `+layout.*` | As above | Shared UI and data for child routes |
| `+error.svelte` | Both | Error UI for the segment |

Newer Kit versions also offer experimental remote functions (`query`, `form`, `command`); check the current docs for their status before adopting them.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `$effect(() => { total = a + b })` | `const total = $derived(a + b)` | Effects run late and can loop |
| User data in module-level `$state` | `locals`, load data or context | Server singletons leak across users |
| `fetch('/api/...')` from `+page.server.ts` to your own endpoint | Call the server function directly | An extra HTTP hop and lost types |
| Secrets in `PUBLIC_` env vars or `+page.ts` | `$env/static/private` in server files | Universal code ships to the browser |
| `on:click` and `<slot>` in new code | `onclick` and snippets | Svelte 5 syntax; legacy mode is deprecated |
| Only client-side validation | Validate in the action with `fail(400, ...)` | Requests can bypass the UI |

## Verification checklist

- [ ] Svelte and Kit versions known; `npm run check` passes.
- [ ] No derived state in effects; no per-user module state.
- [ ] Privileged code lives in server-only modules.
- [ ] Actions validate, authorize and work without JavaScript.
- [ ] Explicit adapter configured; build and preview succeed.
- [ ] Unit and Playwright tests pass.

## Related

- Knowledge: `forms-validation`, `state-management`, `typescript-patterns`, `vite-bundlers`, `cloud-run`, `web-performance`, `auth-patterns`.
- Workflows: `/dockerize`, `/framework-migration`, `/e2e`, `/verify`.
- Agents: `frontend-engineer`, `typescript-reviewer`, `test-engineer`.
