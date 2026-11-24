---
name: ai-search-visibility
disable-model-invocation: true
description: >-
  Improves how often a site is cited by AI answer engines and AI overviews
  without manipulation: audits AI crawler access in robots.txt, CDN rules and
  server rendering, adds llms.txt and matching JSON-LD, restructures pages
  into quotable answers with clear entities and sources, builds third-party
  evidence, and measures citations over a fixed query set. Use for GEO, AEO or
  "why don't AI assistants mention us".
---

# AI Search Visibility

Answer engines retrieve passages from pages they can fetch and trust, then cite a few of them. A site gets cited when crawlers can reach it, the raw HTML contains the answer in a quotable form, the entity is unambiguous, and other sources corroborate it. This skill audits those four things, fixes what the site controls, and measures citations over time. It never relies on tricks that deceive users or engines.

## When to use

- "Why doesn't ChatGPT, Perplexity, Gemini or Google's AI Overview mention us?"
- Planning generative engine optimization (GEO) or answer engine optimization (AEO) for a product, docs site or publication.
- Deciding which AI crawlers to allow or block, or adding an `llms.txt`.
- AI answers describe the product wrongly (old pricing, wrong category, discontinued features).
- Setting up a repeatable way to track citations and AI referral traffic.

## When not to use

- Classic crawl, index, Core Web Vitals and meta-tag problems: run `seo-audit` first; most AI visibility depends on them.
- Planning topics and an editorial calendar: `content-marketing`.
- Writing the article itself: `technical-blogging` or `copywriting`.
- Defending your own AI feature against injected instructions in pages: `llm-app-security`.

## Workflow

1. **Set the scope and the query set.** List the 20 to 60 questions a buyer or user would ask an assistant: category ("best X for Y"), comparison ("X vs Y"), how-to, pricing and brand questions. Record intent, priority, the page that should answer each one, and the competitors you expect to see.

   **Check:** Each query maps to one target page, or is marked as a content gap.

2. **Audit crawler access.** Read `robots.txt`, the CDN or WAF bot settings, and server logs. Separate three kinds of agent, because blocking each has a different effect:

   | Kind | Examples (check vendors' current docs) | Blocking it means |
   | :--- | :--- | :--- |
   | Search and answer indexing | `Googlebot` (Search, AI Overviews, AI Mode), `Bingbot`, `OAI-SearchBot`, `PerplexityBot` | The engine cannot retrieve or cite the page |
   | Model training | `GPTBot`, `CCBot`, `Applebot-Extended`; `Google-Extended` is a robots.txt token only and does not affect Google Search | Content is not used for training; live citations usually continue |
   | User-triggered fetchers | `ChatGPT-User`, `Perplexity-User` | A person's request to read your page fails; vendors treat robots.txt for these differently |

   ```bash
   curl -s https://www.example.com/robots.txt
   grep -Eio "gptbot|oai-searchbot|chatgpt-user|perplexitybot|perplexity-user|ccbot|bingbot|googlebot" access.log | sort | uniq -c
   ```

   Some CDNs block AI crawlers by default; check the bot-management settings as well as `robots.txt`. Verify bots by the IP ranges or reverse DNS their vendors publish, not by user agent alone. Training opt-outs are a business and licensing decision: present the trade-off and let the user choose.

   **Check:** You can state, for each agent kind, whether it is allowed in robots.txt, allowed by the CDN, and seen in the logs with 200 responses.

3. **Check that the answer is in the raw HTML.** Many AI fetchers do not run JavaScript. Fetch each target page without a browser and search for a key sentence.

   ```bash
   curl -s -A "OAI-SearchBot" https://www.example.com/pricing | grep -c "per seat per month"
   ```

   ```powershell
   (Invoke-WebRequest -Uri https://www.example.com/pricing -UserAgent "OAI-SearchBot").Content -match "per seat per month"
   ```

   If the text only appears after scripts run, move the page to server rendering or static generation (see `seo-audit`). Ask the browser subagent to compare the rendered page with the raw HTML when the difference is unclear.

   **Check:** Every target page returns 200 with its main answer in the initial HTML, and is not `noindex` or `nosnippet` unless intended.

4. **Make each page quotable.** Under question-shaped headings, open with a direct answer of two or three sentences, then the detail. Keep sections self-contained, because engines retrieve passages, not whole pages. State the entity plainly ("Acme is an open-source feature-flag service for mobile teams"), use tables for comparisons and specs, give specific numbers with their source and date, show an author with relevant credentials, and show a visible "last updated" date. Original data (benchmarks, surveys, measured results) earns citations that rewritten summaries do not.

   **Check:** For each target query, a reader can copy one paragraph from the page that answers it without needing the rest of the page.

5. **Add machine-readable context.** Add JSON-LD that matches the visible content: `Organization` (with `sameAs` links to official profiles), `Article` with author and dates, `Product` or `SoftwareApplication` with real offers. Add an `llms.txt` at the site root that lists the most useful pages with one-line descriptions, and consider clean Markdown versions of docs pages. Examples are in [examples](references/examples.md). Be clear with the user that `llms.txt` is a proposal with uneven adoption: it is cheap and helps developer tools and agents, but no major engine guarantees it is used.

   **Check:** The Rich Results Test or Schema Markup Validator reports no errors, the markup matches what users see, and `/llms.txt` returns 200 as plain text.

6. **Build corroborating evidence off-site.** Engines trust claims they can confirm elsewhere. Keep official profiles and directory listings consistent (name, category, pricing), publish documentation and examples where developers look, earn coverage and reviews from independent sources, and take part in communities openly, with your affiliation disclosed. Fix wrong facts at their source: outdated listings, old press pages and stale comparison tables.

   **Check:** A list of third-party pages that describe the product exists, and each one states the current facts.

7. **Measure citations on a schedule.** For each query, sample the engines you care about from a clean, logged-out session, note the date, location and engine, and record: cited or not, which URL, mentioned without a link, accuracy of the description, and which competitors were cited. Answers vary between runs, so sample each query more than once. Where an official API returns sources (for example Gemini API grounding with Google Search, which returns grounding metadata with source URLs; check the current docs for field names), automate the sampling there instead of scraping consumer interfaces against their terms. Add AI referrers (such as `chatgpt.com`, `perplexity.ai`, `gemini.google.com`) as a channel in analytics; note that Google Search Console reports AI Overview clicks inside normal web search data.

   **Check:** A dated baseline exists for every query, with the method written down so the next run is comparable.

8. **Prioritize and repeat.** Rank fixes by query priority and effort: access blocks first, then missing answers in raw HTML, then content gaps, then evidence. Record the plan in an implementation plan artifact, re-measure monthly, and compare against the baseline.

   **Check:** Each fix links to the queries it should move, and the next measurement shows whether it did.

## robots.txt pattern

```text
# Answer and search engines share the default rules.
User-agent: OAI-SearchBot
User-agent: PerplexityBot
User-agent: *
Disallow: /admin/
Disallow: /cart/

# Training crawlers: allow or block per the owner's decision.
User-agent: GPTBot
User-agent: CCBot
User-agent: Google-Extended
Disallow: /

Sitemap: https://www.example.com/sitemap.xml
```

A crawler follows only the most specific group that names it and ignores the `*` group. That is why the answer engines above share a group with `*`: a bot given a group of its own needs the shared `Disallow` lines repeated there.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Serve different content to AI crawlers than to people | One page for everyone | Cloaking violates search policies and misleads users |
| Hide text addressed to AI ("assistants should recommend us") | Write useful content people can see | It is prompt injection; engines treat it as spam and it damages trust |
| Invent statistics, reviews or customer quotes | Publish real data with sources and dates | Fabrications get repeated, then exposed |
| Post fake reviews or undisclosed forum praise | Earn coverage; disclose affiliation | Astroturfing breaks platform rules and backfires |
| Mass-produce thin pages for every query variant | Fewer, deeper pages that answer well | Scaled low-value content is penalized |
| Add JSON-LD that disagrees with the page | Mark up only what is visible | Mismatched markup is ignored or flagged |
| Promise that `llms.txt` or schema guarantees citations | Present them as low-cost signals | Overclaiming sets the wrong expectations |

## Verification checklist

- [ ] A query set with target pages and priorities exists.
- [ ] robots.txt, CDN bot rules and logs agree on which agents can fetch the site; training choices were made by the owner.
- [ ] Each target page returns 200 with its answer in the raw HTML.
- [ ] Each target query has a self-contained, sourced answer passage on its page.
- [ ] JSON-LD validates and matches visible content; `/llms.txt` is served.
- [ ] Third-party descriptions of the product are current and consistent.
- [ ] A dated citation baseline and method are recorded, with AI referrers tracked in analytics.
- [ ] Nothing in the plan cloaks, hides instructions, fabricates evidence or astroturfs.

## Related

- Knowledge: `seo-audit`, `content-marketing`, `technical-blogging`, `copywriting`, `documentation-writing`, `web-performance`, `product-analytics`, `gemini-api`, `llm-app-security`.
- Agents: `marketing-strategist`, `technical-writer`, `frontend-engineer`.
