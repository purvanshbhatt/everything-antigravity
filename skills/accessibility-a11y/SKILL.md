---
name: accessibility-a11y
disable-model-invocation: true
description: >-
  Makes web and mobile UIs usable by keyboard, screen reader and zoom users to
  WCAG 2.2 AA: semantic HTML first, ARIA only when needed, focus management,
  contrast, accessible forms and errors, live regions, and testing with
  axe-core, @axe-core/playwright, Lighthouse, NVDA and VoiceOver, plus Flutter,
  iOS and Android. Use when building or reviewing UI, fixing an audit finding,
  or checking accessibility before a release.
---

# Accessibility (WCAG 2.2 AA)

Make every flow operable by keyboard, understandable by screen readers and
readable at 200% zoom, then keep it that way with automated checks. Automated
tools find only a subset of failures; a keyboard pass and a screen reader
smoke test are part of done, not extras.

## When to use

- Building or changing UI components, forms, dialogs, menus, tabs or navigation.
- An audit, a customer or a lawsuit-risk review reports WCAG failures.
- Before release of a critical journey: sign-up, sign-in, checkout, settings.
- Adding automated accessibility checks to a test suite or CI.
- Mobile screens in Flutter, SwiftUI/UIKit or Jetpack Compose need screen reader support.

## When not to use

- Visual design direction and brand palettes: use `brand-discovery` (then check contrast here).
- Page speed: use `web-performance`.
- Writing a whole E2E suite: use `/e2e`; this skill adds the a11y assertions.
- A full independent audit across many screens: delegate to the `accessibility-auditor` agent.

## Workflow

1. **Set the target and scope.** Default to WCAG 2.2 Level AA unless a contract says otherwise. List the journeys and components in scope, with their URLs or screens.

   **Check:** You have a list of pages or components, and the conformance target is written in the plan.

2. **Run automated checks first.** They are fast and catch the mechanical failures.

   ```bash
   npm i -D @axe-core/playwright
   npx playwright test a11y                       # see the pattern below
   npx lighthouse http://localhost:3000 --only-categories=accessibility --output=html --output-path=./a11y.html
   ```

   For React code, also enable `eslint-plugin-jsx-a11y`. For component tests, use `jest-axe` or `vitest-axe`.

   **Check:** Every violation is either fixed or recorded with its rule id, element and reason.

3. **Do a keyboard pass on every flow.** Unplug the mouse mentally: `Tab`, `Shift+Tab`, `Enter`, `Space`, arrow keys and `Esc`. Confirm visible focus at all times, a logical order, no traps, a working skip link, and that focus moves into dialogs and returns to the trigger when they close. Confirm that sticky headers don't cover the focused element (2.4.11).

   **Check:** Each flow completes by keyboard alone, and you have noted every place where focus was lost or invisible.

4. **Smoke-test with a screen reader.** Use NVDA with Firefox or Chrome on Windows, or VoiceOver with Safari on macOS. Navigate by headings, landmarks and form fields; complete the main task; trigger an error; and confirm the result is announced. Commands: [screen reader smoke tests](references/screen-reader-smoke-tests.md).

   **Check:** Every control has a sensible name and role, and state changes (errors, saved, loading) are announced.

5. **Check visual requirements.** Text contrast is 4.5:1 (3:1 for large text), and UI components and focus indicators are 3:1. The page reflows at 320 CSS px width without horizontal scrolling, works at 200% zoom and with increased text spacing, and respects `prefers-reduced-motion`. Pointer targets are at least 24x24 CSS px. Colour is never the only signal.

   **Check:** The DevTools contrast picker or axe shows no failures, and the 320 px and 200% views are usable.

6. **Fix in this order:** semantics, names and labels, keyboard and focus, contrast, and announcements. Native elements fix several criteria at once. Full criteria list: [WCAG 2.2 AA checklist](references/wcag22-aa-checklist.md).

   **Check:** Re-run steps 2-4 on the changed screens, and the earlier failures are gone.

7. **Lock it in.** Add an axe test per key page, query elements by role and name in tests, and fail CI on new violations.

   **Check:** CI runs the a11y tests, and a deliberately unlabeled input makes them fail.

## Patterns

### Native first

| Need | Use | Not |
| :--- | :--- | :--- |
| Action | `<button type="button">` | `<div onClick>` (no focus, role or key handling) |
| Navigation | `<a href>` | `<span>` with a click handler |
| Modal | `<dialog>` with `showModal()` (focus containment, `Esc`, inert background) | A custom div with a hand-written focus trap |
| Disclosure | `<details>`/`<summary>`, or a button with `aria-expanded` and `aria-controls` | Toggling `display` without state |
| Page structure | `<header>`, `<nav>`, `<main>`, `<footer>`, one `<h1>`, ordered headings | Styled divs |
| Tabs, combobox, menu, tree | A tested library, or the ARIA Authoring Practices Guide pattern | Improvised ARIA roles |

ARIA changes what assistive technology hears, not how the element behaves. A
`role="button"` still needs `tabindex="0"` and `Enter`/`Space` handling.

### Accessible form field with error

```html
<label for="email">Email</label>
<input id="email" name="email" type="email" autocomplete="email" required
       aria-invalid="true" aria-describedby="email-hint email-error">
<p id="email-hint">We'll send the receipt here.</p>
<p id="email-error">Enter an email address in the format name@example.com.</p>
```

On submit with errors, move focus to the first invalid field or to an error
summary that links to each field. Say what is wrong and how to fix it. Don't
disable the submit button as the only signal.

### Announcing status

```html
<!-- Render this element on page load, then change its text -->
<div role="status" aria-live="polite" class="visually-hidden" id="save-status"></div>
```

Use `role="status"` for routine updates ("Saved", "3 results"). Use
`role="alert"` only for urgent errors. A live region added to the DOM at the
same moment as its text is often not announced.

### Route changes in single-page apps

After client-side navigation, update `document.title`, then move focus to the
new page's `<h1>` (with `tabindex="-1"`) or to `<main>`. Otherwise screen reader
users get no signal that anything changed.

### Automated check with Playwright

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('checkout has no detectable WCAG A/AA violations', async ({ page }) => {
  await page.goto('/checkout');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .exclude('#third-party-chat')
    .analyze();
  expect(results.violations).toEqual([]);
});
```

Run it on each meaningful state too: an open dialog, the error state of a form, and an expanded menu.

### Mobile

| Platform | Name and role | Test |
| :--- | :--- | :--- |
| Flutter | `Semantics(label:, button: true, header: true)`, `MergeSemantics`, `ExcludeSemantics`, `tooltip` on `IconButton`, `semanticLabel` on images and icons | `meetsGuideline(androidTapTargetGuideline)`, `iOSTapTargetGuideline`, `labeledTapTargetGuideline`, `textContrastGuideline` in widget tests (after `tester.ensureSemantics()`); `showSemanticsDebugger: true` |
| iOS (SwiftUI) | `.accessibilityLabel`, `.accessibilityHint`, `.accessibilityAddTraits(.isHeader)`, `.accessibilityElement(children: .combine)`, Dynamic Type text styles | Xcode Accessibility Inspector; `try app.performAccessibilityAudit()` in XCUITest (recent Xcode) |
| Android (Compose) | `Modifier.semantics { contentDescription = ...; heading() }`, `contentDescription = null` for decorative icons, 48 dp touch targets | Accessibility Scanner app; Espresso `AccessibilityChecks.enable()` for View-based UI |

Always finish with a real-device pass in VoiceOver (iOS) or TalkBack (Android).

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `outline: none` with no replacement | Style `:focus-visible` with 3:1 contrast | Keyboard users lose their place |
| Placeholder as the only label | A visible `<label>` | Placeholders vanish on input and often fail contrast |
| `aria-label` on everything | Visible text and native semantics | Extra ARIA often conflicts with or hides real content |
| Positive `tabindex` values | DOM order that matches visual order | Positive values break the natural tab sequence |
| Treating a clean axe run as done | Keyboard and screen reader passes | Automated tools miss most focus, order and meaning problems |
| Icon-only buttons without names | `aria-label`, or visually hidden text | They are announced as just "button" |
| Disabling zoom (`user-scalable=no`) | Allow zoom; fix the layout | Low-vision users depend on zoom |

## Verification checklist

- [ ] The target (WCAG 2.2 AA) and the scope are recorded.
- [ ] axe and Lighthouse show no unexplained violations on the key pages and states.
- [ ] Every flow completes by keyboard with visible focus and no traps.
- [ ] A screen reader smoke test passed on at least one platform, with notes.
- [ ] Contrast, 320 px reflow, 200% zoom, target size and reduced motion were checked.
- [ ] Automated a11y tests run in CI.

## Related

- Workflows: `/e2e`, `/verify`, `/code-review`, `/pr-ready`.
- Knowledge: `frontend-react-nextjs`, `flutter-mobile`, `browser-automation`, `tdd-testing`, `web-performance`.
- Agents: `accessibility-auditor`, `e2e-runner`, `typescript-reviewer`.
