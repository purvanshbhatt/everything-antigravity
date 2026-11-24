---
name: react-patterns
disable-model-invocation: true
description: >-
  Applies React 19 component patterns: composition over boolean props, rules of
  hooks, effect discipline (derive instead of sync), Suspense and error
  boundaries, Actions with useActionState and useOptimistic, server/client
  component boundaries, and render performance via the React Compiler,
  memoization, transitions and virtualization. Use when writing, refactoring
  or reviewing React components or hooks in any framework.
---

# React Patterns

Write components that compose cleanly, render predictably and keep effects for
real synchronization with the outside world. This skill is framework-agnostic;
Next.js routing, caching and server actions live in `frontend-react-nextjs`.

## When to use

- Designing a component API: props, `children`, slots, compound components, controlled vs uncontrolled.
- An effect causes loops, double fetches, stale closures or flicker.
- Adding Suspense, error boundaries, transitions or optimistic UI.
- Placing `'use client'` in any React Server Components framework.
- An interaction re-renders too much or feels slow.

## When not to use

- Next.js App Router specifics: use `frontend-react-nextjs`.
- Choosing a store or server-state cache: use `state-management`.
- Writing component tests: use `react-testing`.
- Page-load metrics (LCP, CLS): use `web-performance`. React Native: use `react-native-expo`.

## Workflow

1. **Pin versions and lint rules.**

   ```bash
   npm ls react react-dom eslint-plugin-react-hooks   # pnpm why react | yarn why react
   npx eslint . --max-warnings 0
   ```

   Check whether the React Compiler is enabled (`babel-plugin-react-compiler` or a framework flag). Make `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` errors, not warnings. Newer 19.x APIs (for example `<Activity>` and `useEffectEvent`) vary by minor: verify against the current react.dev docs before using them.

   **Check:** You can state the React version, whether the compiler is on, and lint is clean.

2. **Shape the API by composition.** Prefer `children` and small parts over flags (`<Card><Card.Header/>...` beats `<Card showHeader compact bordered>`). Support `value`/`defaultValue`/`onChange` when a component holds state. In React 19, `ref` is a normal prop for function components (no `forwardRef` in new code) and `<Context value={...}>` is the provider.

   **Check:** No component has more than two boolean props that switch layout; each variant is reachable by composing parts.

3. **Audit every effect** with the triage table below. Delete effects that derive data or react to user events; move that logic into render or the event handler.

   **Check:** `grep_search` for `useEffect(` in changed files. Every survivor synchronizes with an external system and returns a cleanup when it subscribes, listens or starts a timer.

4. **Add async boundaries.** Wrap independently loading regions in `<Suspense fallback>`; add an error boundary per region (`react-error-boundary`, or a class with `getDerivedStateFromError`). `use(promise)` must read a promise created outside render (loader, cache, framework); creating it in the same render refetches forever.

   **Check:** With network throttling, the shell paints first and each region shows its own fallback. A forced throw shows the region's error UI, not a blank page.

5. **Model mutations as Actions.** Use `useActionState` for form results, `useFormStatus` for pending buttons, `useOptimistic` for instant feedback and `useTransition` for non-blocking async updates.

   **Check:** Pending state is visible, double submit is impossible, and the optimistic value reverts when the request fails.

6. **Draw the server/client line (RSC frameworks only).** Put `'use client'` on the smallest interactive leaf, pass server-rendered content in as `children`, keep props serializable, and treat every `'use server'` function as a public endpoint that authenticates and validates.

   **Check:** No client module imports database, secret or `server-only` code, and the production build passes.

7. **Measure, then optimize.** Record the slow interaction in React DevTools Profiler. Fix in this order: move state down, lift content up as `children`, split contexts, `useDeferredValue` or `startTransition` for expensive renders, virtualize lists over a few hundred rows (TanStack Virtual), and only then `memo`/`useMemo`/`useCallback` (unnecessary when the compiler is on).

   **Check:** Before/after commit durations are recorded and the slow commit is smaller.

## Patterns

### Effect triage

| You want to | Do | Not |
| :--- | :--- | :--- |
| Compute a value from props or state | Compute during render (`useMemo` only if measured as slow) | Effect plus `setState` |
| Reset state when an id changes | `<Editor key={id} />` | Effect that clears state |
| React to a click or submit | Logic in the event handler | Effect watching a flag |
| Load data | Framework loader, RSC, TanStack Query or `use()` | Raw `fetch` in an effect (races, waterfalls) |
| Read an external store | `useSyncExternalStore` | Effect that copies into state |
| Sync a socket, timer or non-React widget | `useEffect` with cleanup | No cleanup |

### Optimistic toggle

```tsx
import { useOptimistic, useTransition } from 'react';

export function LikeButton({ liked, onToggle }: { liked: boolean; onToggle: (next: boolean) => Promise<void> }) {
  const [optimisticLiked, setOptimisticLiked] = useOptimistic(liked);
  const [isPending, startTransition] = useTransition();

  return (
    <button
      aria-pressed={optimisticLiked}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const next = !optimisticLiked;
          setOptimisticLiked(next);
          await onToggle(next); // when the transition settles, the value falls back to the real `liked` prop
        })
      }
    >
      Like
    </button>
  );
}
```

### Render performance levers

| Symptom in Profiler | Lever |
| :--- | :--- |
| Whole page re-renders on keystroke | Move the input state into its own component |
| Context consumers all re-render | Split the context by update frequency, or use a selector store |
| Expensive child re-renders with same props | Pass it as `children`, or `memo` with stable props |
| Typing lags while a list filters | `useDeferredValue(query)` for the list |
| Thousands of DOM rows | Virtualize |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Store derived values in state | Compute them during render | Two sources of truth drift apart |
| Silence `exhaustive-deps` | Restructure, or move the logic into the event handler | Suppressed deps are stale-closure bugs |
| Define components inside components | Hoist them to module scope | A new type each render remounts the subtree and loses state |
| Use array index as `key` for reorderable lists | Use a stable id | State and focus attach to the wrong row |
| Wrap everything in `useMemo`/`useCallback` | Measure first, or enable the compiler | Adds noise and rarely helps |
| Put `'use client'` on a layout | Push it to the interactive leaf | The whole subtree ships as client JS |

## Verification checklist

- [ ] React version and compiler status are known; hooks lint rules are errors and pass.
- [ ] Every remaining effect synchronizes with something external and cleans up.
- [ ] Loading and failure regions have Suspense and error boundaries.
- [ ] Mutations show pending state and handle failure.
- [ ] Performance changes have before/after Profiler numbers.
- [ ] Tests cover the changed behaviour (see `react-testing`).

## Related

- Knowledge: `frontend-react-nextjs`, `react-testing`, `state-management`, `forms-validation`, `react-router-remix`, `typescript-patterns`, `web-performance`, `accessibility-a11y`.
- Workflows: `/code-review`, `/perf-audit`, `/tdd`.
- Agents: `react-reviewer`, `frontend-engineer`, `performance-optimizer`, `typescript-reviewer`.
