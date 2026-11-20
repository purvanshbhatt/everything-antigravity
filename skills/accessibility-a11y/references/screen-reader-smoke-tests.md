# Screen reader smoke tests

A smoke test is 10-15 minutes per flow, not a full audit. Goal: can someone who
can't see the screen complete the main task and notice errors and results?

## Script (any screen reader)

1. Load the page. Is the page title announced and meaningful?
2. List headings. Is there one `h1`, and do the levels form an outline?
3. List landmarks. Are there `main`, `nav` and `banner`/`contentinfo`, and nothing unlabeled and duplicated?
4. Tab through interactive elements. Does each one announce a name, a role and its state (expanded, selected, checked)?
5. Complete the main task (search, sign in, submit a form).
6. Submit invalid data. Is the error announced, and can you get to the field?
7. Trigger an async update (save, filter, add to cart). Is the result announced?
8. Open and close a dialog or menu. Does focus go in, stay in, and return to the trigger?

Record each problem as: step, element, what was announced, what was expected.

## NVDA (Windows, free) with Firefox or Chrome

| Action | Keys |
| :--- | :--- |
| Start / quit | `Ctrl+Alt+N` (default desktop shortcut) / `NVDA+Q` |
| NVDA modifier | `Insert` (or `Caps Lock` if configured) |
| Stop speech | `Ctrl` |
| Read from here | `NVDA+Down Arrow` (desktop layout) |
| Next heading / level 1-6 | `H` / `1`-`6` (browse mode) |
| Next landmark / form field / button / link | `D` / `F` / `B` / `K` |
| Elements list (links, headings, landmarks) | `NVDA+F7` |
| Toggle browse and focus mode | `NVDA+Space` |

The Speech Viewer (NVDA menu, Tools) shows spoken text, which makes findings
easy to copy into a report.

Windows also ships Narrator (`Ctrl+Win+Enter`), but test with NVDA when you can.

## VoiceOver (macOS) with Safari

| Action | Keys |
| :--- | :--- |
| Toggle VoiceOver | `Cmd+F5` |
| VO modifier | `Ctrl+Option` (shown as VO) |
| Next / previous item | `VO+Right Arrow` / `VO+Left Arrow` |
| Activate | `VO+Space` |
| Rotor (headings, links, landmarks, form controls) | `VO+U`, then arrow keys |
| Next heading | `VO+Cmd+H` |
| Read all | `VO+A` |

## VoiceOver (iOS) and TalkBack (Android)

| Action | iOS VoiceOver | Android TalkBack |
| :--- | :--- | :--- |
| Turn on | Settings > Accessibility > VoiceOver (set Accessibility Shortcut to triple-click the side button) | Settings > Accessibility > TalkBack (or the volume-key shortcut if enabled) |
| Next / previous item | Swipe right / left | Swipe right / left |
| Activate | Double-tap | Double-tap |
| Change navigation unit | Rotor: rotate two fingers | Reading controls (gesture varies by version) |
| Read from top | Two-finger swipe up | TalkBack menu, "Read from top" |

Gestures and menu names change between OS versions; check the platform help
if one doesn't work.

## Common findings and fixes

| Heard | Cause | Fix |
| :--- | :--- | :--- |
| "button" with no name | Icon-only button | `aria-label`, or visually hidden text |
| "clickable" or nothing for a control | `div` with a click handler | Use `<button>` or `<a href>` |
| Field read without its label | Label not associated | `<label for>` matching `id`, or wrap the input |
| Error not announced | Text inserted without a live region or focus move | Focus the error summary, or use `aria-describedby` plus a status region |
| Content read twice | Visible text plus a duplicate `aria-label` | Remove the redundant label |
| Focus lost after closing a dialog | Focus not restored | Return focus to the trigger element |
