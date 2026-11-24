---
name: growth-marketing
disable-model-invocation: true
description: >-
  Plans and measures developer-tool growth: activation metric and aha moment,
  AARRR funnel, product-led growth loops, content and SEO engine, Discord and
  GitHub community, launch channels (Product Hunt, Show HN, Reddit),
  open-source and referral flywheels, experiment design with sample sizes, and
  attribution caveats. Use when the user asks how to get users, grow adoption,
  fix activation or retention, or design a growth experiment.
---

# Growth Marketing for Developer Tools

Find the stage of the funnel that actually limits growth, fix it with loops
rather than one-off pushes, and measure the result honestly. Developers block
trackers, ignore ads and talk in channels you cannot see, so the measurement
plan matters as much as the tactics.

## When to use

- "How do we get more users / stars / signups?", "why don't people stick around?"
- Defining an activation metric, an aha moment or a north-star metric.
- Planning community, content, open-source or referral programs.
- Designing an A/B test or judging whether a result is real.

## When not to use

- Positioning and audience are unclear: run `brand-discovery` first; growth amplifies whatever positioning exists.
- Writing the actual copy or posts: `copywriting`.
- Executing a specific launch: `/marketing-launch`.
- Technical search problems (indexing, rendering, Core Web Vitals): `seo-audit`.

## Workflow

1. **Baseline the funnel.** Define one event per AARRR stage (table below), find where each is recorded (product analytics, server logs, package registry, GitHub insights, billing), and fill in last 30 days of numbers. Prefer server-side or CLI events (opt-in, disclosed) because client-side analytics undercount developers who block scripts.

   **Check:** A one-page table lists each stage with its event, count, conversion to the next stage and data source.

2. **Find the aha moment and set the activation metric.** Compare users retained at week 4 with those who churned: which early action (first 7 days) separates them most? Phrase it as "<actor> does <action> <N times> within <days>", and make sure it is reachable in the first session.

   **Check:** The activation metric is written down, retained users hit it at a clearly higher rate than churned users, and time-to-value is measured in minutes.

3. **Pick the constraint.** Fix retention before acquisition: if the retention curve never flattens, more traffic only fills a leaking bucket. Otherwise target the stage with the largest gap against its realistic potential.

   **Check:** You can name the single stage this cycle targets and the metric that will move.

4. **Design loops, not campaigns.** For each candidate loop, write input, action and output, where the output feeds the next input, plus cycle time. Prefer the loop native to the product (see the loops table).

   **Check:** Every chosen loop has an instrumented metric at each step.

5. **Design experiments before running them.** Use the hypothesis template and sample-size table below. Fix the primary metric, guardrail metrics, sample size and stop date in advance.

   **Check:** Each experiment has a pre-registered hypothesis, sample size and decision rule, or is explicitly labelled a qualitative test.

6. **Run channel playbooks** for content, community and launches (below). Draft posts for the user to approve; never post, DM or email on the user's behalf without explicit confirmation.

   **Check:** Each channel action is tagged with UTMs or a self-reported attribution option.

7. **Review weekly.** Update the funnel table, score the backlog with ICE (impact, confidence, ease, 1-10 each) and kill experiments that missed their decision rule.

   **Check:** The backlog is ranked and every finished experiment has a written result, including nulls.

## AARRR for developer tools

| Stage | Dev-tool definition | Example metric |
| :--- | :--- | :--- |
| Acquisition | Arrives at repo, docs or site from a known channel | Unique visitors by source; README views |
| Activation | Reaches the aha moment | % of installs that run a first successful command; first 200 from an API key |
| Retention | Comes back and uses it for real work | Weekly active projects; D30 retention by signup cohort |
| Referral | Brings others in | Invites sent and accepted; "powered by" link clicks; mentions |
| Revenue | Pays, or expands | Free-to-paid conversion; net revenue retention |

Activation examples: CLI - first successful run against a real project; library - imported and exercised in CI; API - first production call; SaaS - repository connected and a teammate invited.

## Growth loops

| Loop | Mechanism | Fits when |
| :--- | :--- | :--- |
| Content / SEO | Users search a problem, land on a guide, adopt, their questions seed new guides | Problem is searchable (error messages, "how to X in Y", "X vs Y") |
| Open source | Users adopt, contribute and star; visibility on GitHub and registries brings new users | Core is useful standalone; maintainers can respond fast |
| Collaboration | A user invites teammates to get the value | Value requires more than one person |
| Artifact sharing | Users publish outputs (badges, reports, templates) linking back | Outputs are visible to peers |
| Integrations | Listing in another ecosystem's marketplace or docs drives installs | A larger platform's users share your job-to-be-done |

Content engine: write for problem-aware searches (error strings, migrations, comparisons, "X with Y" integrations); treat docs as the main SEO asset; give every piece a distribution plan; avoid mass-generated thin pages, which search engines demote.

Community: answer in GitHub Discussions or docs, not only Discord, because chat is not searchable; publish a response-time target; label `good first issue` with enough context to finish in an afternoon; credit contributors in release notes.

## Launch channel etiquette

| Channel | Rules that matter |
| :--- | :--- |
| Show HN | Only for something people can try now (not a landing page or waitlist); title starts with `Show HN:`; plain description, no superlatives; the maker posts a first comment with backstory and technical detail and stays to answer; never ask for upvotes, since voting rings are penalised |
| Product Hunt | The day runs from 12:01 a.m. Pacific; prepare gallery, tagline and maker comment; ask people for feedback, not upvotes, per PH guidelines |
| Reddit | Read each subreddit's rules first; many ban self-promotion or limit it to set threads; disclose affiliation; participate before posting; never cross-post identical text |
| Newsletters, X, Bluesky, LinkedIn | Lead with a demo clip uploaded natively, then the problem, then the link |

## Experiment design

Hypothesis: "Because <evidence>, changing <X> for <segment> will move <primary metric> from <a> to <b>; guardrails: <metrics that must not drop>."

Sample size per variant for 80% power and two-sided alpha 0.05, approximated by `n = 16 * p * (1 - p) / d^2` (p = baseline rate, d = absolute lift):

| Baseline | Detectable absolute lift | Per variant |
| :--- | :--- | :--- |
| 2% | +0.5 pt | ~12,500 |
| 5% | +1 pt | ~7,600 |
| 10% | +2 pt | ~3,600 |
| 40% | +5 pt | ~1,500 |

- Do not stop early when a result "looks significant"; peeking inflates false positives. Use the fixed sample or a sequential method designed for it.
- Run at least one full weekly cycle to cover weekday/weekend mix; watch for novelty effects.
- Below these volumes, run qualitative tests (five user sessions, onboarding recordings) or larger changes, not A/B tests.

## Attribution caveats

- Last-touch attribution overweights the final click and hides word of mouth; most dev-tool discovery is "dark social" (Slack, Discord, colleagues) and appears as direct traffic.
- Add a self-reported "How did you hear about us?" free-text field and read it alongside analytics.
- GitHub traffic insights only cover the last 14 days; export them on a schedule if you need history.
- Stars measure attention, not use; registry download counts include CI and mirrors. Report them, but never as the activation metric.
- Use one UTM convention (`utm_source`, `utm_medium`, `utm_campaign`) everywhere, in lowercase.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Buy stars or upvotes, or run voting rings | Earn them with a demo people can try | Platforms detect and penalise it, and it poisons your metrics |
| Pour traffic into a product that does not activate | Fix the aha path first | Acquisition spend on a leaking funnel is wasted |
| Peek at A/B results daily and stop at p < 0.05 | Pre-register the sample size and decision rule | Early stopping produces false winners |
| Report stars as success | Report activation and retention by cohort | Attention without usage does not compound |
| Gate docs behind signup | Keep docs public and searchable | Docs are the main acquisition channel for developer tools |
| Post the same text to ten subreddits | Tailor to each community's rules and norms | Cross-posting gets removed and gets accounts banned |

## Verification checklist

- [ ] The funnel table has an event, count and source for every stage.
- [ ] The activation metric is defined and validated against retention.
- [ ] One constraint stage is chosen for this cycle.
- [ ] Each loop has instrumentation at every step.
- [ ] Experiments have hypotheses, sample sizes and stop rules written before launch.
- [ ] No public post, DM or email was sent without explicit user approval.

## Related

- Knowledge: `brand-discovery`, `copywriting`, `seo-audit`, `pricing-strategy`, `documentation-writing`, `observability-otel` (event instrumentation).
- Workflows: `/marketing-launch`, `/update-docs`.
- Agents: `marketing-strategist` (channel research and experiment review).
