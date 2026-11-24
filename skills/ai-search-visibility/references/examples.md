# AI search visibility: examples

Templates for the files and records the skill produces. Replace the example company, URLs and facts with real ones; never ship placeholder claims.

## llms.txt

Served at `https://www.example.com/llms.txt` as plain text (Markdown syntax). The format proposal asks for an H1 with the site or project name, a short blockquote summary, then sections of links with one-line notes. A section named "Optional" holds links a reader can skip.

```markdown
# Acme Flags

> Acme Flags is an open-source feature-flag service for mobile and web teams.
> It runs self-hosted or as a managed cloud service and has SDKs for iOS,
> Android, React Native, Flutter and JavaScript.

Pricing is per seat; the self-hosted edition is free under the Apache-2.0 license.

## Docs

- [Quickstart](https://www.example.com/docs/quickstart.md): install an SDK and evaluate a first flag
- [Targeting rules](https://www.example.com/docs/targeting.md): segments, percentage rollouts and rule order
- [Self-hosting](https://www.example.com/docs/self-hosting.md): Docker and Kubernetes deployment, backups

## Product

- [Pricing](https://www.example.com/pricing): plans, seat pricing and limits
- [Comparison with other flag services](https://www.example.com/compare): features and hosting options side by side

## Optional

- [Changelog](https://www.example.com/changelog): release notes by version
```

Keep it short and current: it is an index, not a copy of the site. Update it in the same change that adds or removes a key page.

## JSON-LD

Place in the page `<head>` or body as `<script type="application/ld+json">`. Mark up only facts that are visible on the page.

Organization, on the home page:

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Acme Flags",
  "url": "https://www.example.com/",
  "logo": "https://www.example.com/logo.png",
  "description": "Open-source feature-flag service for mobile and web teams.",
  "sameAs": [
    "https://github.com/example/acme-flags",
    "https://www.linkedin.com/company/example"
  ]
}
```

Article, on a guide or blog post:

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "How percentage rollouts work in Acme Flags",
  "author": { "@type": "Person", "name": "Dana Reyes", "url": "https://www.example.com/team/dana-reyes" },
  "publisher": { "@type": "Organization", "name": "Acme Flags" },
  "datePublished": "2026-09-14",
  "dateModified": "2026-11-20"
}
```

SoftwareApplication, on the product or pricing page:

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Acme Flags Cloud",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Web",
  "offers": { "@type": "Offer", "price": "12.00", "priceCurrency": "USD" }
}
```

Notes:

- Add `aggregateRating` or `review` only for real reviews collected on your own site under the search engines' review policies.
- `FAQPage` and `HowTo` markup are still valid schema.org types, but Google no longer shows rich results for them on most sites; do not promise a search feature from them.
- Validate with the Rich Results Test and the Schema Markup Validator after every template change.

## Answer passage pattern

```markdown
## How much does Acme Flags cost?

Acme Flags Cloud costs $12 per seat per month, billed annually, and the
self-hosted edition is free under the Apache-2.0 license. All plans include
unlimited flags and environments. (Prices as of 20 Nov 2026.)

| Plan | Price | Seats | Support |
| :--- | :--- | :--- | :--- |
| Self-hosted | Free | Unlimited | Community |
| Cloud | $12 per seat per month | 5 minimum | Email, 1 business day |
```

The heading is the question, the first sentences answer it with specific facts and a date, and the table carries the detail.

## Citation tracking sheet

One row per query, engine and sample. Keep the method fixed between runs.

```csv
date,engine,location,session,query,intent,priority,cited,cited_url,mentioned_without_link,description_accurate,competitors_cited,notes
2026-11-23,Perplexity,US,logged-out,best self-hosted feature flag service,category,high,yes,https://www.example.com/compare,no,yes,"FlagCo; Toggly",
2026-11-23,Google AI Overview,US,logged-out,acme flags pricing,brand,high,no,,yes,no,,"quoted 2024 price; fix old press page"
```

Summaries to report each month: citation rate per engine for high-priority queries, accuracy rate of descriptions, the competitors cited most often, and AI referral sessions from analytics, each compared with the baseline.
