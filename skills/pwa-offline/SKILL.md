---
name: pwa-offline
disable-model-invocation: true
description: >-
  Turns a web app into a reliable Progressive Web App: manifest and
  installability, service worker lifecycle and safe updates, caching strategies
  with Workbox or vite-plugin-pwa, offline data with IndexedDB and an outbox
  queue, Background Sync, install prompts, Web Push with VAPID, and storage
  quotas. Use when adding offline support, an install experience or web push,
  or fixing stale service-worker caches.
---

# PWA and Offline

A service worker is a programmable proxy that outlives your deploys. Decide
exactly what must work offline, generate the worker with tooling, make updates
user-visible, and design writes so they can be replayed safely.

## When to use

- Users need the app on flaky networks, offline, or installed on a home screen or dock.
- Adding web push notifications.
- Users see old versions after deploys, or cached API data leaks between accounts.

## When not to use

- Native push through FCM or APNs for mobile apps: use `push-notifications`.
- CDN and HTTP caching: use `cdn-edge-cloudflare` and `web-performance`.
- Full native apps: use `flutter-mobile` or `react-native-expo`.

## Workflow

1. **Define the offline contract.** List the routes and data that must work offline (app shell only, read-only content, drafts, or full create/update), the acceptable staleness for each, and the conflict policy. Put it in an implementation plan artifact for the user to approve.

   **Check:** Each route and API has a named caching strategy from the table below.

2. **Add the manifest.**

   ```json
   {
     "id": "/",
     "name": "Acme Tasks",
     "short_name": "Tasks",
     "start_url": "/?source=pwa",
     "scope": "/",
     "display": "standalone",
     "background_color": "#ffffff",
     "theme_color": "#1d4ed8",
     "icons": [
       { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
       { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png" },
       { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
     ]
   }
   ```

   Link it with `<link rel="manifest" href="/manifest.webmanifest">`. Service workers require HTTPS (localhost is exempt).

   **Check:** DevTools > Application > Manifest shows no installability errors.

3. **Generate the service worker with tooling.** Use `vite-plugin-pwa` for Vite apps, Serwist for Next.js, or Workbox (`npx workbox-cli wizard`) elsewhere.

   ```ts
   // vite.config.ts
   VitePWA({
     registerType: 'prompt',
     manifest: false,                                   // using public/manifest.webmanifest
     workbox: {
       globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
       navigateFallback: '/index.html',
       navigateFallbackDenylist: [/^\/api\//],
       runtimeCaching: [
         { urlPattern: ({ url }) => url.pathname.startsWith('/api/'), handler: 'NetworkFirst',
           options: { cacheName: 'api', networkTimeoutSeconds: 3, expiration: { maxEntries: 100, maxAgeSeconds: 86400 } } },
         { urlPattern: ({ request }) => request.destination === 'image', handler: 'StaleWhileRevalidate',
           options: { cacheName: 'images', expiration: { maxEntries: 200 } } },
       ],
     },
   })
   ```

   **Check:** With DevTools "Offline" ticked, the shell and the promised routes load.

4. **Make updates safe and visible.** Serve the worker script with `Cache-Control: no-cache`. With `registerType: 'prompt'`, show "A new version is available" with a Reload button that activates the waiting worker. Avoid silent `skipWaiting` when old pages could request assets the new deploy removed.

   **Check:** Deploy twice in staging; the open tab offers the update and reloads into the new version without errors.

5. **Protect user data in caches.** Do not cache authenticated API responses unless the offline contract requires it; when you do, scope cache names per user and delete them (`caches.delete`) and IndexedDB data on logout.

   **Check:** Log out, log in as another user offline; none of the first user's data appears.

6. **Queue offline writes in an outbox.** Write to IndexedDB (the `idb` wrapper helps) with a client-generated id, show the change optimistically, and replay the queue when connectivity returns: on the `online` event, at app start, and with Background Sync where supported (Chromium; `workbox-background-sync` wraps it). Make the server endpoints idempotent on the client id, and resolve conflicts with a version or `updatedAt` check that returns 409 for the UI to handle.

   **Check:** Create items offline, close the tab, reopen online; each item syncs exactly once.

7. **Design install UX per platform.** Chromium fires `beforeinstallprompt`: store the event and show your own Install button after meaningful engagement. iOS and iPadOS have no prompt event: show brief "Share, then Add to Home Screen" guidance. Detect installed mode with `matchMedia('(display-mode: standalone)')`.

   **Check:** The install button appears only where installation is possible and not yet done.

8. **Add Web Push only with consent in context.** Ask for permission after a user action that explains the value. Generate VAPID keys once and keep the private key in a secret manager.

   ```js
   const reg = await navigator.serviceWorker.ready;
   const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidPublicKeyBytes });
   await fetch('/api/push/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub) });
   ```

   In the worker, handle `push` with `event.waitUntil(self.registration.showNotification(title, options))` and `notificationclick` by focusing or opening a client. On iOS, web push works only for apps added to the home screen (16.4+). Delete subscriptions when the push service returns 404 or 410.

   **Check:** A test notification arrives and clicking it opens the right URL.

9. **Respect storage limits.** Check `navigator.storage.estimate()`, request `navigator.storage.persist()` for important offline data, set cache expiration, and handle `QuotaExceededError`. Browsers can evict storage for sites that are not installed or not used recently; check each browser's current policy.

   **Check:** The app recovers gracefully when caches are cleared (DevTools > Application > Clear site data).

## Patterns

### Caching strategies

| Strategy | Behaviour | Use for |
| :--- | :--- | :--- |
| Precache | Cached at install, versioned by build | App shell, hashed JS and CSS |
| Cache first | Cache, then network on miss | Fonts, hashed assets, immutable media |
| Stale-while-revalidate | Serve cache, refresh in background | Avatars, non-critical images, config |
| Network first (with timeout) | Network, fall back to cache | API reads that should be fresh but work offline |
| Network only | Never cached | Auth, payments, writes |

### Testing tools

DevTools > Application (Service workers: Offline, Update on reload, Bypass for network), Playwright `context.setOffline(true)`, and real devices for install and push. Lighthouse no longer has a PWA category, so rely on the Manifest panel for installability.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Hand-write precache lists | Generate with Workbox tooling | Missed or stale files after deploys |
| Cache `sw.js` with long max-age | `Cache-Control: no-cache` | Browsers cannot see updates promptly |
| Prompt for push on page load | Ask after a contextual action | Users deny, and the browser may block future prompts |
| Cache authenticated responses globally | Per-user caches cleared on logout | Data leaks on shared devices |
| Replay offline writes without ids | Client ids plus idempotent endpoints | Duplicates after retries |

## Verification checklist

- [ ] Offline contract approved; each route has a strategy.
- [ ] Manifest installable; icons include a maskable one.
- [ ] Updates are user-visible and tested across two deploys.
- [ ] Logout clears user caches and IndexedDB.
- [ ] Offline writes sync exactly once.
- [ ] Push permission requested in context; dead subscriptions removed.

## Related

- Knowledge: `web-performance`, `push-notifications`, `cdn-edge-cloudflare`, `vite-bundlers`, `state-management`, `secrets-management`.
- Workflows: `/perf-audit`, `/e2e`.
- Agents: `frontend-engineer`, `performance-optimizer`, `e2e-runner`.
