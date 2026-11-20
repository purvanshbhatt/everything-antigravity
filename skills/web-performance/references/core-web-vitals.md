# Core Web Vitals playbook

Diagnose by phase, then apply the fix that targets the largest phase.

## LCP (Largest Contentful Paint)

| Phase | What it is | Usual causes | Fixes |
| :--- | :--- | :--- | :--- |
| TTFB | Navigation start to first byte of HTML | Slow server rendering, no CDN cache, redirects, cold starts | Cache HTML at the CDN where possible, stream HTML, remove redirects, fix slow queries |
| Resource load delay | First byte to the start of the LCP resource request | Image injected by JS, CSS background image, `loading="lazy"` on the hero, discovered after render-blocking CSS/JS | Put an `<img>` in the initial HTML, `fetchpriority="high"`, `<link rel="preload">` for late-discovered images |
| Resource load duration | Download time of the LCP resource | Oversized image, wrong format, no responsive sizes, slow third-party origin | AVIF/WebP, `srcset` and `sizes`, image CDN, self-host the hero image |
| Element render delay | Resource loaded to element painted | Render-blocking CSS/JS, client-side rendering, hydration before paint, web fonts hiding text | Inline critical CSS, `defer` scripts, server-render the LCP element, `font-display: swap` |

How to find the element: the DevTools Performance panel marks LCP on the
timeline and names the node; Lighthouse lists it under the LCP diagnostic; the
`web-vitals` attribution build reports the element and phase timings.

## INP (Interaction to Next Paint)

INP reports roughly the worst interaction latency on a page (click, tap or key
press, measured until the next frame is painted).

| Phase | Usual causes | Fixes |
| :--- | :--- | :--- |
| Input delay | A long task was already running (hydration, third-party script, timers) | Break up long tasks, defer third parties, reduce hydration cost (fewer client components) |
| Processing time | Heavy event handler, synchronous state updates that re-render large trees | Do the minimum in the handler, then yield; memoise expensive renders; virtualise long lists; `useTransition` for non-urgent updates |
| Presentation delay | Large DOM, expensive style recalculation and layout, layout thrashing | Shrink the DOM, `content-visibility: auto` for off-screen sections, batch reads before writes |

Yielding to the main thread:

```js
async function yieldToMain() {
  if (globalThis.scheduler?.yield) return scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

button.addEventListener('click', async () => {
  showSpinner();          // visible feedback first
  await yieldToMain();    // let the browser paint
  await doExpensiveWork();
});
```

Move CPU-heavy work (parsing, diffing, image processing) to a Web Worker.

How to find the interaction: record in the Performance panel while
reproducing it with CPU throttling, then open the Interactions track; the
`web-vitals` attribution build reports the target element and phases from the field.

## CLS (Cumulative Layout Shift)

| Cause | Fix |
| :--- | :--- |
| Images, video, iframes or ads without dimensions | `width` and `height` attributes, or CSS `aspect-ratio`; reserve ad slots at their largest common size |
| Content injected above existing content (banners, consent bars, "load more") | Reserve space up front, overlay instead of push, or insert below the viewport |
| Web fonts swapping with different metrics | Fallback font metric overrides (`size-adjust`, `ascent-override`, `descent-override`), or `font-display: optional` |
| Animations of `top`, `left`, `width` or `height` | Animate `transform` and `opacity` only |
| Late-loading CSS | Ship critical CSS with the HTML |

Pages that can't use the back/forward cache re-run their full load on back
navigation. Check eligibility in DevTools (Application panel, Back/forward
cache) and remove `unload` handlers and `Cache-Control: no-store` on HTML where
it isn't required.

## DevTools routine

1. Open an incognito window (no extensions), then DevTools and the Performance panel.
2. Set CPU throttling (4x or 6x) and a network preset that matches your users.
3. Record a reload for LCP and CLS, or record while interacting for INP.
4. Read the insights, the LCP marker, the Interactions track and the Layout Shifts track.
5. Save the trace (`.json`) so you can compare before and after.
