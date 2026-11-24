---
name: svg-graphics
disable-model-invocation: true
description: >-
  Authors and ships SVG: hand-written icons on a viewBox grid with
  currentColor, path command basics, SVGO optimization that keeps viewBox and
  IDs, inline versus img versus sprite delivery with symbol and use, CSS
  animation with reduced-motion support, accessible titles and roles, and
  sanitizing untrusted SVG uploads. Use when creating icons or illustrations,
  shrinking exported SVG, animating SVG, or rendering user-supplied SVG.
---

# SVG Graphics

SVG is code: small, styleable, scalable and scriptable. Author on a consistent
grid, inherit colour from CSS, optimize without breaking references, give
meaningful graphics a name and hide decorative ones, and never trust SVG from
users.

## When to use

- Creating an icon set or simple illustrations by hand or from a design tool export.
- Exported SVGs are bloated, blurry at small sizes or ignore CSS colour.
- Building a sprite or icon component system.
- Animating icons, logos or line drawings, or accepting SVG uploads.

## When not to use

- Charts and data graphics: use `data-visualization`.
- Raster image processing or canvas drawing: use `image-processing-canvas`.
- Logo and brand system decisions: use `visual-identity` (then come back here to build the files).
- Complex UI motion: use `web-animation`.

## Workflow

1. **Choose the delivery method.**

   | Method | Use for | Trade-offs |
   | :--- | :--- | :--- |
   | Inline `<svg>` | Icons that inherit colour, interactive or animated graphics | Not cached separately; adds to HTML size |
   | `<img src="x.svg">` | Static illustrations, logos | Cacheable; no CSS styling inside; scripts do not run |
   | Sprite with `<symbol>` + `<use>` | Many icons across pages | One cached file; same-origin only for external sprites |
   | CSS `background-image` / `mask-image` | Decorative graphics | Not accessible; `mask-image` allows colouring |
   | Component (SVGR, framework loaders) | React and similar apps | Build-time transform; watch bundle size |

   **Check:** Each SVG in the project has a deliberate method, and decorative versus meaningful is decided.

2. **Author icons on a grid.** `viewBox="0 0 24 24"`, 2 px padding (live area 20 x 20), 2 px strokes, round caps and joins, `fill="none" stroke="currentColor"`. Place 1 px strokes on half-pixel coordinates and 2 px strokes on whole pixels for crisp rendering.

   ```html
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"
        fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
     <circle cx="11" cy="11" r="7"/>
     <path d="M20 20l-4-4"/>
   </svg>
   ```

   Path commands: `M` move, `L` line, `H`/`V` horizontal and vertical, `C`/`S` cubic, `Q`/`T` quadratic, `A` arc, `Z` close; uppercase is absolute, lowercase is relative.

   **Check:** The icon is crisp at 16, 24 and 48 px and changes colour with the parent's `color`.

3. **Optimize with SVGO without breaking things.**

   ```js
   // svgo.config.mjs
   export default {
     multipass: true,
     plugins: [
       { name: 'preset-default', params: { overrides: { cleanupIds: false } } },
       'removeDimensions',                       // rely on viewBox and CSS sizing
       { name: 'removeAttrs', params: { attrs: ['data-name'] } },
     ],
   };
   ```

   ```bash
   npx svgo -f src/icons -o dist/icons
   ```

   Keep `viewBox` (older SVGO 3 removed it by default unless `removeViewBox: false` is set in overrides; check your version) and keep IDs referenced by `<use>`, gradients, masks or animations.

   **Check:** Optimized files render identically to originals (compare screenshots) and are smaller.

4. **Make it accessible.** Decorative: `aria-hidden="true"` and `focusable="false"`. Meaningful standalone graphic: `role="img"` plus an accessible name:

   ```html
   <svg role="img" aria-labelledby="warn-title" viewBox="0 0 24 24">
     <title id="warn-title">Warning</title>
     ...
   </svg>
   ```

   Icon-only buttons put the label on the button (`aria-label="Search"`), not the SVG. Use `currentColor` so forced-colors and high-contrast modes work.

   **Check:** A screen reader announces meaningful graphics once and skips decorative ones; icons remain visible in Windows high-contrast mode.

5. **Build sprites.** Wrap each icon in `<symbol id="icon-search" viewBox="0 0 24 24">` inside one hidden SVG, then reference it:

   ```html
   <svg class="icon" aria-hidden="true"><use href="/icons.svg#icon-search"/></svg>
   ```

   **Check:** Every `href` fragment matches a symbol ID (`grep_search` both sides) and icons render on all target browsers.

6. **Animate with CSS.** Set `transform-box: fill-box; transform-origin: center` before rotating or scaling inner elements. Line drawing: set `pathLength="1"` on the path, then animate `stroke-dashoffset` from 1 to 0 with `stroke-dasharray: 1`. Animate `transform` and `opacity` for smoothness and wrap motion in `@media (prefers-reduced-motion: no-preference)`.

   **Check:** Motion is off when reduced motion is enabled in OS settings.

7. **Treat uploaded SVG as untrusted.** SVG can contain `<script>`, event handlers, external references and `<foreignObject>`. Sanitize with a maintained sanitizer (for example DOMPurify with its SVG profile), serve user files with a restrictive `Content-Security-Policy` from a separate domain, or rasterize to PNG. Never inline user SVG into your pages unsanitized.

   **Check:** A test upload containing `<script>` and `onload` attributes is neutralized.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Hard-coded `fill="#333"` in icons | `currentColor` | Icons ignore themes and dark mode |
| Remove `viewBox` to save bytes | Keep `viewBox`, remove `width`/`height` | Scaling breaks |
| Ship design-tool exports raw | Run SVGO and review the diff | Metadata, editor attributes, huge paths |
| Inline untrusted SVG | Sanitize, isolate or rasterize | Stored XSS |
| Animate `d`, filters or blur heavily | Animate transform and opacity | Jank on low-end devices |
| `<title>` on decorative icons | `aria-hidden="true"` | Repetitive screen reader noise |

## Verification checklist

- [ ] Icons share one grid, stroke width and `currentColor` styling.
- [ ] SVGO output keeps `viewBox` and referenced IDs, and renders identically.
- [ ] Meaningful SVGs have names; decorative ones are hidden from assistive tech.
- [ ] Sprite references resolve; animations respect reduced motion.
- [ ] User-supplied SVG is sanitized or isolated.

## Related

- Workflows: `/a11y-audit`, `/ui-polish`.
- Knowledge: `visual-identity`, `web-animation`, `accessibility-a11y`, `design-systems`, `image-processing-canvas`, `data-visualization`, `web-performance`.
- Agents: `accessibility-auditor`, `frontend-engineer`.
