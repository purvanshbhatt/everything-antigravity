# WCAG 2.2 Level A and AA checklist

A practical restatement for engineers. The normative text is the W3C WCAG 2.2
Recommendation; quote it, not this file, in formal audits. "Auto" means axe or
Lighthouse can usually detect failures; "Manual" means a person must check.
Criteria new in 2.2 are marked **(new)**. 4.1.1 Parsing is obsolete in 2.2.

## Perceivable

| SC | Level | Requirement in practice | Test |
| :--- | :--- | :--- | :--- |
| 1.1.1 Non-text Content | A | Meaningful images have alt text; decorative ones use `alt=""`; icon buttons have names | Auto (presence), Manual (quality) |
| 1.2.1-1.2.3 Prerecorded media | A | Transcripts for audio-only, captions and audio description or a text alternative for video | Manual |
| 1.2.4 Captions (Live) | AA | Live video has captions | Manual |
| 1.2.5 Audio Description | AA | Prerecorded video has audio description where visuals carry meaning | Manual |
| 1.3.1 Info and Relationships | A | Headings, lists, tables, labels and groups are in markup, not just styling | Auto (partly), Manual |
| 1.3.2 Meaningful Sequence | A | DOM order matches reading order | Manual |
| 1.3.3 Sensory Characteristics | A | Instructions don't rely only on shape, position or sound ("the round button on the right") | Manual |
| 1.3.4 Orientation | AA | Works in portrait and landscape unless essential | Manual |
| 1.3.5 Identify Input Purpose | AA | Personal-data fields use the right `autocomplete` tokens | Auto (partly) |
| 1.4.1 Use of Color | A | Colour is never the only signal (links, errors, chart series) | Manual |
| 1.4.2 Audio Control | A | Auto-playing audio over 3 s can be paused or muted | Manual |
| 1.4.3 Contrast (Minimum) | AA | 4.5:1 for text, 3:1 for large text (24 px, or about 18.7 px bold) | Auto |
| 1.4.4 Resize Text | AA | Usable at 200% text size | Manual |
| 1.4.5 Images of Text | AA | Real text instead of text in images | Manual |
| 1.4.10 Reflow | AA | No horizontal scrolling at 320 CSS px width (except maps, tables, etc.) | Manual |
| 1.4.11 Non-text Contrast | AA | 3:1 for component boundaries, focus indicators, icons and chart parts | Manual, partly Auto |
| 1.4.12 Text Spacing | AA | No loss of content with increased line, paragraph, letter and word spacing | Manual |
| 1.4.13 Content on Hover or Focus | AA | Tooltips are dismissible (`Esc`), hoverable and persistent | Manual |

## Operable

| SC | Level | Requirement in practice | Test |
| :--- | :--- | :--- | :--- |
| 2.1.1 Keyboard | A | Everything works by keyboard | Manual |
| 2.1.2 No Keyboard Trap | A | Focus can always leave a component | Manual |
| 2.1.4 Character Key Shortcuts | A | Single-key shortcuts can be turned off or remapped, or only work on focus | Manual |
| 2.2.1 Timing Adjustable | A | Time limits can be extended or turned off | Manual |
| 2.2.2 Pause, Stop, Hide | A | Moving or auto-updating content can be paused | Manual |
| 2.3.1 Three Flashes | A | Nothing flashes more than three times per second | Manual |
| 2.4.1 Bypass Blocks | A | Skip link or landmarks | Auto (partly) |
| 2.4.2 Page Titled | A | Unique, descriptive `<title>`, updated on SPA navigation | Auto (presence) |
| 2.4.3 Focus Order | A | Focus order preserves meaning | Manual |
| 2.4.4 Link Purpose (In Context) | A | Link text plus context says where it goes; no bare "click here" lists | Manual |
| 2.4.5 Multiple Ways | AA | More than one way to find pages (nav, search, sitemap) | Manual |
| 2.4.6 Headings and Labels | AA | Headings and labels describe topic or purpose | Manual |
| 2.4.7 Focus Visible | AA | A visible focus indicator | Manual |
| 2.4.11 Focus Not Obscured (Minimum) **(new)** | AA | The focused element is not entirely hidden by sticky headers, banners or chat widgets | Manual |
| 2.5.1 Pointer Gestures | A | Multipoint or path gestures have a single-pointer alternative | Manual |
| 2.5.2 Pointer Cancellation | A | Actions fire on up-event, or can be aborted | Manual |
| 2.5.3 Label in Name | A | The accessible name contains the visible label text | Auto (partly) |
| 2.5.4 Motion Actuation | A | Shake or tilt actions have a UI alternative and can be disabled | Manual |
| 2.5.7 Dragging Movements **(new)** | AA | Drag interactions have a single-pointer alternative (buttons, click-to-move) | Manual |
| 2.5.8 Target Size (Minimum) **(new)** | AA | Targets at least 24x24 CSS px, or enough spacing (with exceptions such as inline links) | Manual, partly Auto |

## Understandable

| SC | Level | Requirement in practice | Test |
| :--- | :--- | :--- | :--- |
| 3.1.1 Language of Page | A | `<html lang="...">` | Auto |
| 3.1.2 Language of Parts | AA | `lang` on passages in another language | Manual |
| 3.2.1 On Focus | A | Focus alone doesn't change context | Manual |
| 3.2.2 On Input | A | Changing a field doesn't submit or navigate unexpectedly | Manual |
| 3.2.3 Consistent Navigation | AA | Repeated navigation keeps the same order | Manual |
| 3.2.4 Consistent Identification | AA | Same function, same name and icon | Manual |
| 3.2.6 Consistent Help **(new)** | A | Help mechanisms appear in the same relative place across pages | Manual |
| 3.3.1 Error Identification | A | Errors are identified in text and tied to the field | Manual |
| 3.3.2 Labels or Instructions | A | Fields have labels and needed format hints | Auto (partly) |
| 3.3.3 Error Suggestion | AA | Errors say how to fix them | Manual |
| 3.3.4 Error Prevention | AA | Legal, financial and data-changing submissions can be reviewed, confirmed or reversed | Manual |
| 3.3.7 Redundant Entry **(new)** | A | Don't make users re-enter information already given in the same process | Manual |
| 3.3.8 Accessible Authentication (Minimum) **(new)** | AA | No cognitive test to sign in unless there's an alternative; allow paste and password managers | Manual |

## Robust

| SC | Level | Requirement in practice | Test |
| :--- | :--- | :--- | :--- |
| 4.1.2 Name, Role, Value | A | Custom controls expose name, role and state (`aria-expanded`, `aria-checked`, etc.) | Auto (partly), Manual |
| 4.1.3 Status Messages | AA | Status changes are announced without moving focus (live regions) | Manual |
