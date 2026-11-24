---
name: copywriting
disable-model-invocation: true
description: >-
  Writes and edits developer-focused copy: landing pages, headlines, value
  propositions, README heroes, release notes, docs intros, microcopy, error
  messages and CTAs. Builds every claim as feature, benefit and proof, and
  enforces a banned-hype word list. Use when the user asks to write or improve
  copy, a tagline, a README intro, release notes, an error message or button
  text.
---

# Copywriting for Developers

Developers skim, distrust adjectives and check claims. Good developer copy
says exactly what the thing does, for whom, and proves it with a number, a
code sample or a demo. Every sentence either helps the reader decide or gets
cut.

## When to use

- Writing or rewriting a landing page, hero, tagline, pricing page copy or README intro.
- Release notes, changelogs, upgrade guides and announcement posts.
- Microcopy: buttons, empty states, onboarding, confirmation dialogs and error messages.
- Choosing CTA or headline variants to test.

## When not to use

- Positioning or audience is undecided: run `brand-discovery` first; copy cannot fix unclear positioning.
- Long-form reference docs or API references: use `documentation-writing` or the `doc-updater` subagent.
- Choosing channels and experiments: `growth-marketing`. Technical SEO: `seo-audit`.

## Workflow

1. **Load the inputs.** Find the brand brief (positioning, pillars, proof library, voice). If none exists, get three answers before writing: who it is for, what they use today, and the one outcome that is better. Identify the reader's awareness level (problem-aware, solution-aware, product-aware) and the single action the page should drive.

   **Check:** You can state the reader, their current alternative, the page goal and the one CTA in four lines.

2. **Gather raw material, not adjectives.** Collect benchmarks, setup time, lines of code saved, supported platforms, customer quotes and real code samples. Use `grep_search` in the repo for numbers in benchmarks, tests and docs. Record a source for every number.

   **Check:** You have at least three provable claims, each with a source.

3. **Draft 5-10 headlines** using the formulas below, then apply the swap test: if a competitor could use the headline unchanged, rewrite it.

   **Check:** The chosen headline names a concrete outcome or object and passes the swap test.

4. **Build the body as feature, benefit, proof.** One block per pillar: what it is, what it lets the reader do, and why they should believe it.

   **Check:** Every benefit has proof next to it, not three sections later.

5. **Edit hard.** Remove banned words, cut every sentence that does not help a decision, replace vague quantifiers ("many", "lots", "fast") with numbers, and read it aloud. Run `grep_search` over the draft for the banned list.

   **Check:** Zero banned words, no paragraph longer than three sentences on marketing pages, and every number traced to a source.

6. **Format for the asset** using the templates below (landing page, README hero, release notes, microcopy).

   **Check:** The asset matches its template, and code samples were run or copied from tested sources.

7. **Plan a test** only if traffic supports it (see sample sizes in `growth-marketing`). Change one element at a time, starting with the headline or primary CTA.

   **Check:** The test has one variable, a primary metric and a sample size, or the copy ships without a test and that is stated.

## Headline formulas

| Formula | Example (fictional product) |
| :--- | :--- |
| Outcome + without + pain | Run Postgres migrations without locking tables |
| Object + for + specific audience | Type-safe SQL for TypeScript teams on Postgres |
| From A to B in time | From `git push` to a preview URL in 40 seconds |
| Do X in your existing Y | Profile production Go services from your terminal |
| The [category] that [unique attribute] | The feature-flag service that evaluates flags locally, with no network call |

Avoid: questions ("Tired of slow builds?"), "The future of X", and any headline that needs the logo next to it to make sense.

## Value proposition structure

```text
Eyebrow (optional): category or audience        "Open-source CLI for Postgres"
Headline: concrete outcome, <= 10 words          "Run migrations without locking tables"
Subhead: how it works + for whom, 1-2 sentences
Proof line: number, logos or stars with source   "Used on 2 TB databases at ..."
Primary CTA: verb + object                       "Install the CLI"   Secondary: "Read the docs"
Visual: real terminal output, code or a 10-second demo, never abstract art
```

## Feature, benefit, proof

| Feature (what) | Benefit (so you can) | Proof (believe it because) |
| :--- | :--- | :--- |
| Local flag evaluation | Ship flags on hot paths with no added latency | p99 evaluation 40 us in the published benchmark |
| Single static binary | Install in CI without a runtime | `curl` + one line in the docs; 9 MB download |
| Schema-checked queries | Catch broken SQL in code review, not production | Compile error example shown on the page |

## Landing page section order

1. Hero: headline, subhead, primary CTA, real product visual.
2. Social proof strip: logos, stars, quotes. Only real ones, with permission.
3. Problem: the current alternative and its cost, in the reader's words.
4. How it works: three steps, with a code or terminal sample.
5. Pillars: feature, benefit and proof blocks, one per value pillar.
6. Comparison against alternatives: honest, dated, with sources.
7. Testimonials or case study with a number.
8. Pricing summary or "free and open source" statement.
9. FAQ: the top objections (security, lock-in, migration, license, support).
10. Final CTA repeating the primary action.

## README hero

```markdown
# toolname
One sentence: what it does, for whom.  [2-4 badges: CI, version, license]
![10-second demo](docs/demo.gif)
## Quickstart
<copy-pasteable install + first command that produces visible output>
## Why toolname
3 bullets: benefit + proof each. Then: Features, Docs, Contributing, License.
```

## Release notes

Lead with breaking changes and the migration step, then use Keep a Changelog groups: Added, Changed, Deprecated, Removed, Fixed, Security. Write each entry as user impact ("Builds no longer fail when the path contains spaces (#412)"), not as the internal change ("refactor path util").

## Microcopy and error messages

| Element | Rule | Before | After |
| :--- | :--- | :--- | :--- |
| Error | What happened, why, what to do next | "Error 500" | "Couldn't save: the token expired. Sign in again; your draft is kept." |
| CLI error | Name the input, the expected value and the fix | "Invalid config" | "`port` must be 1-65535, got 70000 (config.toml:12)" |
| Button | Verb + object, matching the result | "Submit" | "Create project" |
| Destructive confirm | Name the object and the consequence | "Are you sure?" | "Delete 'billing-prod'? 14 environments will stop deploying." |
| Empty state | Why it is empty + the first action | "No data" | "No deployments yet. Push to `main` to trigger the first one." |

Never blame the user, never say "oops", and never show a stack trace as the only message.

## CTA testing

- Specific beats generic: "Install the CLI" or "Start a free project" outperform "Get started" in clarity, but test it rather than assume.
- Keep one primary CTA per view; secondary actions use a lower-emphasis style.
- Test one variable at a time, with sample sizes from `growth-marketing`; low traffic means ship the clearer version and watch the funnel.

## Banned words

Do not use: revolutionary, seamless/seamlessly, unleash, game-changing, cutting-edge, next-generation, world-class, best-in-class, blazing/blazingly fast, supercharge, empower, effortless, magical, unlock, harness, elevate, paradigm, synergy, leverage (as a verb), robust or powerful (without proof), "AI-powered" as a lead, "in today's fast-paced world", "it's not just X, it's Y". In docs and tutorials also avoid "simply", "just" and "easy", which read as condescending when the reader is stuck.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Claim "10x faster" with no baseline | State the benchmark, setup and source | Unsourced numbers get checked and mocked in developer forums |
| Use stock illustrations as the hero visual | Show real output, code or a short demo | Developers trust what they can see running |
| List features without benefits | Pair each feature with what it enables and proof | Readers should not have to translate features themselves |
| Write three CTAs of equal weight | One primary CTA per view | Competing CTAs reduce clicks on all of them |
| Invent testimonials or logos | Use real, permitted quotes or omit the section | Fabricated proof is deceptive and can be unlawful |
| Pad with triads and empty contrasts | Say the one specific thing | Padding reads as machine-written and wastes attention |

## Verification checklist

- [ ] Reader, alternative, page goal and CTA are written down.
- [ ] The headline passes the swap test.
- [ ] Every claim has a source, and every code sample was run or comes from a tested source.
- [ ] A `grep_search` over the draft finds zero banned words.
- [ ] Error messages state what happened, why and what to do next.
- [ ] Release notes lead with breaking changes and migration steps.

## Related

- Knowledge: `brand-discovery`, `growth-marketing`, `seo-audit`, `pricing-strategy`, `documentation-writing`, `accessibility-a11y` (link text, alt text).
- Workflows: `/marketing-launch`, `/update-docs`.
- Agents: `marketing-strategist`, `doc-updater`.
