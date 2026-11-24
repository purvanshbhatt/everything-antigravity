---
name: state-management
disable-model-invocation: true
description: >-
  Chooses and implements client state placement: URL search params, server
  state with TanStack Query (keys, caching, invalidation, optimistic updates),
  client stores (Zustand, Redux Toolkit, Jotai, Pinia, signals), state machines,
  form and component state, plus SSR-safe stores and hydration. Use when
  picking a state library, fixing stale or duplicated data, or refactoring a
  sprawling global store.
---

# State Management

Most "state management" problems are placement problems. Put each piece of
state in the one home that matches its owner and lifetime, and derive
everything else. Server data belongs in a cache, not a store.

## When to use

- Starting a frontend and choosing what goes in the URL, a cache, a store or a component.
- Data is stale after a mutation, or the same entity shows two different values.
- A global store has grown to hold server data, form drafts and UI flags together.
- Adding SSR to an app that uses a client store.

## When not to use

- Form field state and validation: use `forms-validation`.
- Route-level data loading in a router framework: use `react-router-remix`, `frontend-react-nextjs`, `vue-nuxt` or `svelte-kit`.
- Backend caching (Redis, CDN): use `redis-caching` or `cdn-edge-cloudflare`.

## Workflow

1. **Inventory state.** For each piece, write: what it is, who owns the truth (server, URL, user's session, component), who reads and writes it, and how long it lives. Put the table in an artifact for the user.

   **Check:** Every item maps to exactly one home in the placement table below.

2. **Move shareable view state into the URL.** Filters, sort, page, tab and selected id belong in search params so links, reloads and the back button work. Parse and validate params with defaults (zod or a typed helper such as `nuqs` in React).

   **Check:** Copying the URL into a new tab reproduces the same view.

3. **Put server data in a query cache.** Define query keys in one module, set `staleTime` deliberately, and invalidate by key prefix after mutations. TanStack Query v5 example:

   ```ts
   export const projectKeys = {
     all: ['projects'] as const,
     list: (f: Filters) => [...projectKeys.all, 'list', f] as const,
     detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
   };

   export const useProjects = (f: Filters) =>
     useQuery({ queryKey: projectKeys.list(f), queryFn: () => api.listProjects(f), staleTime: 30_000 });

   export function useRenameProject() {
     const qc = useQueryClient();
     return useMutation({
       mutationFn: api.renameProject,
       onMutate: async ({ id, name }: { id: string; name: string }) => {
         await qc.cancelQueries({ queryKey: projectKeys.detail(id) });
         const prev = qc.getQueryData<Project>(projectKeys.detail(id));
         qc.setQueryData<Project>(projectKeys.detail(id), (p) => (p ? { ...p, name } : p));
         return { prev };
       },
       onError: (_e, { id }, ctx) => qc.setQueryData(projectKeys.detail(id), ctx?.prev),
       onSettled: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
     });
   }
   ```

   v5 renamed `cacheTime` to `gcTime` and uses `isPending` for the no-data state; check the installed major (`npm ls @tanstack/react-query`).

   **Check:** After a mutation, every list and detail view of that entity shows the new value with no manual refetch calls.

4. **Keep the client store small.** Only true client state goes in a store: theme, sidebar, multi-step wizard progress, local-only preferences. Read with selectors so components re-render only for their slice.

   ```ts
   type UI = { sidebarOpen: boolean; toggleSidebar: () => void };
   export const useUI = create<UI>()((set) => ({
     sidebarOpen: true,
     toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
   }));
   const open = useUI((s) => s.sidebarOpen); // a selector returning a new object needs useShallow
   ```

   **Check:** `grep_search` the store for API response types; server entities are not stored there.

5. **Model complex flows as state machines.** Checkout, onboarding wizards, media players and upload queues with illegal transitions benefit from XState or a reducer with an explicit `status` union (`'idle' | 'submitting' | 'error' | 'done'`) instead of independent booleans.

   **Check:** Impossible combinations (loading and error at once) cannot be represented.

6. **Make stores SSR-safe.** On the server, create a new store and `QueryClient` per request; never use a module singleton. Dehydrate on the server and hydrate on the client (`HydrationBoundary` for TanStack Query). Provide Zustand stores through context in SSR frameworks.

   **Check:** Two concurrent requests for different users never see each other's data (test with two sessions).

7. **Verify with devtools and tests.** Use TanStack Query Devtools and the store's devtools to watch cache keys and updates. Test invalidation and rollback paths with MSW.

   **Check:** Tests cover optimistic success, failure rollback and invalidation.

## Patterns

### Placement table

| State | Home | Tools |
| :--- | :--- | :--- |
| Shareable view state | URL | Router search params, `nuqs`, Vue Router `query` |
| Server entities and lists | Query cache | TanStack Query (React, Vue, Svelte, Solid, Angular), RTK Query, Pinia Colada, SWR |
| Form drafts and errors | Form library or native form | React Hook Form, TanStack Form, framework actions |
| Ephemeral UI (open, hover) | Component | `useState`, `ref`, `$state`, `signal` |
| Cross-tree client state | Small store or context | Zustand, Jotai, Pinia, Angular signal services, Svelte `.svelte.ts` modules (client only) |
| Multi-step flows | State machine | XState, reducer with a status union |
| Persisted preferences | Store plus storage | Zustand `persist`, VueUse `useStorage`, with versioned migrations |

### Choosing a store

| Need | Pick |
| :--- | :--- |
| Minimal API, selectors, small team | Zustand |
| Strict patterns, middleware, large team, time-travel debugging | Redux Toolkit (plus RTK Query if already on Redux) |
| Fine-grained derived atoms | Jotai |
| Vue | Pinia |
| Angular | Signals in services, or NgRx SignalStore for larger apps |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Copy query results into a store | Read from the cache where needed | Two sources of truth go stale independently |
| Store derived values | Compute with selectors or `computed` | Derived copies drift |
| `isLoading`, `isError`, `isDone` booleans | One `status` union | Prevents impossible states |
| Module-level store on the server | Per-request store | Leaks one user's data to another |
| Put filters in component state | URL search params | Reload and share links lose the view |
| Invalidate everything after every mutation | Invalidate by key prefix | Over-fetching slows the app |

## Verification checklist

- [ ] State inventory exists and each item has one home.
- [ ] Shareable view state round-trips through the URL.
- [ ] Server data lives in a query cache with centralized keys and explicit `staleTime`.
- [ ] Mutations update or invalidate every affected view; rollback is tested.
- [ ] Stores are per-request under SSR.

## Related

- Knowledge: `react-patterns`, `forms-validation`, `vue-nuxt`, `angular`, `svelte-kit`, `react-router-remix`, `frontend-react-nextjs`, `realtime-websockets`.
- Workflows: `/code-review`, `/refactor-clean`.
- Agents: `frontend-engineer`, `react-reviewer`, `code-architect`.
