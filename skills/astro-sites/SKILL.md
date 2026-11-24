---
name: astro-sites
disable-model-invocation: true
description: >-
  Builds fast content sites with Astro: zero-JS pages, islands with client
  directives, server islands, content collections with loaders and zod schemas,
  MDX, static vs on-demand rendering with adapters, astro:assets images, view
  transitions, sitemaps and RSS. Use when creating or reviewing an Astro blog,
  docs, marketing or portfolio site, or adding React, Vue or Svelte components
  to one.
---

# Astro Content Sites

Ship HTML by default and hydrate only the components that need interaction.
Keep content typed through collections so a bad frontmatter field fails the
build instead of the page. Astro reworked content and rendering in v5, so
confirm the major before copying examples.

## When to use

- Starting a blog, docs, landing or portfolio site where most pages are content.
- Adding a collection, MDX support, a framework island or on-demand routes.
- A content site ships too much JavaScript or has slow LCP.
- Migrating older Astro content (`src/content/config.ts`, `slug`, `output: 'hybrid'`).

## When not to use

- App-like products with heavy client state on every page: use `frontend-react-nextjs`, `svelte-kit` or `vue-nuxt`.
- Search-engine audits and structured data strategy: use `seo-audit`.
- Detailed Core Web Vitals work: use `web-performance`.

## Workflow

1. **Pin the version and integrations.**

   ```bash
   npm ls astro
   npx astro info
   npx @astrojs/upgrade            # guided upgrade; commit first
   ```

   Astro 5 introduced the Content Layer (`src/content.config.ts`, loaders, `entry.id` instead of `slug`), merged `hybrid` into `static` (opt out per page with `prerender = false`) and renamed `<ViewTransitions />` to `<ClientRouter />`. Check the upgrade guide for any later major.

   **Check:** You know the major, `output` mode, adapter (if any) and integrations in `astro.config.*`.

2. **Add integrations with the CLI.** It installs packages and edits config.

   ```bash
   npx astro add mdx sitemap
   npx astro add react             # or vue, svelte, preact, solid
   ```

   Set `site: 'https://example.com'` in config; sitemap, canonical URLs and RSS depend on it.

   **Check:** `npx astro check` passes after each addition.

3. **Model content as collections.**

   ```ts
   // src/content.config.ts
   import { defineCollection, z } from 'astro:content'; // some majors move z to 'astro/zod'; follow your version's docs
   import { glob } from 'astro/loaders';

   const blog = defineCollection({
     loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
     schema: ({ image }) => z.object({
       title: z.string(),
       description: z.string().max(160),
       pubDate: z.coerce.date(),
       draft: z.boolean().default(false),
       cover: image().optional(),
       tags: z.array(z.string()).default([]),
     }),
   });

   export const collections = { blog };
   ```

   **Check:** A post with a missing `title` fails `npx astro build` with a schema error.

4. **Generate pages from collections.**

   ```astro
   ---
   // src/pages/blog/[...id].astro
   import { getCollection, render } from 'astro:content';
   import Base from '../../layouts/Base.astro';

   export async function getStaticPaths() {
     const posts = await getCollection('blog', ({ data }) => import.meta.env.PROD ? !data.draft : true);
     return posts.map((post) => ({ params: { id: post.id }, props: { post } }));
   }
   const { post } = Astro.props;
   const { Content } = await render(post);
   ---
   <Base title={post.data.title} description={post.data.description}>
     <article><h1>{post.data.title}</h1><Content /></article>
   </Base>
   ```

   **Check:** Drafts are absent from the production build output in `dist/`.

5. **Hydrate only what needs it.** Every framework component renders to static HTML unless it has a `client:*` directive (table below). Prefer `client:visible` or `client:idle`; reserve `client:load` for above-the-fold controls. Use `server:defer` (server islands) for personalized fragments on otherwise cached pages; it needs an adapter.

   **Check:** The page's JS payload in the build output matches the islands you intended; static pages ship no framework runtime.

6. **Choose rendering per route.** Default is static. For on-demand routes (auth, search, forms), add an adapter (`npx astro add node` for Cloud Run or any container) and `export const prerender = false` on those pages only.

   **Check:** `npx astro build` lists which routes were prerendered and which are on-demand.

7. **Optimize images and fonts.** Use `<Image />` or `<Picture />` from `astro:assets` with imported local files (sizes inferred) or allow-listed remote domains (`image.domains` or `image.remotePatterns`, with explicit `width` and `height`). Self-host fonts and preload only the primary weight.

   **Check:** Lighthouse shows no unsized images and LCP image is not lazy-loaded.

8. **Build and preview.**

   ```bash
   npx astro check && npx astro build && npx astro preview
   ```

   **Check:** Links, RSS (`@astrojs/rss`) and `sitemap-index.xml` resolve on the preview server.

## Patterns

### Client directives

| Directive | Hydrates | Use for |
| :--- | :--- | :--- |
| none | Never (static HTML) | Default for everything |
| `client:load` | Immediately | Critical above-the-fold controls |
| `client:idle` | When the main thread is idle | Non-critical widgets |
| `client:visible` | When scrolled into view | Below-the-fold carousels, comments |
| `client:media="(max-width: 50em)"` | When the query matches | Mobile-only menus |
| `client:only="react"` | Client only, no SSR | Components that touch `window` at import |

### Where data comes from

| Source | Approach |
| :--- | :--- |
| Markdown or MDX in the repo | `glob` loader collection |
| JSON or YAML file | `file` loader collection |
| Headless CMS or API | Custom or community loader, fetched at build; rebuild on publish via webhook |
| Per-request data | On-demand route or server island |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `client:load` on every component | No directive, or `client:visible`/`client:idle` | Defeats Astro's zero-JS default |
| Wrap the whole page in one React island | Islands for interactive parts only | Ships a full SPA runtime |
| Untyped frontmatter read with `Astro.glob` | Content collections with a schema | Bad data fails at build, not in production |
| Plain `<img>` for local images | `<Image />` from `astro:assets` | Missing sizes, formats and dimensions cause CLS |
| `output: 'server'` for a mostly static site | Static default plus `prerender = false` where needed | Every page becomes slower and costlier |
| Omit `site` in config | Set the production URL | Sitemap and canonical URLs break |

## Verification checklist

- [ ] Astro major known; `npx astro check` passes.
- [ ] All content goes through typed collections; drafts excluded from production.
- [ ] Only interactive components hydrate, with the lightest directive that works.
- [ ] On-demand routes are explicit and have an adapter.
- [ ] Images use `astro:assets`; sitemap and RSS resolve on preview.

## Related

- Knowledge: `seo-audit`, `web-performance`, `css-architecture`, `tailwind-css`, `i18n-localization`, `cloud-run`, `cdn-edge-cloudflare`.
- Workflows: `/perf-audit`, `/a11y-audit`, `/dockerize`.
- Agents: `frontend-engineer`, `performance-optimizer`, `accessibility-auditor`.
