---
name: translation
description: >-
  Translates and localizes content with quality controls: source preparation,
  termbases and do-not-translate lists, tone and formality per locale, locale
  conventions, machine translation with post-editing, placeholder checks,
  native review loops and MQM-style quality scoring. Use when the user needs
  content, UI strings or documents translated, a glossary built, or machine
  translation output checked.
---

# Translation

Deliver translations that read as if written in the target language, keep
terminology consistent and never break the product: placeholders, markup and
plural syntax survive untouched.

## When to use

- "Translate this into German and Japanese", "localize our onboarding emails", "check this machine translation".
- Building a glossary or termbase before a localization project.
- Reviewing translated UI strings before a release.

## When not to use

- Engineering the app for multiple locales (ICU messages, RTL layout, extraction pipelines): `i18n-localization`.
- Polishing source text: `editing` (do it before translating; errors multiply per language).
- Legal, medical or regulatory documents that need certified translation: recommend a qualified human translator; machine output is a draft at most.

## Workflow

1. **Prepare the source.** Fix ambiguity, idioms and cultural references in the source first. Freeze the source version. Identify content type (UI, docs, marketing, legal), audience and target locales (`de-DE` vs `de-CH`, `pt-BR` vs `pt-PT`, `es-ES` vs `es-419`).

   **Check:** Source is final and each target is a full locale code, not just a language.

2. **Build the termbase and do-not-translate list.** Extract product names, UI labels, domain terms and brand phrases. One row per term (format below). Agree on formality per locale: German du or Sie, French tu or vous, Spanish tú or usted, Japanese politeness level.

   **Check:** Every recurring term has an approved target or a DNT flag.

3. **Translate.** For volume, machine-translate with glossary support (Cloud Translation Advanced, DeepL and similar services offer glossaries; verify current features) or prompt a Gemini model with the termbase, style notes and surrounding context, never isolated strings. Give translators and models context: screenshots, character limits, where the string appears.

   **Check:** Termbase terms appear as specified in a sample of the output.

4. **Validate mechanics automatically.** Placeholders, HTML tags and ICU syntax must match the source. Check length limits for UI (German and Finnish often run noticeably longer than English; measure, don't guess).

   ```python
   import json, re, sys
   PH = re.compile(r"\{[a-zA-Z0-9_]+\}|%\d*\$?[sdif@]|</?[a-zA-Z][^>]*>")
   src = json.load(open(sys.argv[1], encoding="utf-8"))
   tgt = json.load(open(sys.argv[2], encoding="utf-8"))
   for key, s in src.items():
       t = tgt.get(key)
       if t is None:
           print("MISSING", key)
       elif sorted(PH.findall(s)) != sorted(PH.findall(t)):
           print("PLACEHOLDER MISMATCH", key)
   ```

   For ICU plural and select messages, validate with an ICU parser (for example `@formatjs/icu-messageformat-parser`), because target languages legitimately have different plural categories (CLDR rules: Polish and Arabic have more than English).

   **Check:** Zero missing keys and zero placeholder mismatches.

5. **Post-edit and review.** A fluent speaker of the target language post-edits machine output (light for internal or ephemeral content, full for anything customer-facing). Score a sample with MQM-style categories (below). Back-translation can catch gross meaning errors but does not prove quality.

   **Check:** No critical or major errors remain in the reviewed sample; minor-error density is recorded.

6. **Check locale conventions in context.** Dates, numbers, currency, addresses, names and sort order come from CLDR-backed APIs (`Intl.DateTimeFormat`, `Intl.NumberFormat`, ICU), not hand formatting. Review in the running UI with screenshots per locale, including RTL for Arabic and Hebrew.

   **Check:** Screenshots show no truncation, overflow or untranslated strings.

7. **Close the loop.** Feed reviewer corrections back into the termbase and style notes, and keep a translation memory so unchanged strings are not retranslated.

   **Check:** Termbase updated with this round's decisions.

## Reference

Termbase row:

| Source term | Part of speech | Definition / context | de-DE | ja-JP | DNT | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| workspace | noun | Top-level container for projects | Arbeitsbereich | ワークスペース | no | UI label |
| Antigravity | proper noun | Product name | - | - | yes | Never translate |

MQM-style error categories and severities:

| Category | Examples |
| :--- | :--- |
| Accuracy | Mistranslation, omission, addition, untranslated text |
| Fluency | Grammar, spelling, punctuation, unnatural phrasing |
| Terminology | Termbase violation, inconsistent term |
| Style | Wrong formality, register or tone |
| Locale convention | Date, number, currency or address format |

Severities: critical (could cause harm, legal exposure or a broken product), major (meaning changed or confusing), minor (noticeable but meaning intact).

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Translate strings without context | Provide screenshots, limits and neighbouring strings | "Close" the verb and "close" the adjective differ in most languages |
| Concatenate translated fragments | Translate whole sentences with placeholders | Word order differs across languages |
| Ship raw machine translation for customer-facing text | Post-edit with a fluent reviewer | MT errors are fluent-sounding and easy to miss |
| Hand-format dates and numbers | Use `Intl` or ICU with the locale | Conventions vary widely by locale |
| Treat back-translation as QA | Use native review and MQM sampling | Back-translation hides fluency and style errors |

## Verification checklist

- [ ] Source frozen; targets are full locale codes.
- [ ] Termbase and DNT list applied; formality agreed per locale.
- [ ] Automated placeholder and key checks pass.
- [ ] Fluent review of a sample with MQM-style scoring; no critical or major errors.
- [ ] In-context screenshots reviewed per locale, including RTL where relevant.

## Related

- Knowledge: `i18n-localization`, `editing`, `copywriting`, `prompt-engineering`, `gemini-api`.
- Agents: `technical-writer`.
