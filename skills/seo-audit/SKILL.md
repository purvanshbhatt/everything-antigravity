---
name: seo-audit
disable-model-invocation: true
description: >-
  Runs a technical SEO audit of a site, docs portal or landing page:
  crawlability (robots.txt, sitemaps, canonicals), indexation, SSR vs CSR
  rendering, Core Web Vitals, JSON-LD structured data, meta, Open Graph and
  Twitter cards, hreflang, internal links and content gaps, then returns a
  prioritized report. Use when the user asks for an SEO audit, why pages are
  not indexed or ranking, or why link previews look wrong.
---

# Technical SEO Audit

Find what stops search engines from crawling, rendering, indexing and
understanding a site, prove each issue with a URL and command output, and
rank fixes by how many pages they affect. Template-level defects matter far
more than single-page polish.

## When to use

- "Audit our SEO", "why isn't this page indexed", "traffic dropped after the redesign".
- Before a launch or migration (domain change, framework switch, docs re-platform).
- Social link previews show the wrong title, image or none at all.

## When not to use

- Pure page-speed work with no search angle: `web-performance` or the `performance-optimizer` subagent.
- Writing or rewriting page copy: `copywriting` (this skill flags content gaps; it does not write the content).
- Accessibility conformance: `accessibility-a11y` or the `accessibility-auditor` subagent.
- Channel and growth strategy: `growth-marketing`.

## Workflow

1. **Scope and inventory.** Confirm the production domain(s), whether Search Console access exists, and the framework (Next.js, Astro, Docusaurus, SPA). Pull URLs from the sitemap, group them by template (home, docs page, blog post, pricing, changelog), and sample three to five URLs per template. Never audit a staging host as if it were production.

   **Check:** A table of templates with sample URLs and the approximate page count for each.

2. **Crawlability.** Fetch robots.txt, the sitemap and headers for each sample. On Windows use `curl.exe`, because `curl` is an alias in Windows PowerShell 5.1.

   ```bash
   curl -s https://example.com/robots.txt
   curl -s https://example.com/sitemap.xml | head -40
   curl -sIL https://example.com/docs/intro | grep -iE "^(HTTP|location|x-robots-tag)"
   # PowerShell: curl.exe -sIL <url> | Select-String '^(HTTP|location|x-robots-tag)'
   ```

   Look for `Disallow: /` or blocked asset paths (CSS/JS), sitemap URLs that redirect, 404 or are non-canonical, redirect chains longer than one hop, `http` to `https` and trailing-slash inconsistencies, and stray `X-Robots-Tag: noindex`.

   **Check:** Every sample URL returns 200 in at most one redirect, and robots.txt blocks nothing that should rank.

3. **Indexation.** In Search Console, open Indexing > Pages and record counts for reasons such as "Crawled - currently not indexed", "Duplicate without user-selected canonical", "Excluded by 'noindex' tag" and "Blocked by robots.txt". Use URL Inspection on each sample. Without Search Console, `site:` searches give only a rough signal; say so in the report.

   **Check:** Each non-indexed reason with a significant count maps to a template and a suspected cause.

4. **Rendering.** Compare raw HTML with the rendered DOM. Title, meta description, canonical, `h1`, main content and navigation links must be in the server response, not injected later by JavaScript.

   ```bash
   curl -s https://example.com/docs/intro | grep -icE "<title>|rel=\"canonical\"|<h1"
   ```

   Flag hash-based routes (`/#/page`), links rendered as `onClick` handlers instead of `<a href>`, and content loaded only after user interaction. Use `browser-automation` to capture the rendered DOM when needed.

   **Check:** For each template, critical tags and body text are present in the raw HTML.

5. **Core Web Vitals.** Prefer field data (Search Console's Core Web Vitals report, or the `loadingExperience` block from the PageSpeed Insights API) over lab data. Use Lighthouse to diagnose:

   ```bash
   npx lighthouse https://example.com --only-categories=performance,seo --output=html --output-path=./lh-home.html
   curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://example.com&strategy=mobile"
   ```

   **Check:** LCP, INP and CLS are recorded per template at the 75th percentile, with lab diagnostics for any failing metric.

6. **Metadata and social cards.** For each template, check a unique `<title>` (about 50-60 characters; Google truncates by pixel width), meta description (about 150-160 characters), one `h1`, `og:title`, `og:description`, `og:image` (absolute URL, 1200x630), `og:url`, `twitter:card` set to `summary_large_image`, and a favicon. Validate previews with LinkedIn Post Inspector or Facebook Sharing Debugger.

   **Check:** No duplicate titles across a template, and every shared URL renders a correct preview.

7. **Structured data.** Extract JSON-LD blocks, then validate them with the Rich Results Test (Google features) and the Schema Markup Validator at validator.schema.org (syntax). Markup must describe content visible on the page.

   **Check:** Zero errors, and warnings either fixed or justified.

8. **Internationalization** (if there are multiple locales): each page lists every alternate including itself with `hreflang` (`en`, `en-GB`, `pt-BR`), annotations are reciprocal, `x-default` is set, URLs are absolute, and each locale's canonical points to itself, never to another language.

   **Check:** A sample of pages per locale has reciprocal, self-including hreflang sets.

9. **Internal links and content gaps.** Crawl for broken links and orphans (`npx linkinator https://example.com --recurse`). Key pages should be at most three clicks from home with descriptive anchor text. For gaps, export Search Console queries with high impressions and low CTR, or positions 8-20, and list problem-aware topics competitors cover and you don't (error messages, "X vs Y", integrations).

   **Check:** Broken links are listed with source pages, and each content gap names a query and a target page.

10. **Write the report** (format below), ordered by severity, then by pages affected. Deliver it as an artifact. Do not change robots.txt, canonicals or redirects in production without explicit user approval.

## Severity rubric

| Severity | Meaning | Examples |
| :--- | :--- | :--- |
| P0 | Blocks indexing or ranking site-wide | `Disallow: /` or `noindex` in production; canonicals pointing to staging; JS-only content on all pages |
| P1 | Template-level defect affecting many pages | Duplicate titles across docs; sitemap full of redirects; failing LCP on every blog post |
| P2 | Page-level defect | Missing OG image on pricing; broken internal link |
| P3 | Enhancement | Add BreadcrumbList; improve anchor text |

## Core Web Vitals thresholds (75th percentile of page loads)

| Metric | Good | Needs improvement | Poor |
| :--- | :--- | :--- | :--- |
| LCP | <= 2.5 s | <= 4.0 s | > 4.0 s |
| INP | <= 200 ms | <= 500 ms | > 500 ms |
| CLS | <= 0.1 | <= 0.25 | > 0.25 |

## Structured data reference

Use `Organization` and `WebSite` on the home page, `BreadcrumbList` on docs, `Article` or `BlogPosting` on posts, and `SoftwareApplication` on the product page.

```html
<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "SoftwareApplication",
  "name": "Example CLI", "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Windows, macOS, Linux",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" } }
</script>
```

Google's software rich result also requires ratings or reviews; add `aggregateRating` only if real reviews are visible on the page, and check Search Central for current required properties. FAQ and HowTo rich results have been restricted or retired, so do not promise them.

## Report format

```markdown
## SEO audit: <domain> (<date>)
Summary: <3 sentences: biggest risk, pages affected, top fix>
| ID | Sev | Issue | Evidence (URL + output) | Scope | Fix | Effort |
| SEO-1 | P0 | ... | ... | all docs pages | ... | S/M/L |
### Field data: LCP / INP / CLS per template
### Content gaps: query -> target page
### Not checked: <areas and why, e.g. no Search Console access>
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Block a page in robots.txt to remove it from the index | Serve `noindex` and leave it crawlable until it drops out | A blocked page's `noindex` is never seen, so the URL can stay indexed |
| Canonicalize to a redirecting or non-200 URL | Point to the final 200, indexable URL | Conflicting signals make search engines ignore the canonical |
| Lazy-load the hero (LCP) image | Load it eagerly with `fetchpriority="high"` | Lazy-loading the LCP element delays it |
| Chase a lab Lighthouse score of 100 | Fix failing field metrics first | Rankings use field data, not one lab run |
| Add `meta keywords` | Spend the effort on titles and content | Google ignores the keywords meta tag |
| Mark up content that is not on the page | Keep JSON-LD consistent with visible content | Mismatched markup can earn a manual action |

## Verification checklist

- [ ] Every template was sampled, and staging was excluded.
- [ ] Each finding has a URL, command output or screenshot as evidence.
- [ ] Raw HTML was checked for critical tags on every template.
- [ ] Core Web Vitals use field data where available, with the source stated.
- [ ] JSON-LD was validated with both validators.
- [ ] Findings are ranked P0-P3, with a "Not checked" section.
- [ ] No production SEO configuration was changed without user approval.

## Related

- Knowledge: `web-performance`, `frontend-react-nextjs`, `accessibility-a11y`, `browser-automation`, `copywriting`, `growth-marketing`.
- Workflows: `/marketing-launch` (pre-launch SEO gate), `/verify`.
- Agents: `performance-optimizer` (LCP/INP fixes), `accessibility-auditor`, `marketing-strategist`.
