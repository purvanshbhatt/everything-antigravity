---
name: cdn-edge-cloudflare
disable-model-invocation: true
description: >-
  Configures CDNs and edge compute: Cache-Control design, cache keys and
  bypass rules, Cloudflare Cache Rules and purges, Cloudflare Workers with
  wrangler (dev, secrets, gradual deploys, rollback), WAF and rate limiting,
  origin lock-down, image resizing, plus Cloud CDN and Cloud Armor
  equivalents. Use when assets are slow or stale, a cache serves the wrong
  content, edge logic is needed, or a site needs WAF protection.
---

# CDN and Edge (Cloudflare and Cloud CDN)

Make the origin state its caching intent with correct headers, let the CDN
cache only what is safe to share, lock the origin so traffic cannot bypass the
edge, and keep edge code small, versioned and easy to roll back.

## When to use

- Static assets are slow, or users see stale or someone else's content.
- Setting cache rules, purging, or deciding what may be cached.
- Writing a Cloudflare Worker (redirects, auth at the edge, A/B routing, API proxy).
- Adding WAF, bot or rate-limiting protection; image resizing at the edge.

## When not to use

- DNS records, certificates and HSTS: use `dns-tls`.
- Load balancer and VPC setup behind Cloud CDN: use `cloud-networking`.
- Front-end bundle size and Core Web Vitals: use `web-performance`.
- Object storage settings for the origin bucket: use `cloud-storage-gcs`.

## Workflow

Commands are cross-platform; in Windows PowerShell call `curl.exe` (not the `curl` alias). DNS, WAF and cache changes affect live traffic: confirm each with the user.

1. **Measure current behaviour.**

   ```bash
   curl -sI https://example.com/assets/app.3f2a1c.js | grep -iE "cache-control|age|cf-cache-status|etag|vary"
   curl -sI https://example.com/ | grep -iE "cache-control|cf-cache-status|set-cookie"
   ```

   `cf-cache-status` values: `HIT`, `MISS`, `EXPIRED`, `REVALIDATED`, `BYPASS`, `DYNAMIC` (not eligible for cache). On Cloud CDN, a growing `age` header means a cache hit.

   **Check:** You have a table of URL classes (hashed assets, HTML, API, user pages) with their current headers and hit status.

2. **Set origin headers per class.**

   | Class | `Cache-Control` |
   | :--- | :--- |
   | Fingerprinted assets (`app.3f2a1c.js`) | `public, max-age=31536000, immutable` |
   | HTML shell | `public, max-age=0, s-maxage=60, stale-while-revalidate=30` or `no-cache` |
   | Public API reads | `public, s-maxage=30, stale-while-revalidate=60` |
   | Personalised or authenticated | `private, no-store` |

   `s-maxage` applies to shared caches only; `Vary` multiplies cache entries, so vary only on headers that truly change the body.

   **Check:** No response with `Set-Cookie` or user-specific data is marked `public`.

3. **Configure the CDN to respect them.** Cloudflare caches by file extension by default and does not cache HTML. To cache HTML or API responses, add a Cache Rule (dashboard: Caching, Cache Rules) that matches the path and sets "Eligible for cache", with a bypass when the session cookie is present, for example the expression `http.request.uri.path wildcard "/blog/*" and not http.cookie contains "session="`. Cloud CDN: `--cache-mode=USE_ORIGIN_HEADERS` on the backend respects origin headers; `CACHE_ALL_STATIC` caches common static types.

   **Check:** Repeat requests show `HIT` for intended classes and `BYPASS` or `DYNAMIC` for logged-in requests.

4. **Purge precisely.** Prefer versioned URLs over purges. When needed:

   ```bash
   curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
     -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
     --data '{"files":["https://example.com/index.html"]}'
   gcloud compute url-maps invalidate-cdn-cache URL_MAP --path="/index.html" --global
   ```

   Use an API token scoped to "Cache Purge" for one zone. `{"purge_everything":true}` sends all traffic to the origin at once: confirm first.

   **Check:** The next request shows `MISS` then `HIT`, with the new content.

5. **Lock the origin to the edge.** Use Cloudflare Tunnel (`cloudflared`) or Authenticated Origin Pulls, or allowlist the published Cloudflare IP ranges at the origin firewall; on Google Cloud, set Cloud Run ingress to `internal-and-cloud-load-balancing`. Use SSL mode Full (strict), never Flexible.

   **Check:** A request straight to the origin hostname or IP is refused.

6. **Build Workers with wrangler.**

   ```bash
   npm create cloudflare@latest my-worker
   npx wrangler dev                    # local
   npx wrangler secret put API_KEY     # prompts; value never on the command line
   npx wrangler deploy                 # confirm before production
   npx wrangler tail                   # live logs
   npx wrangler rollback               # previous version
   ```

   For gradual rollouts use `npx wrangler versions upload` then `npx wrangler versions deploy` with a percentage. Set `compatibility_date` in `wrangler.toml` or `wrangler.jsonc` and bump it deliberately.

   ```js
   export default {
     async fetch(request, env, ctx) {
       const url = new URL(request.url);
       if (request.method !== "GET" || url.pathname.startsWith("/api/")) return fetch(request);
       const cache = caches.default;
       let res = await cache.match(request);
       if (res) return res;
       const origin = await fetch(request);
       res = new Response(origin.body, origin);          // mutable copy
       if (origin.ok && !origin.headers.has("Set-Cookie")) {
         res.headers.set("Cache-Control", "public, s-maxage=300");
         ctx.waitUntil(cache.put(request, res.clone()));
       }
       return res;
     },
   };
   ```

   **Check:** `wrangler dev` tests pass, and `wrangler tail` shows no exceptions after deploy.

7. **Add protection.** Cloudflare: managed WAF rulesets, custom rules, and rate limiting rules on login and API paths, first in log mode then block. Google Cloud: Cloud Armor on the backend service.

   ```bash
   gcloud compute security-policies create edge-policy
   gcloud compute security-policies rules create 1000 --security-policy=edge-policy \
     --expression="evaluatePreconfiguredWaf('sqli-v33-stable')" --action=deny-403
   gcloud compute backend-services update api-be --global --security-policy=edge-policy
   ```

   Preconfigured rule names change between versions; list them with `gcloud compute security-policies list-preconfigured-expression-sets`.

   **Check:** Logged matches were reviewed for false positives before switching to block.

8. **Resize images at the edge.** Cloudflare image transformations (enable on the zone): `/cdn-cgi/image/width=800,quality=75,format=auto/https://example.com/hero.jpg`. Cloud CDN has no built-in transform; pre-generate sizes or run a resize service. Always serve `srcset` with sensible widths.

   **Check:** The response `content-type` is AVIF or WebP for supporting browsers and the byte size dropped.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Cache everything including HTML with cookies | Bypass on session cookie; `private` for user pages | Users see each other's data |
| Long `max-age` on unversioned files | Fingerprinted filenames plus `immutable` | Stale assets until every cache expires |
| Purge everything on each deploy | Versioned assets, targeted purges | Origin stampede and slow first loads |
| SSL mode Flexible | Full (strict) with a valid origin cert | Edge-to-origin traffic is plain HTTP |
| Origin reachable directly | Tunnel, origin pulls or IP allowlist | Attackers bypass WAF and cache |
| WAF rules straight to block | Log, review, then block | False positives break real users |

## Verification checklist

- [ ] Each URL class has deliberate `Cache-Control` and verified hit or bypass status.
- [ ] Nothing personalised or cookie-bearing is cached publicly.
- [ ] The origin refuses direct traffic; TLS is Full (strict).
- [ ] Workers deploy through versions with a tested rollback; secrets set via `wrangler secret put`.
- [ ] WAF and rate limits ran in log mode before blocking; changes were confirmed by the user.

## Related

- Knowledge: `dns-tls`, `cloud-networking`, `cloud-storage-gcs`, `web-performance`, `nginx-proxy`, `serverless-functions`, `api-security`.
- Workflows: `/perf-audit`.
- Agents: `performance-optimizer`, `security-guard`.
