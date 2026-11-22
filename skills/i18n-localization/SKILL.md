---
name: i18n-localization
description: >-
  Internationalizes apps end to end: ICU MessageFormat with plural, select and
  ordinal rules, CLDR plural categories, Intl APIs for dates, numbers,
  currencies, lists and relative time, RTL layouts with logical CSS and bidi
  isolation, locale negotiation and routing, and string
  extraction pipelines with a TMS and CI checks. Use when adding a language,
  fixing plural or formatting bugs, supporting RTL, or setting up translation
  workflows.
---

# Internationalization and Localization

Internationalize once (no hard-coded strings, formats or directions), then
localize many times through a pipeline. Every user-visible sentence is a full
ICU message, and every number, date and list goes through `Intl`.

## When to use

- Adding a second language, or preparing a codebase for one.
- Plurals, genders, dates, currencies or lists render wrong in some locale.
- Supporting Arabic, Hebrew, Persian or Urdu (RTL).
- Setting up extraction, translation management and CI checks.

## When not to use

- Translating marketing or docs content as prose: use `translation`.
- Locale-specific SEO strategy: use `seo-audit`.
- Logical CSS details beyond i18n: use `css-architecture`.

## Workflow

1. **Pick a library that speaks ICU** and matches the stack (table below). Agree on the source locale, the locale list, and the fallback chain (`fr-CA` to `fr` to `en`).

   **Check:** The library, message format and fallback chain are recorded in the implementation plan.

2. **Externalize strings as full ICU messages.** No concatenation; named placeholders; a description for translators; stable ids.

   ```json
   {
     "cart.summary": "{count, plural, =0 {Your cart is empty} one {# item in your cart} other {# items in your cart}}",
     "invite.sent": "{gender, select, female {She invited you} male {He invited you} other {They invited you}}",
     "race.place": "You finished {place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}"
   }
   ```

   CLDR plural categories are `zero`, `one`, `two`, `few`, `many` and `other`; English uses two, Arabic uses all six. Every `plural` and `select` must include `other`.

   **Check:** `grep_search` for string literals in JSX or templates and for `+` joined with UI text returns only allowed cases (test ids, logs).

3. **Format with `Intl`, never by hand.**

   ```ts
   const locale = 'de-DE';
   new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(1234.5);    // 1.234,50 €
   new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'Europe/Berlin' }).format(date);
   new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-1, 'day');            // gestern
   new Intl.ListFormat(locale, { type: 'conjunction' }).format(['A', 'B', 'C']);          // A, B und C
   new Intl.PluralRules('ar').select(3);                                                   // few
   ```

   Cache formatter instances per locale and options; constructing them is costly. Store instants in UTC plus the user's IANA time zone; format at display time. Handle currency as integer minor units plus an ISO 4217 code.

   **Check:** No `toFixed`, manual thousands separators or hard-coded date patterns remain in UI code.

4. **Negotiate and persist the locale.** Order: explicit user choice, URL (`/fr/...` or a subdomain), then `Accept-Language`, then default. Set `<html lang="..." dir="...">`, emit `hreflang` alternates for public pages, and remember the choice in a cookie or profile.

   **Check:** Visiting `/fr/` with an English browser shows French; switching language keeps the current page.

5. **Support right-to-left.** Set `dir="rtl"` on `<html>` for RTL locales, use logical CSS properties, mirror only directional icons (arrows, back buttons; not logos, checkmarks or media controls), put `dir="auto"` on user-generated content, and wrap interpolated names in `<bdi>` (or `unicode-bidi: isolate`).

   **Check:** Arabic screenshots show a fully mirrored layout with correctly ordered mixed-direction text.

6. **Build the extraction pipeline.** Extract, push to a TMS (Crowdin, Lokalise, Phrase, Transifex or similar), pull, compile, ship.

   ```bash
   npx formatjs extract "src/**/*.{ts,tsx}" --out-file lang/en.json --id-interpolation-pattern "[sha512:contenthash:base64:6]"
   npx formatjs compile lang/fr.json --out-file compiled/fr.json
   # Lingui: npx lingui extract && npx lingui compile
   # Angular: npx ng extract-i18n
   ```

   **Check:** CI fails on invalid ICU syntax, missing keys in the source locale, and placeholder mismatches between source and translations.

7. **Pseudo-localize to find gaps early.** Enable a pseudo-locale (FormatJS and Lingui both support one) that accents characters and expands text by 30 to 40 percent.

   **Check:** Browsing in the pseudo-locale reveals no unaccented (hard-coded) strings and no clipped or overflowing labels.

8. **Review in context.** Use the browser subagent to screenshot key screens in German (long words), Arabic (RTL, six plural forms), Japanese (no word spaces) and the pseudo-locale. Give translators screenshots and descriptions, not bare keys.

   **Check:** Screens in every target locale pass a visual review with no truncation or wrong formats.

## Patterns

### Library choice

| Stack | Library | Notes |
| :--- | :--- | :--- |
| React | FormatJS (`react-intl`), Lingui, i18next with ICU plugin | Lingui and FormatJS compile messages at build time |
| Next.js | `next-intl` | Locale routing and server component support |
| Vue / Nuxt | `vue-i18n`, `@nuxtjs/i18n` | Nuxt module handles routing and SEO tags |
| Angular | `@angular/localize` | Build-time translation per locale |
| Svelte | Paraglide, `svelte-i18n` | Paraglide compiles to tree-shakable functions |
| Server (Node) | FormatJS `@formatjs/intl`, i18next | Same catalogs as the client |

### Text and layout rules

| Rule | Why |
| :--- | :--- |
| Allow 30 to 40 percent text expansion | German and Finnish run long |
| Never put text in images | Cannot be translated |
| Sort with `Intl.Collator`, segment with `Intl.Segmenter` | Alphabet order and word breaks differ by locale |
| Avoid reusing one string in two contexts | Translations differ by context ("Open" verb vs adjective) |
| Check font glyph coverage | Missing glyphs fall back to ugly or tofu boxes |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `count + ' items'` or `count === 1 ? 'item' : 'items'` | ICU `plural` | Many languages have more than two forms |
| Concatenate sentence fragments | One message with placeholders | Word order differs by language |
| Hard-code `MM/DD/YYYY` or `$` | `Intl.DateTimeFormat`, `Intl.NumberFormat` | Formats are locale data |
| `margin-left` for spacing | `margin-inline-start` | RTL breaks |
| Detect locale only from IP | User choice, URL, then `Accept-Language` | IP location is not language |
| Ship keys without translator context | Descriptions and screenshots | Translators guess wrong |

## Verification checklist

- [ ] No hard-coded UI strings; all messages are ICU with `other` branches.
- [ ] All numbers, dates, currencies, lists and relative times use `Intl`.
- [ ] Locale negotiation order implemented; `lang`, `dir` and `hreflang` correct.
- [ ] RTL layout verified with real RTL content.
- [ ] CI validates ICU syntax, missing keys and placeholder parity.
- [ ] Pseudo-locale and long-locale screenshots reviewed.

## Related

- Knowledge: `translation`, `css-architecture`, `accessibility-a11y`, `seo-audit`, `forms-validation`, `frontend-react-nextjs`, `vue-nuxt`, `angular`.
- Workflows: `/ui-polish`, `/a11y-audit`.
- Agents: `frontend-engineer`, `technical-writer`.
