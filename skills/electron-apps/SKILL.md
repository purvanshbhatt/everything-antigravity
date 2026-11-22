---
name: electron-apps
description: >-
  Builds secure, fast Electron desktop apps: main, renderer, preload and
  utility process roles, context isolation and validated IPC through
  contextBridge, navigation and permission hardening, fuses, packaging with
  Electron Forge or electron-builder, code signing and notarization,
  auto-update, and startup and memory tuning. Use when creating or auditing an
  Electron app, adding IPC, or setting up builds, signing and updates.
---

# Electron Apps

An Electron app is a browser that can run code on the user's machine, so every
renderer is untrusted until proven otherwise. Keep Node out of renderers,
expose a narrow typed API through the preload script, validate every IPC
message in the main process, and sign and update the binary like any other
desktop software.

## When to use

- Starting an Electron app or auditing an existing one for security.
- Adding IPC between the UI and the file system, OS or native modules.
- Packaging, signing, notarizing and auto-updating for Windows, macOS and Linux.
- Slow startup, high memory use or a frozen UI.

## When not to use

- Smaller binaries with a Rust backend and the OS webview: compare with `tauri-apps`.
- The web UI itself (components, state, styling): use `react-patterns` or `frontend-react-nextjs`.
- Generic Node.js runtime topics: use `nodejs-patterns`.
- Mobile apps: use `react-native-expo` or `flutter-mobile`.

## Workflow

1. **Scaffold with a maintained toolchain.**

   ```bash
   npm init electron-app@latest my-app -- --template=vite-typescript
   cd my-app && npm start
   ```

   Check that the Electron major is still supported (only the latest few stable majors receive security fixes; verify on the Electron releases page).

   **Check:** The app starts, and `electron` in `package.json` is a supported major.

2. **Lock down every window** with the configuration in Patterns: `contextIsolation`, `sandbox`, no `nodeIntegration`, deny new windows except allowlisted external links, block navigation away from the app origin, and deny permission requests you do not need. Add a strict Content-Security-Policy and load local content through a custom protocol (`protocol.handle`) rather than broad `file://` access.

   **Check:** In the renderer DevTools console, `typeof require` and `typeof process` are both `"undefined"`.

3. **Design IPC as an API.** Use `ipcRenderer.invoke` with `ipcMain.handle`, one channel per operation, namespaced (`note:read`). The preload exposes functions, never `ipcRenderer` itself. The main process validates the sender frame and every argument.

   **Check:** `grep_search` finds no `exposeInMainWorld` that passes `ipcRenderer`, `require` or a generic `send(channel, ...)`.

4. **Run a security scan.** `npx @doyensec/electronegativity -i .` flags risky options, then review findings by hand. Delegate a deeper review to the `security-guard` subagent for apps that load remote content.

   **Check:** No high-severity findings remain unexplained.

5. **Flip fuses at package time** with `@electron/fuses` (Electron Forge has a fuses plugin): disable `RunAsNode`, `EnableNodeOptionsEnvironmentVariable` and `EnableNodeCliInspectArguments`; enable `EnableEmbeddedAsarIntegrityValidation`, `OnlyLoadAppFromAsar` and `EnableCookieEncryption`. Check fuse names against current docs.

   **Check:** The packaged app ignores `ELECTRON_RUN_AS_NODE=1`.

6. **Package and sign.** `npm run make` (Forge) or electron-builder. macOS needs a Developer ID certificate, hardened runtime and notarization; Windows needs Authenticode signing, typically through a cloud HSM or managed signing service; Linux ships deb, rpm, AppImage, Snap or Flatpak. Signing credentials come only from CI secrets.

   **Check:** macOS Gatekeeper opens the downloaded app without warnings, and Windows shows the verified publisher.

7. **Ship updates.** Options: the built-in `autoUpdater` with `update-electron-app` (free service for public GitHub releases), or electron-updater from electron-builder with GitHub, S3 or generic providers and staged rollouts. Updates must be signed and served over HTTPS. Publishing a release is outward-facing: get the user's confirmation first.

   **Check:** The previous release updates itself to a staging build on every OS.

8. **Tune startup and memory.** Show the window on `ready-to-show`, lazy-load heavy modules, avoid `ipcRenderer.sendSync`, move CPU-heavy work to a `utilityProcess` or worker, and limit hidden windows (each is a process). Watch `app.getAppMetrics()` in a long session.

   **Check:** Time to first paint and memory after one hour are recorded and within the budget in the plan.

## Patterns

### Hardened window and validated IPC

```ts
// main.ts
const win = new BrowserWindow({
  show: false,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  },
});
win.once('ready-to-show', () => win.show());
win.webContents.setWindowOpenHandler(({ url }) => {
  if (url.startsWith('https://docs.example.com/')) void shell.openExternal(url);
  return { action: 'deny' };
});
win.webContents.on('will-navigate', (e, url) => {
  if (!url.startsWith(APP_ORIGIN)) e.preventDefault();
});
session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));

ipcMain.handle('note:read', async (event, id: unknown) => {
  if (new URL(event.senderFrame?.url ?? 'about:blank').origin !== APP_ORIGIN) throw new Error('untrusted sender');
  if (typeof id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(id)) throw new Error('invalid id');
  return notes.read(id);
});

// preload.ts
contextBridge.exposeInMainWorld('api', {
  readNote: (id: string): Promise<Note> => ipcRenderer.invoke('note:read', id),
});
```

### Process roles

| Process | Runs | Trust |
| :--- | :--- | :--- |
| Main | App lifecycle, windows, OS APIs, IPC handlers | Trusted; validates all input |
| Preload | Bridge between renderer and IPC | Trusted code, exposed surface must be minimal |
| Renderer | Your web UI | Untrusted: treat like a public web page |
| Utility process | CPU-heavy or crash-prone work, native modules | Trusted, isolated from the UI |

### End-to-end test (Playwright, experimental Electron support)

```ts
import { _electron as electron, test, expect } from '@playwright/test';

test('main window shows notes', async () => {
  const app = await electron.launch({ args: ['.'] });
  const win = await app.firstWindow();
  await expect(win.getByRole('heading', { name: 'Notes' })).toBeVisible();
  await app.close();
});
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `nodeIntegration: true` or `contextIsolation: false` | Preload with `contextBridge` | Any XSS becomes remote code execution |
| Expose `ipcRenderer` or a generic `send` | One function per operation | The renderer can call any channel |
| Trust IPC arguments | Validate sender and types in main | A compromised renderer can send anything |
| Load remote sites in privileged windows | Separate sandboxed window or the system browser | Third-party content gets your IPC surface |
| `shell.openExternal(url)` on any URL | Allowlist schemes and hosts | `file:` and custom schemes can launch programs |
| `sendSync` and synchronous fs in main | `invoke` and async APIs | Blocks every window |
| Stay on an unsupported Electron major | Upgrade on a schedule | Chromium security fixes stop arriving |

## Verification checklist

- [ ] Renderers have no Node access; context isolation and sandbox are on.
- [ ] Every IPC handler validates the sender and its arguments.
- [ ] Navigation, new windows, permissions and `openExternal` are allowlisted.
- [ ] Fuses are set in the packaged build, and the CSP is strict.
- [ ] Builds are signed (and notarized on macOS) from CI secrets.
- [ ] Auto-update was tested from the previous release, and publishing was confirmed by the user.

## Related

- Workflows: `/security-scan`, `/e2e`, `/verify`.
- Knowledge: `tauri-apps`, `nodejs-patterns`, `typescript-patterns`, `react-patterns`, `supply-chain-security`, `web-performance`.
- Agents: `security-guard`, `typescript-reviewer`, `frontend-engineer`, `e2e-runner`.
