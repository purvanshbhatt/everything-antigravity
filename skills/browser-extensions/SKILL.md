---
name: browser-extensions
description: >-
  Builds Manifest V3 browser extensions for Chrome, Edge and Firefox: minimal
  permissions, service worker lifecycle, content scripts and isolated worlds,
  runtime messaging, storage, declarativeNetRequest, cross-browser builds with
  WXT or web-ext, automated tests with Playwright, and store review and
  privacy requirements. Use when creating or migrating an extension, debugging
  messaging or a sleeping service worker, or preparing a store submission.
---

# Browser Extensions

An extension is privileged code running next to every page the user visits.
Ask for the fewest permissions, treat page content as hostile, design the
background for a worker that can stop at any moment, and expect reviewers to
question every permission.

## When to use

- Creating an extension or migrating Manifest V2 to V3.
- Messages between content script, popup and background get lost.
- State disappears because the background service worker was terminated.
- Preparing a Chrome Web Store, Firefox Add-ons (AMO) or Edge Add-ons submission.

## When not to use

- Automating a browser for tests or scraping: use `browser-automation`.
- Editor extensions: use `ide-extensions`.
- Ordinary web app features: use `frontend-react-nextjs` or `pwa-offline`.

## Workflow

1. **Define a single purpose and minimal permissions.** Stores require one narrow purpose. Prefer `activeTab` plus `scripting` (granted on user click) over broad `host_permissions`; put optional hosts in `optional_host_permissions` and request them at runtime with `chrome.permissions.request`.

   **Check:** Every permission in the manifest has a one-sentence justification tied to a feature.

2. **Scaffold.** Plain MV3 for small extensions; WXT or Plasmo for TypeScript, hot reload and per-browser builds. Firefox tooling: `npx web-ext run`, `npx web-ext lint`, `npx web-ext build`.

3. **Write the manifest.**

   ```json
   {
     "manifest_version": 3,
     "name": "Acme Highlighter",
     "version": "1.0.0",
     "description": "Highlights glossary terms on pages you choose.",
     "action": { "default_title": "Highlight terms" },
     "background": { "service_worker": "background.js", "type": "module" },
     "permissions": ["activeTab", "scripting", "storage"],
     "optional_host_permissions": ["https://*/*"],
     "icons": { "16": "icons/16.png", "48": "icons/48.png", "128": "icons/128.png" }
   }
   ```

   Firefox needs `browser_specific_settings.gecko.id` and has historically used `background.scripts` rather than a service worker; check MDN for current MV3 support and let your build tool emit per-browser manifests.

   **Check:** The extension loads without manifest warnings in each target browser.

4. **Design for an ephemeral service worker.** Chrome stops idle workers, so globals vanish. Register listeners synchronously at top level, keep state in `chrome.storage.session` (memory, survives worker restarts) or `chrome.storage.local`, and use `chrome.alarms` instead of `setInterval`.

   ```js
   // background.js
   chrome.action.onClicked.addListener(async (tab) => {   // fires only when no popup is set
     if (!tab.id) return;
     await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
   });

   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
     if (sender.id !== chrome.runtime.id) return false;   // only our own contexts
     if (msg?.type === 'getTerms') {
       chrome.storage.sync.get('terms').then(({ terms }) => sendResponse(terms ?? []));
       return true;                                        // keep the channel open for async reply
     }
     return false;
   });
   ```

   **Check:** Stop the worker from the extensions page (inspect the service worker, then terminate it) and the feature still works on the next event.

5. **Keep content scripts defensive.** They run in an isolated world with DOM access only. Never insert page-derived strings with `innerHTML`; use `textContent` or DOM APIs. Validate messages from pages (`window.postMessage`) by origin and shape. Use `world: "MAIN"` only when you must touch page JavaScript, and assume the page can tamper with it.

   **Check:** No `innerHTML`, `eval` or `new Function` on data from pages (`grep_search` the content scripts).

6. **Pick the right network API.** Blocking or modifying requests uses `declarativeNetRequest` rules (static or dynamic); blocking `webRequest` is not available to normal MV3 extensions in Chrome. MV3 forbids remotely hosted code: all JavaScript ships in the package; fetch data, not code.

7. **Test.** Load unpacked via `chrome://extensions` (Developer mode, "Load unpacked") or `npx web-ext run` for Firefox. Automate with Playwright using a persistent context and `--load-extension` (see Playwright's extension testing docs for current headless support):

   ```ts
   const ctx = await chromium.launchPersistentContext('', {
     args: [`--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`],
   });
   ```

   **Check:** E2E tests open a page, trigger the action and assert the DOM change in CI.

8. **Submit to stores (confirm first).** Submitting publishes under the user's developer account: get explicit confirmation. Prepare a zip of the build output, store listing text and screenshots, a privacy policy URL if any user data is handled, completed data-use disclosures, and per-permission justifications. AMO may require source code when the package is minified or bundled. Review times vary; broad host permissions slow review.

   **Check:** The submission checklist lists every permission justification and the privacy disclosures match actual data flows.

## Messaging cheat sheet

| From → to | API |
| :--- | :--- |
| Content script or popup → background | `chrome.runtime.sendMessage(msg)` |
| Background → content script in a tab | `chrome.tabs.sendMessage(tabId, msg)` |
| Long-lived channel | `chrome.runtime.connect({ name })` with `onConnect` |
| Web page → extension | `externally_connectable` in the manifest, then `chrome.runtime.sendMessage(extId, msg)` |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `"host_permissions": ["<all_urls>"]` by default | `activeTab` or optional hosts requested at runtime | Slower review, scary install prompt, larger blast radius |
| Globals in the background worker | `chrome.storage.session` or `local` | The worker is terminated when idle |
| `setInterval` in the worker | `chrome.alarms` | Timers die with the worker |
| `innerHTML` with page text | `textContent` and DOM APIs | XSS inside a privileged context |
| Download and run code from a server | Ship all code in the package | Violates MV3 policy; rejection |
| Collect browsing data silently | Disclose, minimize, get consent | Store policy and privacy law |

## Verification checklist

- [ ] Single purpose stated; each permission justified and minimal.
- [ ] Background survives a forced worker stop; state lives in storage.
- [ ] Content scripts never execute or inject page-derived strings as HTML.
- [ ] Loads cleanly in each target browser; `web-ext lint` passes for Firefox.
- [ ] Automated tests cover the main action.
- [ ] Store submission happened only after user confirmation, with accurate privacy disclosures.

## Related

- Workflows: `/e2e`, `/release-management`, `/security-scan`.
- Knowledge: `browser-automation`, `typescript-patterns`, `ide-extensions`, `gdpr-privacy`, `supply-chain-security`.
- Agents: `security-guard`, `e2e-runner`, `frontend-engineer`.
