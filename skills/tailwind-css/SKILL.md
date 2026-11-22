---
name: tailwind-css
description: >-
  Sets up and maintains Tailwind CSS (v4 CSS-first and v3 config): design
  tokens in @theme, dark mode strategies, custom utilities and variants,
  component extraction with cva and tailwind-merge, class sorting, safe dynamic
  classes, and v3 to v4 upgrades. Use when configuring Tailwind, building
  themed components, cleaning up class soup, or debugging missing or
  conflicting classes.
---

# Tailwind CSS

Use Tailwind as a token-driven styling layer: tokens live in one place,
repeated class sets become components, and every class name exists literally
in source so the scanner finds it. v4 moved configuration into CSS, so detect
the major before editing anything.

## When to use

- Installing Tailwind, or upgrading v3 to v4.
- Adding brand colours, fonts, radii or spacing as tokens; adding dark mode.
- Extracting variants for buttons, badges and inputs; resolving conflicting classes.
- Classes "don't apply" in production, or a long class string needs cleanup.

## When not to use

- Cascade, specificity and layout architecture without Tailwind: use `css-architecture`.
- Token governance across platforms and component libraries: use `design-systems`.
- Animation design: use `web-animation`.

## Workflow

1. **Detect the major.**

   ```bash
   npm ls tailwindcss @tailwindcss/vite @tailwindcss/postcss
   ```

   v4: CSS contains `@import "tailwindcss";` and config lives in `@theme`. v3: `tailwind.config.*` with `content` globs and `@tailwind base; @tailwind components; @tailwind utilities;`.

   **Check:** You can name the major and where tokens are defined.

2. **Install v4 (Vite example).**

   ```bash
   npm i -D tailwindcss @tailwindcss/vite        # PostCSS setups use @tailwindcss/postcss
   ```

   ```ts
   // vite.config.ts
   import tailwindcss from '@tailwindcss/vite';
   export default defineConfig({ plugins: [tailwindcss()] });
   ```

   v4 targets modern browsers (Safari 16.4+, Chrome 111+, Firefox 128+ per its docs; verify). If you must support older browsers, stay on v3.4.

   **Check:** A test utility such as `bg-red-500` renders in dev and in `vite build` output.

3. **Define tokens once.**

   ```css
   /* src/styles.css */
   @import "tailwindcss";
   @custom-variant dark (&:where(.dark, .dark *));   /* class-based dark mode; omit to follow the OS */

   @theme {
     --color-brand-50: oklch(0.97 0.02 250);
     --color-brand-500: oklch(0.55 0.18 250);
     --color-brand-700: oklch(0.42 0.16 250);
     --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
     --radius-card: 0.75rem;
   }

   /* Semantic tokens that switch with the theme */
   @theme inline {
     --color-surface: var(--surface);
     --color-fg: var(--fg);
   }
   :root { --surface: var(--color-white); --fg: var(--color-zinc-900); }
   .dark { --surface: var(--color-zinc-950); --fg: var(--color-zinc-50); }
   ```

   This yields `bg-brand-500`, `font-sans`, `rounded-card`, `bg-surface` and `text-fg`. Set the `dark` class from an inline `<head>` script before first paint to avoid a theme flash.

   **Check:** Toggling `.dark` on `<html>` switches surfaces with no hard-coded colours in components.

4. **Extract components, not `@apply` soup.** When a class set repeats three or more times, make a framework component with typed variants.

   ```ts
   import { cva, type VariantProps } from 'class-variance-authority';
   import { clsx, type ClassValue } from 'clsx';
   import { twMerge } from 'tailwind-merge';

   export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

   export const button = cva(
     'inline-flex items-center justify-center rounded-md font-medium focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50',
     {
       variants: {
         intent: {
           primary: 'bg-brand-500 text-white hover:bg-brand-700',
           ghost: 'bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800',
         },
         size: { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4' },
       },
       defaultVariants: { intent: 'primary', size: 'md' },
     },
   );
   export type ButtonVariants = VariantProps<typeof button>;
   // usage: className={cn(button({ intent, size }), className)}
   ```

   Match the `tailwind-merge` major to your Tailwind major (check its README).

   **Check:** A caller's `className="px-8"` overrides the variant's padding instead of both applying.

5. **Keep class names scannable.** Write complete class strings; map props to full names (`{ red: 'bg-red-500', green: 'bg-green-500' }`), never `bg-${color}-500`. v4 auto-detects sources but skips gitignored paths; add `@source "../node_modules/@acme/ui";` for packages that ship classes.

   **Check:** `grep_search` for template literals building class fragments (`-\$\{`) returns nothing in components.

6. **Sort and lint.** Add `prettier-plugin-tailwindcss` (for v4, point its `tailwindStylesheet` option at your CSS entry; verify in its README).

   **Check:** `npx prettier --check .` passes in CI.

7. **Upgrade v3 to v4 on a branch.** Ask the user before running the tool; it rewrites templates and config.

   ```bash
   npx @tailwindcss/upgrade
   ```

   Review renamed utilities (`shadow-sm` to `shadow-xs`, `shadow` to `shadow-sm`, `rounded` to `rounded-sm`, `outline-none` to `outline-hidden`, `ring` to `ring-3`), the default border colour (now `currentColor`) and any JS plugins (load with `@plugin` or `@config`).

   **Check:** Visual regression screenshots of key pages match before and after.

## Patterns

### Choosing where styles go

| Situation | Approach |
| :--- | :--- |
| One-off layout | Utilities inline |
| Repeated element with variants | Component plus `cva` |
| Reusable non-component utility | `@utility name { ... }` in CSS |
| Custom state or selector | `@custom-variant` |
| Third-party markup you cannot class | Scoped CSS in a `@layer components` block |
| Arbitrary one-off value (`w-[37px]`) | Allowed rarely; repeated values become tokens |

### Readable class lists

Group by concern in this order: layout, box, typography, colour, state, responsive (the Prettier plugin enforces a consistent order). Break a list over 120 characters into a component or variants.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Build class names from fragments | Map to complete class strings | The scanner never sees them; styles vanish in production |
| `@apply` everything into BEM-style classes | Framework components with variants | Recreates the CSS you were avoiding, with worse tooling |
| Hard-code hex values in markup | Tokens in `@theme` | Theme and dark mode changes need a global search |
| Concatenate conflicting classes | `cn()` with `tailwind-merge` | The later class in the stylesheet wins, not the later one in the string |
| Run the upgrade tool on a dirty tree | Clean branch, then review the diff | Mixed changes are unreviewable |

## Verification checklist

- [ ] Major known; tokens defined in one place.
- [ ] Dark mode strategy chosen and flash-free.
- [ ] No dynamically built class fragments.
- [ ] Repeated patterns are components with typed variants and `cn()` merging.
- [ ] Prettier class sorting enforced; visual regression passes after upgrades.

## Related

- Knowledge: `css-architecture`, `design-systems`, `web-animation`, `vite-bundlers`, `accessibility-a11y`, `visual-regression`.
- Workflows: `/ui-polish`, `/framework-migration`.
- Agents: `frontend-engineer`, `ux-designer`.
