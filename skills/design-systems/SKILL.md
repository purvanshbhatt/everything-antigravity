---
name: design-systems
description: >-
  Builds and evolves a design system: token architecture
  (primitive, semantic, component) in DTCG JSON transformed with Style
  Dictionary, accessible components on headless primitives, Storybook docs and
  interaction tests, visual regression, semantic versioning with changesets,
  deprecations and codemods, and adoption governance. Use when starting a
  component library, adding tokens or theming, documenting components, or
  planning breaking changes.
---

# Design Systems

A design system is a product: tokens, components, documentation and a release
process that other teams depend on. Optimize for consistency, accessibility and
safe upgrades, not for the number of components.

## When to use

- Several apps or teams duplicate buttons, colours and spacing.
- Introducing tokens, theming (brands, dark mode) or a shared component package.
- Setting up Storybook, visual tests and a release pipeline for UI packages.
- Planning a breaking change to a component API.

## When not to use

- Styling one app with Tailwind: use `tailwind-css`. Stylesheet structure: use `css-architecture`.
- Brand strategy, logo and colour meaning: use `visual-identity` or `brand-discovery`.
- Single-screen UX flows and wireframes: use `ui-ux-design`.

## Workflow

1. **Audit before building.** `grep_search` the consuming apps for colour literals (`#[0-9a-fA-F]{3,8}\b`, `rgb\(`), font sizes and spacing values; list duplicated components. Use the browser subagent to screenshot each variant of buttons, inputs and cards. Record findings in an artifact the user reviews.

   **Check:** You have counts of unique colours, type sizes and spacings, and a shortlist of the five components with the most duplication.

2. **Define tokens in three tiers.** Primitive (`color.blue.600`), semantic (`color.action.primary`, `space.inset.md`), and component tokens only when a component needs an independent knob. Store them in the DTCG format (`$value`, `$type`, aliases in braces) and transform them with Style Dictionary.

   ```json
   {
     "color": {
       "blue": { "600": { "$type": "color", "$value": "#2563eb" } },
       "action": { "primary": { "$type": "color", "$value": "{color.blue.600}" } }
     }
   }
   ```

   ```bash
   npx style-dictionary build --config sd.config.json   # emits CSS variables, JS, and native formats
   ```

   **Check:** Apps consume only semantic tokens; changing one primitive updates every theme output.

3. **Build components on headless primitives.** Use a tested behaviour layer (React Aria, Radix, Ark UI, Headless UI; Angular CDK; Bits UI or Melt UI for Svelte) and add styling. Each component specifies: variants and sizes, all states (hover, focus-visible, active, disabled, loading, invalid), keyboard behaviour per the WAI-ARIA Authoring Practices pattern, RTL and dark mode.

   **Check:** Keyboard-only and screen-reader passes succeed for each new component.

4. **Design the component API.** Variants as enums (`variant`, `size`), composition through `children` or slots, forward `ref` and native props, merge `className`, support controlled and uncontrolled use, and keep polymorphism (`as` or `asChild`) rare.

   **Check:** The API review lists every prop with type, default and reason, and has no boolean pairs that conflict.

5. **Document and test in Storybook.**

   ```bash
   npx storybook@latest init
   ```

   ```tsx
   // Button.stories.tsx (Storybook 9 import paths; 8.x used @storybook/test)
   import type { Meta, StoryObj } from '@storybook/react-vite';
   import { expect, within } from 'storybook/test';
   import { Button } from './Button';

   const meta = { component: Button, args: { children: 'Save' }, tags: ['autodocs'] } satisfies Meta<typeof Button>;
   export default meta;
   type Story = StoryObj<typeof meta>;

   export const Primary: Story = { args: { variant: 'primary' } };
   export const Loading: Story = {
     args: { loading: true },
     play: async ({ canvasElement }) => {
       await expect(within(canvasElement).getByRole('button')).toHaveAttribute('aria-busy', 'true');
     },
   };
   ```

   Add the accessibility addon and run stories as tests in CI (verify the current runner integration for your Storybook major).

   **Check:** Every component has stories for each variant and state, with docs and passing interaction and a11y checks.

6. **Gate releases in CI.** Lint, type-check, unit tests, Storybook tests, visual regression (Chromatic or Playwright screenshots of stories), and a bundle-size budget.

   **Check:** A deliberate visual change fails CI until approved.

7. **Version and deprecate deliberately.** Use semver with changesets. A breaking change ships with a migration guide and, where mechanical, a codemod. Deprecate first: `@deprecated` JSDoc, a development-only console warning, and at least one minor release of overlap. Ask the user before publishing any package.

   **Check:** The changelog names every breaking change with its migration path.

8. **Govern adoption.** Publish a contribution path (proposal, review, build, document), track adoption by counting imports across consuming repos, and hold regular office hours.

   **Check:** Adoption metrics and open requests are visible to consuming teams.

## Patterns

### Package layout

| Package | Contents | Notes |
| :--- | :--- | :--- |
| `@acme/tokens` | Generated CSS variables, JS constants, native outputs | No runtime deps |
| `@acme/ui` | Components, ESM only, tree-shakable | Framework as a peer dependency; `sideEffects` lists CSS files |
| `@acme/icons` | SVG components or sprite | Optimized with SVGO |
| `@acme/eslint-plugin` (optional) | Rules banning raw colours or deprecated components | Enforces adoption |

### Theming

Switch semantic tokens per theme (`[data-theme="dark"]`, `[data-brand="b"]`) and keep component CSS theme-agnostic. Test every theme in visual regression.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Start by building 40 components | Ship the 5 most duplicated, with tokens | Adoption beats coverage |
| Expose primitive tokens to apps | Expose semantic tokens | Rebrands and dark mode become one-line changes |
| Hand-roll menus, dialogs and comboboxes | Headless primitives | Keyboard and screen reader behaviour is hard to get right |
| Break an API in a minor release | Deprecate, overlap, then remove in a major | Consumers lose trust and pin old versions |
| Docs in a wiki that drifts | Stories generated from the code | Documentation stays true |

## Verification checklist

- [ ] Audit artifact exists and drove the first component list.
- [ ] Tokens are tiered, in DTCG JSON, and generated by a build.
- [ ] Each component meets WCAG 2.2 AA with keyboard and screen-reader checks.
- [ ] Storybook covers every variant and state; interaction, a11y and visual tests run in CI.
- [ ] Releases use changesets; breaking changes have migration notes and codemods where possible.

## Related

- Knowledge: `tailwind-css`, `css-architecture`, `web-components`, `accessibility-a11y`, `visual-regression`, `monorepo-tooling`, `ui-ux-design`, `visual-identity`, `svg-graphics`.
- Workflows: `/a11y-audit`, `/ui-polish`, `/release-management`.
- Agents: `ux-designer`, `frontend-engineer`, `accessibility-auditor`.
