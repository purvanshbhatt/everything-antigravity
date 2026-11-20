---
name: brand-discovery
description: >-
  Runs brand and positioning discovery for a product, developer tool or
  open-source project: discovery interview, personas and jobs-to-be-done,
  April Dunford-style positioning, messaging hierarchy, voice and tone guide,
  and a one-page brand brief. Use when the user asks to define positioning, a
  value proposition, target audience or brand voice, or asks "how should we
  describe this product".
---

# Brand Discovery

Turn what a team knows, and assumes, about its product into a positioning and
messaging foundation that every page, post and pitch can draw from. The output
is a brand brief grounded in evidence: who it is for, what they would use
otherwise, why this is better for them, and how to say it.

## When to use

- A new product, open-source project or pivot needs positioning before any copy is written.
- Messaging is vague ("the modern platform for X"), differs between README, site and docs, or attracts the wrong users.
- Before `/marketing-launch`, a pricing change (`pricing-strategy`) or a site rewrite (`copywriting`).
- The user asks "who is this for", "what makes us different" or "what's our tone".

## When not to use

- Positioning is settled and the user needs words on a page: use `copywriting`.
- Choosing channels, funnels or experiments: use `growth-marketing`.
- Visual identity (logo, palette, type): out of scope. This skill produces the verbal brief a designer works from; for generated visuals see `ai-image-generation`.
- Trademark or legal clearance of names and claims: tell the user to consult counsel.

## Workflow

1. **Collect evidence before asking questions.** Read what exists: README, docs index, landing page source, changelog, issues, support threads, reviews and call notes. Use `find_by_name` for `README*`, `docs/**/*.md` and `*.mdx`, and `grep_search` for `alternative to`, `instead of`, `switched from` and ` vs `. Copy the current one-line description verbatim.

   **Check:** You have a source list, the current tagline, and at least two alternatives that users actually mention.

2. **Run the discovery interview.** Ask from the question bank below in batches of at most five, Must-answer first. Prefer customers' words (quotes, tickets, reviews) over the founder's. Anything unanswered becomes a labelled assumption, never a silent guess.

   **Check:** Every Must-answer question has an answer with a source, or appears under "Assumptions to validate".

3. **Build two or three personas with jobs-to-be-done.** Base each on evidence, separate the user (who evaluates) from the buyer (who approves), and write one job story per persona. More than three personas means the best-fit customer is not decided yet.

   **Check:** Each persona cites at least one real source and names its current alternative.

4. **Write the positioning in Dunford order:** competitive alternatives, then unique attributes, then value, then best-fit customers, then market category. The order matters: an attribute is only unique relative to an alternative, and value only exists for someone. Fill in the canvas below, then condense it into the statement.

   **Check:** Every unique attribute maps to a value and a proof point, and the best-fit segment is narrow enough that you could list ten real teams or people in it.

5. **Derive the messaging hierarchy** from the positioning: one primary message, three value pillars, two or three proof points per pillar, and only the features that prove a pillar.

   **Check:** Every pillar traces to a unique attribute, and no pillar is just a feature name.

6. **Define voice and tone.** Voice is constant; tone shifts with context. Write three or four "we are / we are not" pairs, a tone matrix, and before/after rewrites of the project's own sentences.

   **Check:** The guide contains at least three rewrites taken from existing copy.

7. **Assemble the brand brief as an Antigravity artifact** using the template below and ask the user to review it. Resolve disagreements about the best-fit customer first, because every other section depends on it.

   **Check:** The user approved the brief, or open questions are listed with an owner.

## Discovery question bank

| Area | Must answer | Good to know |
| :--- | :--- | :--- |
| Origin | What problem made you build this? What did you use before? | What did you try that failed? |
| Customers | Who are your ten happiest users, and what do they share (role, team size, stack, trigger)? | Who churned or never activated, and why? |
| Alternatives | If this did not exist, what would those users do? Include "nothing", scripts, spreadsheets and hiring. | Which alternative do you lose to most often? |
| Differentiation | What can you do that the alternatives cannot, or do far better? | What do you deliberately not do? |
| Value | What measurable outcome do users get (time, cost, risk, revenue), and how do you know? | What do users say when they recommend you? |
| Trigger | What event sends someone looking for this? | Where do they search or ask (Google, Reddit, Discord, colleagues)? |
| Business | Who pays and who uses? Self-serve, sales-led or both? | What should the brand achieve in 12 months? |
| Constraints | Claims, comparisons or words you cannot use (legal, partners)? | Existing assets or names to keep? |

## Persona template

```markdown
### Persona: <role + context, e.g. "Platform lead at a 50-person SaaS">
- Context: team size, stack, constraints, who they report to
- Trigger: the event that starts the search
- Job story: When <situation>, I want to <motivation>, so I can <outcome>.
- Forces: push (pain today) / pull (appeal of new) / anxiety (switching fears) / habit (inertia)
- Current alternative: <what they use now>
- Success measure: <what they would report upward>
- Evidence: <links, quotes, ticket ids>
```

For developer tools, the most common anxieties are lock-in, security review, migration cost and "will this project still exist in two years". Address them in the messaging, not only in an FAQ.

## Positioning canvas

| Step | Question | Output | Failure mode |
| :--- | :--- | :--- | :--- |
| 1. Competitive alternatives | What would best-fit customers do if you did not exist? | Two to five alternatives, including the status quo | Listing only direct competitors |
| 2. Unique attributes | What do you have that the alternatives lack? | Capabilities, delivery model, expertise | Unverifiable claims ("fast", "easy") |
| 3. Value and proof | What does each attribute enable, and how can you prove it? | Value themes with metrics, demos or quotes | A feature restated with no proof |
| 4. Best-fit customers | Who cares most about that value? | Observable characteristics (stack, size, trigger) | "Developers", "teams", "everyone" |
| 5. Market category | What frame makes the value obvious? | Category name and how buyers evaluate it | Inventing a category with no budget to educate it |
| Optional: relevant trend | Why now? | A trend that raises urgency | Hype with no link to the value |

Category strategies: compete head-on in an existing category (buyers already know how to evaluate); claim a subsegment ("X for Y", the usual choice for new dev tools); or create a category (slow and expensive, only with the resources to educate a market).

Condensed statement (internal, not customer-facing copy):

```text
For <best-fit customers> who <trigger or need>, <product> is a <category>
that <key value>. Unlike <primary alternative>, it <unique attribute + proof>.
```

## Messaging hierarchy

```text
Primary message: one sentence, the headline-in-waiting
├── Pillar 1: value theme -> proof (metric, benchmark, quote, demo)
├── Pillar 2: value theme -> proof
└── Pillar 3: value theme -> proof
    └── Supporting features: only those that prove a pillar
Pitches: 10 words / 30 seconds / 2 minutes
```

Map which pillar leads for each persona. The platform lead may lead on reliability while the individual developer leads on setup time.

## Voice and tone

| We are | We are not | Example |
| :--- | :--- | :--- |
| Precise | Hedging | "Builds in 4 s on a 2023 laptop", not "blazingly fast builds" |
| Direct | Curt | "This flag is deprecated; use `--out` instead." |
| Candid | Self-deprecating | "Windows support is beta: file watching can miss renames." |

| Context | Formal - casual | Serious - playful | Terse - explanatory |
| :--- | :--- | :--- | :--- |
| Docs and reference | Neutral | Serious | Terse |
| Error messages | Neutral | Serious | Explanatory |
| Launch posts | Casual | Light | Explanatory |
| Incident reports | Formal | Serious | Explanatory |

## Brand brief template

```markdown
# Brand brief: <product> (v<n>, <date>)
## One-liner
## Positioning statement
## Best-fit customers (and who is not a fit)
## Competitive alternatives and why we win against each
## Messaging hierarchy: primary message, 3 pillars with proof
## Personas (job stories, triggers, anxieties)
## Voice: we are / we are not; tone matrix
## Words we use / words we avoid
## Proof library: metrics, quotes, logos, benchmarks, each with a source
## Assumptions to validate, and how
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Start from adjectives ("bold, innovative") | Start from alternatives and proof | Adjectives cannot be verified and every competitor uses them |
| Target "all developers" | Name observable traits of the best-fit segment | Broad targeting produces copy that speaks to no one |
| Invent proof points | Mark gaps as assumptions with a validation plan | Fabricated metrics destroy trust when checked |
| Write the tagline first | Finish the canvas, then write copy | Taglines written early lock in unexamined positioning |
| Let personas multiply | Cap at three and pick a primary | Each extra persona dilutes every message |
| Ignore "do nothing" as an alternative | List the status quo explicitly | Inertia is the most common competitor for dev tools |

## Verification checklist

- [ ] Evidence sources are listed and the current tagline is recorded.
- [ ] All Must-answer questions are answered or recorded as assumptions.
- [ ] The canvas was completed in Dunford order, and each attribute has value and proof.
- [ ] The best-fit segment is concrete enough to name ten real examples.
- [ ] Each pillar has at least two proof points with sources.
- [ ] The voice guide includes before/after rewrites of real copy.
- [ ] The brief was delivered as an artifact and reviewed by the user.

## Related

- Knowledge: `copywriting`, `growth-marketing`, `pricing-strategy`, `seo-audit`, `documentation-writing`.
- Workflows: `/marketing-launch`, `/blueprint` (when positioning changes product scope).
- Agents: `marketing-strategist` (delegate competitor research or a second-opinion positioning pass).
