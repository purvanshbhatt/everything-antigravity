---
trigger: glob
globs: "**/*.tsx, **/*.jsx"
description: React component and hooks conventions
---

# React

TypeScript rules still apply to `.tsx`; this file adds React-specific constraints.

## Components

- Function components only. One exported component per file, named in `PascalCase` to match the file, unless the project groups small components.
- Keep components small and pure: same props and state give the same output. No side effects, network calls or mutations during render.
- Never define a component inside another component; hoist it so its state is not reset on every render.
- Compose with `children` and props before context. Use context for rarely changing, widely needed values (theme, auth, locale).
- Type props explicitly. Do not spread unknown props onto DOM elements.

## Hooks

- Follow the Rules of Hooks: call hooks only at the top level of components and custom hooks, never in loops, conditions or after early returns.
- Keep `eslint-plugin-react-hooks` on with `exhaustive-deps`. Never silence it; restructure instead (move functions inside the effect, use `useCallback`, or use an effect event where supported).
- Extract reusable stateful logic into custom hooks named `useX`.

## State and effects

- Derive values during render instead of storing them in state. Do not mirror props into state.
- Use effects only to synchronise with external systems (subscriptions, timers, non-React widgets, manual DOM). Always return a cleanup.
- Fetch data with the framework's loaders, Server Components or a query library (TanStack Query, SWR), not ad hoc `useEffect` fetching. If you must fetch in an effect, handle aborts and races.
- Keep server data in the query cache, URL state in the URL, form state in the form library, and local UI state local.
- Update state immutably. Use the updater form (`setCount(c => c + 1)`) when the next value depends on the previous one.

## Rendering and performance

- Use stable, unique keys from data. Never use array indexes as keys for lists that reorder, insert or delete.
- Measure before memoizing. Use `useMemo`, `useCallback` and `memo` for proven hot spots, not by default.
- Virtualize long lists. Lazy-load heavy routes and components with `lazy` and `Suspense`.
- Wrap independent regions in error boundaries and give every `Suspense` a meaningful fallback.

## Server and client boundaries

- In frameworks with Server Components, keep `'use client'` as low in the tree as possible and pass only serializable props across it.
- Never import server-only modules, secrets or database clients into client components. Only intentionally public values use public env prefixes (`NEXT_PUBLIC_`, `VITE_`).
- Avoid hydration mismatches: no `Date.now()`, `Math.random()`, `window` or locale-dependent formatting during the server render.
- Validate input and authorize inside every server action or route handler.

## Security and accessibility

- Never pass untrusted data to `dangerouslySetInnerHTML`; sanitize with DOMPurify if HTML is unavoidable. Reject `javascript:` URLs in user-supplied links.
- Use semantic elements (`button`, `a`, `label`, headings) before ARIA. Every input has a label, every image has `alt`, and focus moves predictably after dialogs and route changes.

## Tests

- Test behaviour with Testing Library: query by role, label and text, interact with `user-event`, and mock the network at the boundary (MSW).
- No snapshot-only tests and no assertions on internal state or implementation details.
