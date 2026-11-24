---
name: a11y-audit
disable-model-invocation: true
description: >-
  Audits a web UI against WCAG 2.2 AA in two passes, automated (axe-core,
  Lighthouse) and manual (keyboard, focus, screen reader, zoom and reflow,
  contrast, target size, motion), files ranked findings mapped to success
  criteria, fixes them at the component level and adds regression tests. Use
  when the user asks for an accessibility audit, a WCAG check or a pre-release
  a11y review of pages or components. Invoke with /a11y-audit.
---

# A11y Audit

Find the barriers that stop people from completing tasks, map each to a WCAG
2.2 success criterion, fix them where they originate, and keep them fixed.
Automated tools catch only part of WCAG issues; the manual pass is not
optional.

Usage: `/a11y-audit <url or routes> [journeys]`.

## When to use

- "Run an accessibility audit", "are we WCAG AA?", "check this page for a11y", pre-release reviews.
- After a redesign, a new design-system component, or a complaint from a user of assistive technology.
- Fixing findings from an external audit.

## When not to use

- Accessibility guidance while building (semantics, ARIA patterns, mobile platforms): `accessibility-a11y`.
- General visual polish: `/ui-polish` (it includes a quick a11y check, not an audit).
- Legal conformance statements: this audit informs them but is not a legal certification.

## Workflow

1. **Scope the audit.** List routes, components and the critical journeys (sign-in, search, forms, checkout, settings), target viewports, light and dark themes, and the standard (WCAG 2.2 Level A and AA). Run a production build locally; sign in with test accounts from the project's fixtures, never real credentials.

   **Check:** The scope table lists every route and journey with its URL.

2. **Automated pass.** Delegate to the `accessibility-auditor` subagent with the routes and base URL, or run the tools directly. Scan states that only exist after interaction (open menus, dialogs, validation errors) with Playwright plus axe.

   ```bash
   npx @axe-core/cli http://localhost:3000/checkout --tags wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa
   npx lighthouse http://localhost:3000/checkout --only-categories=accessibility --output=json --output-path=./a11y/checkout.json
   ```

   **Check:** Results are saved per route; every violation has a rule id, element and count.

3. **Keyboard pass.** Use the browser subagent (or do it yourself) to Tab and Shift+Tab through each journey, capturing focus screenshots. Verify: everything operable by keyboard (2.1.1), no traps (2.1.2), logical order (2.4.3), visible focus (2.4.7) not hidden behind sticky headers or banners (2.4.11), a working skip link (2.4.1), Escape closes dialogs and focus returns to the trigger, and custom widgets follow the ARIA Authoring Practices keyboard patterns.

   **Check:** Each journey was completed with the keyboard alone, or the blocking step is a finding.

4. **Screen reader pass.** NVDA with Firefox or Chrome on Windows, VoiceOver with Safari on macOS and iOS, TalkBack with Chrome on Android. Check names, roles and states of controls (4.1.2), heading structure and landmarks (1.3.1), form labels and error announcements (3.3.1, 3.3.2), status messages (4.1.3) and image alternatives (1.1.1). The agent cannot operate a screen reader: write a short test script and ask the user or a tester to run it, or mark the gate SKIP with that reason.

   **Check:** The main journey was tested with at least one screen reader, or SKIP is recorded with a reason.

5. **Visual and interaction pass.** Contrast of text (4.5:1, or 3:1 for large text, 1.4.3) and of UI components and focus indicators (3:1, 1.4.11); reflow at 320 CSS px width without two-dimensional scrolling (1.4.10); text resize to 200% (1.4.4); text spacing overrides (1.4.12); no meaning by colour alone (1.4.1); target size at least 24 by 24 CSS px or adequately spaced (2.5.8); single-pointer alternatives to dragging (2.5.7); `prefers-reduced-motion` respected; no accessible-authentication barriers such as puzzles without alternatives (3.3.8).

   **Check:** Screenshots at 320 px width and 200% zoom exist for each route.

6. **Triage findings.** Deduplicate by component (one fix in the design system can close dozens), then rank: blocker (a user group cannot complete a task), serious, moderate, minor. Record criterion, location, evidence, affected users and the fix.

   **Check:** Every finding maps to one WCAG success criterion and has evidence.

7. **Fix at the source and prevent regressions.** Prefer native HTML elements over ARIA, fix shared components first, and add automated checks to the E2E suite plus lint rules such as `eslint-plugin-jsx-a11y` for React.

   ```ts
   import { test, expect } from '@playwright/test';
   import AxeBuilder from '@axe-core/playwright';

   test('checkout has no detectable WCAG A/AA violations', async ({ page }) => {
     await page.goto('/checkout');
     await page.getByRole('button', { name: 'Pay now' }).click(); // reach the error state too
     const results = await new AxeBuilder({ page })
       .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
       .analyze();
     expect(results.violations).toEqual([]);
   });
   ```

   **Check:** Re-running the automated pass shows the fixed rules clear, and manual spot checks confirm the blockers are gone.

8. **Report.** Use the format below, including what was not tested.

   **Check:** The report lists open findings with owners and a re-audit date.

## Reference

New in WCAG 2.2 (relative to 2.1): 2.4.11 Focus Not Obscured (Minimum, AA), 2.5.7 Dragging Movements (AA), 2.5.8 Target Size (Minimum, AA), 3.3.8 Accessible Authentication (Minimum, AA), 3.2.6 Consistent Help (A), 3.3.7 Redundant Entry (A). 4.1.1 Parsing is obsolete and removed in 2.2.

```markdown
## A11y audit: <scope>  (WCAG 2.2 AA, <date>, commit <sha>)
Summary: 2 blockers, 5 serious, 9 moderate, 4 minor. Automated: axe + Lighthouse. Manual: keyboard, NVDA+Firefox, 320 px reflow.
| # | Severity | SC | Location | Problem | Evidence | Fix | Status |
| 1 | Blocker | 2.1.1 | DatePicker (all forms) | Not operable by keyboard | focus-03.png | Use native input or APG grid pattern | Fixed |
Not tested: <items and why>
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Declare compliance from a clean axe run | Add keyboard, screen reader and visual passes | Many criteria can only be checked manually |
| Add ARIA to fix everything | Use native elements first | Incorrect ARIA makes things worse than none |
| Fix each page instance separately | Fix the shared component | Same bug, one fix, consistent behaviour |
| Remove focus outlines for aesthetics | Style a visible, high-contrast focus indicator | Keyboard users lose their place |
| Audit only the default state | Audit errors, dialogs, menus and loading states | Barriers cluster in interactive states |

## Verification checklist

- [ ] Scope lists routes, journeys, viewports and themes.
- [ ] Automated scans saved per route, including interactive states.
- [ ] Keyboard pass completed for every journey.
- [ ] Screen reader pass done or SKIP with reason.
- [ ] Contrast, reflow, zoom, spacing, target size and motion checked.
- [ ] Findings mapped to success criteria, ranked and fixed at the source.
- [ ] Regression checks added to E2E or CI.

## Related

- Knowledge: `accessibility-a11y`, `browser-automation`, `design-systems`, `forms-validation`, `react-testing`.
- Workflows: `/e2e`, `/ui-polish`, `/verify`.
- Agents: `accessibility-auditor`, `e2e-runner`.
