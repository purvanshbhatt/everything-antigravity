---
name: vue-nuxt
description: >-
  Builds Vue 3 and Nuxt apps with the Composition API and script setup,
  composables, Pinia stores, Nuxt file-based routing, useFetch and useAsyncData,
  validated server routes, runtime config, SSR-safe state and hydration, and
  Vitest with Vue Test Utils or @nuxt/test-utils. Use when writing, reviewing or
  debugging .vue components, Pinia stores, or Nuxt pages, middleware, plugins
  and server/api routes.
---

# Vue 3 and Nuxt

Write Vue with `<script setup>` and composables, keep server data flowing
through Nuxt's SSR-aware fetchers, and never let per-request state leak into
module scope. Nuxt changes directory and data-fetching defaults between
majors, so read the installed version first.

## When to use

- Creating or refactoring `.vue` components, composables or Pinia stores.
- Adding Nuxt pages, layouts, route middleware, plugins or `server/api` handlers.
- Fixing reactivity loss, hydration mismatches, double fetches or leaked state between users.
- Writing unit or component tests for Vue or Nuxt code.

## When not to use

- Choosing between URL, server-cache and store state in general: use `state-management`.
- Form schema and error UX: use `forms-validation`. Styling systems: use `tailwind-css` or `css-architecture`.
- Upgrading Vue 2 or Nuxt 2/3 to a new major: use `/framework-migration`.
- Page-speed work: use `web-performance`.

## Workflow

1. **Pin versions and layout.**

   ```bash
   npm ls vue nuxt pinia vue-router
   npx nuxi info
   ```

   Nuxt 4 defaults `srcDir` to `app/` (pages, components, composables under `app/`, with `server/` at the root); Nuxt 3 projects keep them at the root. Verify against the current nuxt.com docs for your major.

   **Check:** You can name the Vue and Nuxt versions, the source directory, and whether SSR is on (`ssr` in `nuxt.config.ts`).

2. **Write components with `<script setup lang="ts">`.** Type props with `defineProps<{...}>()`, events with `defineEmits<{ save: [id: string] }>()`, and two-way bindings with `defineModel()` (Vue 3.4+). Destructured props stay reactive from Vue 3.5; on older versions use `props.x` or `toRefs`.

   **Check:** `npx nuxi typecheck` (Nuxt) or `npx vue-tsc --noEmit` (plain Vue) passes.

3. **Respect reactivity rules.** Default to `ref`. A `reactive` object loses reactivity when destructured or reassigned; use `toRefs` or `storeToRefs`. Use `computed` for derived values and `watch` with explicit sources for side effects; register cleanup with `onWatcherCleanup` (3.5+) or the `onCleanup` argument.

   **Check:** `grep_search` for `watch(` and `watchEffect(` in changed files; none of them only copies one ref into another.

4. **Extract composables for reusable logic.** Name them `useX`, call them synchronously at the top of `setup`, return refs. In SSR, module-level `ref`s are shared by every request: use Nuxt `useState('key', () => init)` or a Pinia store instead.

   **Check:** No composable or module holds user-specific data at module scope.

5. **Fetch data the SSR way.** In components, `useFetch` or `useAsyncData` run on the server, dedupe, and transfer the payload to the client. In event handlers, call `$fetch`. Pass reactive `query` to refetch on change, `pick` or `transform` to shrink the payload, and `lazy: true` for non-critical data.

   **Check:** The Network tab shows no duplicate client refetch of data the server already rendered.

6. **Validate server routes.** Every `server/api` handler authenticates and validates its own input; route middleware only guards navigation.

   ```ts
   // server/api/projects.get.ts
   import { z } from 'zod';
   const Query = z.object({ page: z.coerce.number().int().min(1).default(1) });

   export default defineEventHandler(async (event) => {
     const user = await requireUser(event);               // your auth helper; throws 401
     const { page } = await getValidatedQuery(event, Query.parse);
     return listProjects(user.id, page);
   });
   ```

   **Check:** Tests hit the route unauthenticated and with bad input, and get 401 and 400.

7. **Configure secrets correctly.** Declare `runtimeConfig: { apiSecret: '', public: { apiBase: '' } }` and override with `NUXT_API_SECRET` and `NUXT_PUBLIC_API_BASE`. Only `public` keys reach the browser.

   **Check:** `grep_search` the client build output (`.output/public`) for a secret's value returns nothing.

8. **Test at the right layer.** Use Vitest with `@vue/test-utils` `mount` for plain components; `@nuxt/test-utils` with the `nuxt` environment and `mountSuspended` for components using Nuxt composables; Playwright for flows.

   ```bash
   npx vitest run
   npx nuxi build && npx nuxi preview
   ```

   **Check:** Tests pass and the production build renders the changed pages without hydration warnings in the console.

## Patterns

### Pinia setup store

```ts
// stores/cart.ts
export const useCartStore = defineStore('cart', () => {
  const items = ref<{ id: string; priceCents: number; qty: number }[]>([]);
  const totalCents = computed(() => items.value.reduce((s, i) => s + i.priceCents * i.qty, 0));
  function add(id: string, priceCents: number) {
    const hit = items.value.find((i) => i.id === id);
    hit ? hit.qty++ : items.value.push({ id, priceCents, qty: 1 });
  }
  return { items, totalCents, add };
});

// in a component
const cart = useCartStore();
const { items, totalCents } = storeToRefs(cart); // actions stay on `cart`
```

### Fetcher choice

| Situation | Use |
| :--- | :--- |
| Data needed to render the page | `useFetch('/api/x')` or `useAsyncData('key', fn)` |
| Click, submit or other user action | `$fetch` inside the handler |
| Client-only data (browser APIs, personalized widgets) | `useFetch(..., { server: false })` or `<ClientOnly>` |
| Shared SSR-safe state across components | `useState` or Pinia |

### Hydration mismatch sources

`Date.now()`, `Math.random()`, locale-dependent formatting without a fixed locale, `window` checks during render, and invalid HTML nesting. Move browser-only logic to `onMounted`, wrap widgets in `<ClientOnly>`, and use `useId()` for generated ids.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Destructure a `reactive` object or store | `toRefs` / `storeToRefs` | Destructured values lose reactivity |
| Call `$fetch` at the top of `setup` | `useFetch` / `useAsyncData` | `$fetch` runs on server and client, fetching twice |
| Put secrets in `runtimeConfig.public` | Private `runtimeConfig` keys | Public config is serialized into the page |
| Rely on route middleware for API security | Authorize inside each server handler | Server routes are callable directly |
| Mutate props | Emit an event or use `defineModel` | One-way data flow keeps ownership clear |
| Module-level `ref` holding user data | `useState` or Pinia | Shared across SSR requests |

## Verification checklist

- [ ] Vue and Nuxt versions and the source directory are known.
- [ ] Typecheck passes (`nuxi typecheck` or `vue-tsc --noEmit`).
- [ ] No per-user state at module scope; secrets only in private runtime config.
- [ ] Server routes authenticate and validate input, with negative tests.
- [ ] No duplicate fetches and no hydration warnings in the production build.

## Related

- Knowledge: `state-management`, `forms-validation`, `tailwind-css`, `vite-bundlers`, `typescript-patterns`, `web-performance`, `accessibility-a11y`.
- Workflows: `/framework-migration`, `/e2e`, `/verify`.
- Agents: `frontend-engineer`, `typescript-reviewer`, `test-engineer`.
