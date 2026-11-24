---
name: tauri-apps
disable-model-invocation: true
description: >-
  Builds Tauri 2 apps for desktop and mobile: Rust commands with typed errors,
  managed state, events and channels, capability-based permissions and scopes,
  official plugins, CSP, per-OS bundling and signing, signed auto-updates, and
  Android and iOS targets. Use when creating a Tauri app, exposing Rust
  functions to the web frontend, tightening permissions, or packaging and
  updating Tauri builds.
---

# Tauri Apps

Tauri pairs a web frontend with a Rust core and the operating system's own
webview, which yields small binaries and a deny-by-default permission model.
The work is in designing a narrow command API, granting only the capabilities
each window needs, and building and signing on every target OS.

## When to use

- Creating a desktop app (or desktop plus mobile) with a web UI and Rust logic.
- Exposing Rust functions, state or streaming events to the frontend.
- Configuring capabilities, plugin permissions, scopes and CSP.
- Bundling installers, signing, and shipping signed updates.

## When not to use

- You need one bundled Chromium for identical rendering everywhere: compare `electron-apps`.
- Rust language and crate design: use `rust-systems`. Rust tests in depth: use `rust-testing`.
- Store submission for the mobile builds: use `app-store-release`.

## Workflow

1. **Scaffold and run.**

   ```bash
   npm create tauri-app@latest        # choose a frontend template
   cd my-app && npm install
   npm run tauri dev
   ```

   Install OS prerequisites first (WebView2 on Windows, Xcode command line tools on macOS, WebKitGTK and build tools on Linux; see the Tauri prerequisites page).

   **Check:** The dev window opens and hot-reloads frontend edits.

2. **Write commands as a small API.** One `#[tauri::command]` per operation, typed arguments, `Result<T, AppError>` returns with a serializable error, and shared state through `app.manage(...)`. Async commands that borrow (for example `State<'_, T>`) must return `Result`. JavaScript argument keys are camelCase and map to snake_case Rust parameters.

   **Check:** Every command has a Rust unit test for its core logic and returns a typed error, not a panic.

3. **Grant capabilities per window.** Files in `src-tauri/capabilities/` bind permissions to windows. Plugin permissions are denied until granted; scope file-system and HTTP access to the narrowest paths and hosts. Remote URLs get no IPC access unless a capability explicitly allows them.

   **Check:** Calling a plugin API that is not granted fails with a permission error in the console.

4. **Set a strict CSP** in `tauri.conf.json` under `app.security.csp`, and avoid enabling `withGlobalTauri` unless needed. Treat frontend dependencies as untrusted and keep them updated.

   **Check:** The CSP contains no `unsafe-eval` and no wildcard sources.

5. **Add plugins deliberately.** `npm run tauri add <plugin>` (for example `dialog`, `fs`, `store`, `updater`), then review the permissions it needs in your capability file.

   **Check:** Each plugin in `Cargo.toml` has a matching, scoped permission entry and a reason in the plan.

6. **Bundle per OS in CI.** `npm run tauri build` produces MSI/NSIS on Windows, `.app`/DMG on macOS and deb/rpm/AppImage on Linux; cross-compiling is not the supported path, so use a CI matrix (for example `tauri-apps/tauri-action`). Configure WebView2 installation mode for Windows and signing/notarization credentials for macOS from CI secrets.

   **Check:** Installers from all three OS runners install and launch on clean machines.

7. **Ship signed updates.** Generate an updater key pair with `npm run tauri signer generate -- -w ~/.tauri/myapp.key`, put the public key in the updater plugin config, enable `createUpdaterArtifacts` in the bundle config, and provide the private key to CI as `TAURI_SIGNING_PRIVATE_KEY` (verify names against current docs). Back the private key up in a secret manager: losing it strands existing installs. Publishing an update is outward-facing and needs user confirmation.

   **Check:** The previous release finds, verifies and installs a staging update.

8. **Add mobile targets if needed.** `npm run tauri android init` and `npm run tauri android dev`; `npm run tauri ios init` and `npm run tauri ios dev` (macOS only). Mobile uses the same commands and capabilities with platform-specific permissions.

   **Check:** The app runs on an Android emulator and an iOS simulator with the same command API.

## Patterns

### Command with state and typed errors

```rust
#[derive(Debug, thiserror::Error)]
enum AppError {
    #[error("note not found: {0}")]
    NotFound(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

impl serde::Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

struct AppState { db: tokio::sync::Mutex<NoteDb> }

#[tauri::command]
async fn get_note(note_id: String, state: tauri::State<'_, AppState>) -> Result<Note, AppError> {
    let db = state.db.lock().await;
    db.find(&note_id).ok_or(AppError::NotFound(note_id))
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState { db: tokio::sync::Mutex::new(NoteDb::open()) })
        .invoke_handler(tauri::generate_handler![get_note])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```ts
import { invoke } from '@tauri-apps/api/core';
const note = await invoke<Note>('get_note', { noteId: id });
```

### Scoped capability

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:allow-open",
    { "identifier": "fs:allow-read-text-file", "allow": [{ "path": "$APPDATA/notes/**" }] }
  ]
}
```

### Frontend-to-Rust channels

| Need | Mechanism |
| :--- | :--- |
| Request and response | `invoke` a command |
| Rust notifies UI of an occasional change | `app.emit("name", payload)` and `listen` in JS |
| Streaming progress or large ordered data | `tauri::ipc::Channel<T>` passed as a command argument |
| Long-running work | Spawn on the async runtime; report through a channel; never block the main thread |

### Testing

- Rust: `cargo test` in `src-tauri`; the `test` feature of the `tauri` crate provides a mock runtime.
- Frontend: `mockIPC` from `@tauri-apps/api/mocks` fakes commands in unit tests.
- E2E: WebDriver through `tauri-driver` on Windows and Linux (macOS has no WKWebView driver).
- Run UI checks on all three webviews (WebView2, WKWebView, WebKitGTK): CSS and JS support differ.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `fs` or `http` scopes like `**` or `*` | Narrow paths and hosts per window | A frontend bug becomes full disk or network access |
| `unwrap()` inside commands | Return `Result` with a serializable error | A panic kills the command and hides the cause |
| One capability file granting everything to all windows | Per-window capabilities | Secondary windows inherit power they never use |
| Assume Chromium-only web APIs | Test on all three webviews | macOS and Linux use WebKit engines |
| Commit the updater private key | Secret manager plus CI secret | Anyone with it can push updates to your users |
| Block the main thread with sync work | Async commands and channels | The window freezes |

## Verification checklist

- [ ] Commands are narrow, typed and return serializable errors.
- [ ] Capabilities are per window with scoped file and network permissions.
- [ ] CSP is strict, with no wildcards or `unsafe-eval`.
- [ ] Installers build on each OS in CI and launch on clean machines.
- [ ] The updater key is backed up, updates verify, and publishing was confirmed by the user.
- [ ] UI was checked on WebView2, WKWebView and WebKitGTK.

## Related

- Workflows: `/security-scan`, `/verify`, `/build-fix`.
- Knowledge: `rust-systems`, `rust-testing`, `electron-apps`, `react-patterns`, `app-store-release`, `secrets-management`.
- Agents: `rust-reviewer`, `rust-build-resolver`, `security-guard`, `frontend-engineer`.
