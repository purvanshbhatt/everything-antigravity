---
name: visual-identity
description: >-
  Creates a visual identity system: brief and moodboards, logo concept
  exploration and stress tests (favicon size, one colour, reversed), colour
  systems with tonal scales and contrast-checked pairs, typography with
  licensing checks, brand guidelines, design tokens and asset packages, and
  trademark and originality checks.
  Use when designing or refreshing a logo, palette, type system or brand
  guidelines for a product or company.
---

# Visual Identity

An identity is a system, not a logo: a mark that survives 16 px and one
colour, a palette that passes contrast in light and dark, type the company is
licensed to use everywhere, and rules people can follow without the designer
in the room.

## When to use

- A new product or company needs a logo, colours and typography.
- An existing identity is inconsistent across app, site, social and print.
- Writing brand guidelines or packaging logo files and tokens for developers.
- Checking a proposed logo or name visually against competitors.

## When not to use

- Positioning, audience and brand voice: use `brand-discovery` first; this skill consumes its output.
- Product UI components and tokens at scale: use `design-systems`.
- Building and optimizing the SVG files: use `svg-graphics`.
- Generating illustrative imagery: use `ai-image-generation`.

## Workflow

1. **Write the brief.** From brand strategy: 3-5 personality attributes with their opposites ("confident, not loud"), audience, category conventions to follow or break, competitor visual landscape (screenshot their logos and palettes side by side), and every application (app icon, favicon, website, social avatars, slides, print, merchandise, motion).

   **Check:** The brief lists attributes, competitors and applications on one page.

2. **Build a moodboard.** Collect references for colour, type, shape and imagery, each annotated with what it contributes. AI-generated images are fine for exploring mood; they are not final assets.

   **Check:** Every reference has a note tying it to a brief attribute.

3. **Explore logo concepts widely.** Sketch 15-30 rough thumbnails across types: wordmark, lettermark, symbol, combination mark, emblem. Shortlist three directions and build them as clean vectors (SVG). Generated logos may not be protectable as trademarks or copyrights and can resemble existing marks; treat them as sketches only.

   **Check:** Three directions exist as vectors with a one-line rationale each.

4. **Stress-test the marks.** Test at 16 px (favicon) and 512 px; in one colour; reversed on dark; on photos; next to competitors; at a glance from a distance; with the full name and as an icon alone. Remove details that disappear at small sizes.

   **Check:** The chosen mark is recognizable at 16 px and in one colour.

5. **Design the colour system.** Roles: primary, secondary, accent, neutrals and semantic (success, warning, danger, info). Generate tonal scales (50-950) in OKLCH for even perceived lightness steps. Define light and dark mode mappings. Check contrast: at least 4.5:1 for body text, 3:1 for large text and UI components (WCAG). Specify HEX and RGB for screens; get CMYK and spot colours from the print vendor rather than converting by eye.

   **Check:** A contrast table covers every text-on-background pair used, in both modes.

6. **Choose typography.** One family for headings and one for body (or one versatile family), a type scale (for example a 1.25 ratio), weights and line heights. Confirm licensing covers web embedding, apps, desktop use and the expected traffic; open-licensed fonts (for example SIL OFL) avoid most limits. Prefer variable fonts to cut file count.

   **Check:** The license for each font covers every application in the brief.

7. **Define supporting elements.** Icon style (stroke width, corners), illustration or photography direction, grid and spacing unit, shape language, motion principles (easing, duration).

8. **Write the guidelines.** Logo clear space (for example the height of a defined letter), minimum sizes in px and mm, colour usage ratios, do and don't examples (no stretching, recolouring, effects or busy backgrounds), typography hierarchy, imagery and voice summary, contacts.

   **Check:** Someone new can produce an on-brand slide and social post using only the guidelines.

9. **Package assets and tokens.** Logo files in SVG, PDF and PNG (full colour, one colour, reversed; horizontal and stacked); favicons (`favicon.ico`, an SVG icon, 180 x 180 `apple-touch-icon.png`); app icon sizes per platform; social avatars. Tokens for developers:

   ```css
   :root {
     --brand-500: oklch(0.62 0.19 255);
     --brand-600: oklch(0.54 0.19 255);
     --neutral-50: oklch(0.98 0 0);
     --neutral-900: oklch(0.21 0 0);
     --font-sans: "Inter", system-ui, sans-serif;
     --radius-md: 8px;
   }
   ```

   **Check:** Every application in the brief has a ready file, and tokens match the guideline values.

10. **Check originality and trademarks (not legal advice).** Search trademark databases for the name and similar marks in relevant classes (for example USPTO, EUIPO, WIPO Global Brand Database), reverse-image search the mark, and recommend professional clearance before launch.

    **Check:** Search results and the recommendation for legal review are recorded.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Present one logo option | Explore widely, shortlist three | First ideas are rarely best; stakeholders need a choice |
| Fine detail and gradients in the main mark | Simple shapes; detailed variants only where size allows | Unreadable at favicon and app-icon sizes |
| Brand colour that fails text contrast | Separate brand and text-safe shades | Accessibility failures across the product |
| Fonts licensed for desktop only | Licenses that cover web, apps and traffic | Licence violations at launch |
| Final logo from an image generator | Use AI for exploration, vectorize original work | Protectability and similarity risks |
| Guidelines with no misuse examples | Show do and don't visually | People repeat what they see |

## Verification checklist

- [ ] Brief with attributes, competitors and applications exists.
- [ ] Chosen mark passes 16 px, one-colour and reversed tests.
- [ ] Palette has tonal scales, dark mode mapping and a passing contrast table.
- [ ] Font licenses cover every application.
- [ ] Guidelines include clear space, minimum size and misuse examples.
- [ ] Asset package and tokens delivered; trademark search recorded.

## Related

- Knowledge: `brand-discovery`, `svg-graphics`, `design-systems`, `ai-image-generation`, `ui-ux-design`, `accessibility-a11y`, `copywriting`.
- Agents: `ux-designer`, `marketing-strategist`.
