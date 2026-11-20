---
trigger: glob
globs: "**/*.css, **/*.scss, **/*.html, **/*.vue, **/*.svelte, **/*.astro"
description: HTML, CSS and component template conventions, semantics and accessibility
---

# Web frontend

## Semantic HTML

- Use landmarks (`header`, `nav`, `main`, `footer`, `aside`), one `h1` per page and headings in order without skipping levels.
- `<button>` for actions, `<a href>` for navigation. Never put click handlers on `div` or `span` to fake either.
- Every form control has a `<label>` (or `aria-labelledby`); group related controls with `fieldset`/`legend`. Use correct `type`, `autocomplete` and `inputmode` attributes.
- Lists use `ul`/`ol`; tabular data uses `table` with `th` and `scope`.
- Set `<html lang>` and `<meta name="viewport" content="width=device-width, initial-scale=1">`. Never disable zoom (`user-scalable=no`, `maximum-scale=1`).

## Accessibility (WCAG 2.2 AA)

- Images have meaningful `alt`; decorative images use `alt=""`. Icon-only buttons have an accessible name.
- Text contrast at least 4.5:1 (3:1 for large text, UI component boundaries and focus indicators).
- Everything works by keyboard in a logical tab order. Never remove focus outlines without a visible `:focus-visible` replacement. No positive `tabindex`.
- Native elements first; ARIA only when no native element fits, and never contradict native semantics.
- Announce async updates with `aria-live`; link errors to inputs with `aria-describedby` and `aria-invalid`.
- Respect `prefers-reduced-motion` and `forced-colors`. Interactive targets are at least 24x24 CSS px.
- Do not convey information by colour alone.

## CSS

- Follow the project's styling system (Tailwind, CSS Modules, BEM, scoped styles); do not introduce a second one.
- Use design tokens via custom properties (`var(--color-text)`) instead of literal colours and spacing.
- Keep specificity low: classes, not IDs; no `!important` outside utilities; use `:where()` for resets.
- Mobile-first media queries; container queries for components that adapt to their container. `rem` for font sizes, logical properties (`margin-inline`, `padding-block`).
- Animate only `transform` and `opacity`; avoid layout-triggering animations.
- Support dark mode through tokens and `prefers-color-scheme` when the project has a theme.

## Performance

- Give images `width`/`height` or `aspect-ratio` to prevent layout shift. Use `loading="lazy"` below the fold, never on the LCP image; mark the LCP image `fetchpriority="high"`.
- Serve modern formats with `srcset`/`sizes`. Use `font-display: swap` and preload only critical fonts.

## Security

- No inline event handler attributes (`onclick=`) or inline scripts where a CSP is used.
- Never render untrusted HTML via `innerHTML`, `v-html`, `{@html}` or `set:html` without sanitizing (DOMPurify or the framework's sanitizer).
- External links opened in new tabs use `rel="noopener noreferrer"`.

## Frameworks

- Vue: `<script setup lang="ts">`, typed `defineProps`/`defineEmits`, `:key` on every `v-for`, never `v-if` and `v-for` on the same element.
- Svelte: follow the project's version; in Svelte 5 use runes (`$state`, `$derived`, `$props`) instead of legacy `export let` and `$:`.
- Astro: ship zero JavaScript by default; add `client:*` directives only to components that need interactivity, preferring `client:visible` or `client:idle`.
