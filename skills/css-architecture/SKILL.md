---
name: css-architecture
disable-model-invocation: true
description: >-
  Structures modern CSS for maintainability: cascade layers for predictable
  precedence, custom-property tokens, container queries, :has() and :where(),
  logical properties for RTL, native nesting, fluid sizing with clamp(), and
  trade-offs between BEM, CSS Modules, utilities and scoped styles. Use when
  organizing a stylesheet codebase, ending specificity wars, building
  intrinsically responsive components, or reviewing CSS.
---

# CSS Architecture

Make precedence explicit with cascade layers, make components respond to their
container instead of the viewport, and keep values in tokens. Check each
feature's Baseline status against the project's browser targets before
relying on it.

## When to use

- A codebase relies on `!important`, ID selectors or deep descendant chains to win.
- Third-party CSS keeps overriding (or being overridden by) app styles.
- Components must adapt to sidebars, cards and grids, not only to viewport width.
- Adding RTL support, theming or fluid typography.
- Choosing a styling methodology for a new project.

## When not to use

- Tailwind setup and class management: use `tailwind-css`.
- Token pipelines and component libraries: use `design-systems`.
- Motion and transitions: use `web-animation`. Render performance: use `web-performance`.

## Workflow

1. **Inventory the current state.** `grep_search` for `!important`, `#[a-zA-Z]` selectors and selectors with four or more compound parts. Run the linter and read the browser targets.

   ```bash
   npx stylelint "src/**/*.{css,scss}"
   npx browserslist                    # resolves the project's browserslist query
   ```

   **Check:** You have counts of `!important` and ID selectors, and the list of target browsers.

2. **Declare cascade layers once, at the top of the entry stylesheet.**

   ```css
   @layer reset, vendor, tokens, base, layout, components, utilities, overrides;
   @import url("vendor/datepicker.css") layer(vendor);
   ```

   Rules: later layers win regardless of specificity; unlayered styles beat all layered styles; `!important` reverses layer order (an important declaration in an early layer beats one in a later layer). Put every third-party sheet in a low layer.

   **Check:** Removing a `!important` that existed only to beat vendor CSS leaves the UI unchanged.

3. **Move raw values into custom properties.** Primitive tokens (`--blue-600`) feed semantic tokens (`--color-action`), which components consume. For light and dark themes, set `color-scheme: light dark` and use `light-dark(<light>, <dark>)` where your targets support it, or swap semantic tokens under a `[data-theme="dark"]` selector.

   **Check:** `grep_search` for hex and `rgb(` literals outside the tokens file returns only justified exceptions.

4. **Make components container-aware.**

   ```css
   .card-list { container: cards / inline-size; }

   @container cards (min-width: 40rem) {
     .card { display: grid; grid-template-columns: 12rem 1fr; gap: 1rem; }
   }
   ```

   Use viewport media queries for page layout and container queries for component layout. Container units (`cqi`) size content relative to the container.

   **Check:** The same component renders correctly in a narrow sidebar and a wide main column at one viewport width.

5. **Use relational and low-specificity selectors.** `:has()` styles a parent from its children (`.field:has(input:user-invalid) .hint { color: var(--color-danger); }`). `:where()` adds zero specificity, ideal for resets and library defaults; `:is()` takes its most specific argument. Keep `:has()` anchors narrow; avoid `body:has(...)` rules that re-evaluate on every DOM change.

   **Check:** Base and reset selectors are wrapped in `:where()` and are easy to override.

6. **Write direction-agnostic layout.** Use logical properties: `margin-inline`, `padding-block`, `inset-inline-start`, `border-start-start-radius`, `text-align: start`. Mirror only directional icons.

   **Check:** Setting `dir="rtl"` on `<html>` produces a correct mirrored layout without extra overrides.

7. **Size fluidly and accessibly.** `font-size: clamp(1rem, 0.9rem + 0.5vw, 1.25rem)` keeps a `rem` term so browser zoom still scales text. Use `rem` for type, `em` for component-relative spacing, and avoid fixed heights on text containers.

   **Check:** At 200% browser zoom and at 320 CSS px width, no text is clipped and nothing scrolls horizontally (WCAG 1.4.4 and 1.4.10).

8. **Verify across modes.** Test forced colours (`@media (forced-colors: active)`), `prefers-reduced-motion`, dark mode and RTL. Use the browser subagent to capture screenshots of each mode for review.

   **Check:** Stylelint passes and visual regression shows only intended differences.

## Patterns

### Methodology trade-offs

| Approach | Strengths | Costs | Fits |
| :--- | :--- | :--- | :--- |
| BEM in global CSS | No build step, readable intent | Naming discipline, global leakage | Server-rendered sites, small teams |
| CSS Modules | Local scope by default, zero runtime | Theming needs custom properties | Component apps with any framework |
| Utility-first (Tailwind) | Fast iteration, tokens enforced | Long class lists without component extraction | Product UIs with a design system |
| Framework scoped styles (Vue, Svelte) | Co-located, scoped | Framework lock-in | Single-framework apps |
| Zero-runtime CSS-in-JS (vanilla-extract, Panda) | Typed tokens, static CSS output | Build tooling | TypeScript-heavy design systems |
| Runtime CSS-in-JS | Dynamic styling | Runtime cost, problematic with Server Components | Avoid for new work |

### Specificity quick reference

| Selector | Specificity |
| :--- | :--- |
| `:where(.a, #b)` | 0,0,0 |
| `.a` | 0,1,0 |
| `:is(.a, #b)` | 1,0,0 (most specific argument) |
| `#id` | 1,0,0 |
| Inline style | beats all selectors; `!important` beats inline |

### Native nesting

Nest modifiers and states with `&` (`.card { &:hover { ... } & .title { ... } }`) and keep nesting to two levels; deep nesting recreates descendant-selector specificity problems.

### Newer features to check before use

`@scope`, `@starting-style`, `light-dark()`, anchor positioning and `field-sizing` have uneven or recent support. Look them up on MDN or the web.dev Baseline pages and gate with `@supports` when targets lag.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `!important` to beat a library | Put the library in a lower layer | Escalation never ends |
| Style by ID | Classes or attributes | IDs are hard to override and not reusable |
| Viewport media queries inside reusable components | Container queries | Components break when placed in narrow regions |
| `margin-left`/`padding-right` | Logical properties | RTL needs a second stylesheet |
| `font-size: 2vw` | `clamp()` with a `rem` term | Pure viewport units ignore zoom |
| Overriding by repeating selectors (`.a.a.a`) | Layers or `:where()` | Specificity hacks are invisible to readers |

## Verification checklist

- [ ] Layer order is declared once; vendor CSS is layered low.
- [ ] `!important` and ID selectors reduced, and remaining ones justified.
- [ ] Components use container queries where placement varies.
- [ ] Logical properties throughout; RTL renders correctly.
- [ ] 200% zoom, 320px width, forced colours and dark mode verified.
- [ ] Stylelint and visual regression pass.

## Related

- Knowledge: `tailwind-css`, `design-systems`, `web-animation`, `i18n-localization`, `accessibility-a11y`, `web-performance`, `visual-regression`, `linting-formatting`.
- Workflows: `/ui-polish`, `/a11y-audit`.
- Agents: `frontend-engineer`, `ux-designer`, `accessibility-auditor`.
