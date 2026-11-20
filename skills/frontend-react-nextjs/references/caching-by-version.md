# Next.js caching and request APIs by version

Next.js caching semantics changed in 15 and again in 16. This table is a map of
what to look up, not a substitute for the installed version's docs. Always
confirm against `node_modules/next/dist/docs/` (when present) or
nextjs.org/docs with the matching version selected.

## What changed

| Concern | Next 14 | Next 15 | Next 16 |
| :--- | :--- | :--- | :--- |
| `fetch` in Server Components | Cached by default | Not cached by default; opt in with `cache: 'force-cache'` or `next: { revalidate }` | Same as 15 unless Cache Components is enabled; then data is dynamic unless inside `'use cache'` |
| GET route handlers | Static by default | Dynamic by default | Dynamic by default |
| Client router cache for page segments | Reused for a period | Not reused by default (configurable `staleTimes`) | Check the `cacheLife` and router docs |
| `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` | Synchronous | Async (`await`); sync access deprecated | Async only; verify that sync access is gone in your version |
| Request interception file | `middleware.ts` | `middleware.ts` | `proxy.ts` (`middleware.ts` deprecated) |
| Tag invalidation | `revalidateTag(tag)` | `revalidateTag(tag)` | `revalidateTag(tag, profile)`; `updateTag(tag)` in server actions for read-your-writes |
| Function-level caching | `unstable_cache` | `unstable_cache` | `'use cache'` with `cacheLife()` and `cacheTag()` when Cache Components is enabled |
| LCP image hint | `priority` | `priority` | `preload` (`priority` deprecated) |

## Common options (verify names in your version)

```ts
// Time-based revalidation for one request
await fetch(url, { next: { revalidate: 300, tags: ['posts'] } });

// Opt out of caching for one request
await fetch(url, { cache: 'no-store' });

// Route segment config (pages, layouts, route handlers)
export const revalidate = 300;          // seconds
export const dynamic = 'force-dynamic'; // or 'force-static'
```

With Cache Components enabled, some route segment options are not supported;
read the Cache Components guide before mixing them.

### Next 16 function-level cache

```ts
import { cacheLife, cacheTag } from 'next/cache';

export async function getPosts() {
  'use cache';
  cacheLife('hours');
  cacheTag('posts');
  return db.post.findMany({ orderBy: { createdAt: 'desc' } });
}
```

## Invalidation after writes

| Where the write happens | Use |
| :--- | :--- |
| Server action, user must see their own change immediately | `updateTag(tag)` (16) or `revalidatePath(path)` |
| Server action or route handler, brief staleness is fine | `revalidateTag(tag, 'max')` (16) or `revalidateTag(tag)` (14/15) |
| Webhook from a CMS | Route handler that verifies the signature, then `revalidateTag` |
| Client needs fresh Server Component data without a write | `router.refresh()` |

## Debugging the cache

- `next build` prints each route with a symbol for static, dynamic or partially prerendered output. A route you expected to be static that shows as dynamic usually reads `cookies()`, `headers()` or `searchParams`.
- `logging: { fetches: { fullUrl: true } }` in `next.config.*` logs fetch cache hits and misses in development.
- Reproduce caching behaviour with `next build && next start`. The dev server does not cache the same way.
