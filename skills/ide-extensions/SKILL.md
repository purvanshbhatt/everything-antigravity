---
name: ide-extensions
description: >-
  Builds extensions for VS Code-compatible editors, including the Antigravity
  IDE: scaffolding, package.json contributions, lazy activation events,
  commands, settings, SecretStorage, webviews with CSP, language servers,
  integration tests with @vscode/test-cli, VSIX packaging, and publishing to
  the VS Code Marketplace and Open VSX. Use when creating or debugging an
  editor extension or shipping one to users of several editors.
---

# IDE Extensions

Extensions run inside the user's editor process, so they must start lazily,
fail quietly, guard secrets and work across editors built on the VS Code
extension API. Target the documented API, test in a real extension host, and
publish to every registry your users' editors read from.

## When to use

- Creating an extension: commands, views, language features, webviews.
- An extension slows editor start-up, leaks disposables or breaks in another editor.
- Packaging a `.vsix` or publishing to the VS Code Marketplace or Open VSX.
- Shipping a team tool into the Antigravity IDE or other VS Code-based editors.

## When not to use

- Customizing Antigravity agents, rules or skills: use `antigravity-customization`.
- Giving the agent new tools: build an MCP server (`mcp-server-development`).
- Browser extensions: use `browser-extensions`.
- General TypeScript design questions: use `typescript-patterns`.

## Workflow

1. **Scaffold.** Use the official generator and choose TypeScript with a bundler (esbuild):

   ```bash
   npx --package yo --package generator-code -- yo code
   ```

   **Check:** The project builds, and a debug launch (F5) opens an Extension Development Host where the sample command runs. Confirm your editor build supports extension debugging; VS Code always does.

2. **Write the manifest deliberately.**

   ```json
   {
     "name": "acme-todos",
     "displayName": "Acme TODOs",
     "publisher": "acme",
     "version": "0.1.0",
     "engines": { "vscode": "^1.90.0" },
     "main": "./dist/extension.js",
     "activationEvents": ["onLanguage:markdown"],
     "contributes": {
       "commands": [{ "command": "acme.countTodos", "title": "Acme: Count TODOs" }],
       "configuration": {
         "title": "Acme",
         "properties": { "acme.pattern": { "type": "string", "default": "TODO", "description": "Text to count" } }
       }
     }
   }
   ```

   Set `engines.vscode` to the lowest API version you test. Forks track VS Code releases with a lag: read the editor's About dialog for its VS Code base version before raising the floor.

   **Check:** The extension installs in the oldest editor version you claim to support.

3. **Activate lazily.** Contributed commands activate the extension automatically (VS Code 1.74+), so `onCommand` entries are unnecessary. Use `onLanguage:<id>`, `workspaceContains:<glob>` or `onStartupFinished`; never `*`. Keep `activate` fast: no synchronous file I/O, no network.

   ```ts
   import * as vscode from 'vscode';

   export function activate(context: vscode.ExtensionContext): void {
     context.subscriptions.push(
       vscode.commands.registerCommand('acme.countTodos', () => {
         const editor = vscode.window.activeTextEditor;
         if (!editor) { void vscode.window.showWarningMessage('Open a file first.'); return; }
         const pattern = vscode.workspace.getConfiguration('acme').get<string>('pattern', 'TODO');
         const count = editor.document.getText().split(pattern).length - 1;
         void vscode.window.showInformationMessage(`${count} occurrences of ${pattern}`);
       }),
     );
   }

   export function deactivate(): void {}
   ```

   **Check:** The Developer: Show Running Extensions view reports a small activation time.

4. **Handle state, secrets and long work.** `context.globalState`/`workspaceState` for small state; `context.secrets` (SecretStorage) for tokens, never settings. Wrap slow work in `vscode.window.withProgress` and honour `CancellationToken`. Push every disposable into `context.subscriptions`. Respect `vscode.env.isTelemetryEnabled`.

   **Check:** Tokens never appear in `settings.json`, and reloading the window leaves no orphaned listeners.

5. **Secure webviews.** Set a strict Content-Security-Policy with a nonce for scripts, restrict `localResourceRoots`, load files through `webview.asWebviewUri`, and validate every message received from the webview.

   **Check:** The webview's CSP meta tag has no `unsafe-inline` for scripts, and messages are schema-checked.

6. **Prefer a language server for language features.** Implement completions, diagnostics and hovers with the Language Server Protocol (`vscode-languageclient` plus a server); the server is reusable in other editors.

7. **Test in a real extension host.** Use `@vscode/test-cli` with `@vscode/test-electron`:

   ```js
   // .vscode-test.mjs
   import { defineConfig } from '@vscode/test-cli';
   export default defineConfig({ files: 'out/test/**/*.test.js' });
   ```

   Run `npx vscode-test`; unit-test pure logic separately for speed.

   **Check:** Integration tests pass in CI (headless Linux runners need a virtual display such as `xvfb-run`).

8. **Package and install locally.**

   ```bash
   npx @vscode/vsce ls        # files that will ship; tune .vscodeignore
   npx @vscode/vsce package   # produces acme-todos-0.1.0.vsix
   ```

   Install in the Antigravity IDE or VS Code via the Extensions view menu ("Install from VSIX...") or the editor CLI's `--install-extension` flag.

   **Check:** The `.vsix` is small (bundled output, no `node_modules` or source maps unless intended) and installs cleanly.

9. **Publish (confirm first).** Publishing is public and versioned. After explicit user confirmation: `npx @vscode/vsce publish` for the VS Code Marketplace (publisher account and token), and `npx ovsx publish acme-todos-0.1.0.vsix -p <token>` for Open VSX (create the namespace once with `ovsx create-namespace`). Many VS Code-compatible editors install from Open VSX rather than the Microsoft Marketplace; verify which registry your target editors, including Antigravity, use. Read tokens from environment variables or CI secrets.

   **Check:** The listing appears on each registry and installs from the target editors' extension views.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `"activationEvents": ["*"]` | Specific events or contributed commands | Slows every editor start-up |
| Ship unbundled `node_modules` | Bundle with esbuild; check `vsce ls` | Large downloads, slow activation |
| Store tokens in settings | `context.secrets` | Settings sync and screenshots leak them |
| Webview without CSP | Nonce-based CSP and message validation | Script injection into a privileged context |
| Use proposed APIs in a published extension | Stable API only | Marketplaces reject or editors disable them |
| Depend on Microsoft-only extensions or services | Check availability in each target editor | Some are licensed only for Microsoft products |

## Verification checklist

- [ ] Activation is lazy and measured; no `*` activation.
- [ ] Commands, settings and disposables are registered through the manifest and `context.subscriptions`.
- [ ] Secrets use SecretStorage; webviews have a strict CSP.
- [ ] Integration tests run in CI; the `.vsix` contents were reviewed.
- [ ] Installed and smoke-tested in the Antigravity IDE and VS Code.
- [ ] Publishing to each registry happened only after user confirmation.

## Related

- Workflows: `/e2e`, `/release-management`.
- Knowledge: `typescript-patterns`, `antigravity-customization`, `mcp-server-development`, `browser-extensions`, `supply-chain-security`.
- Agents: `typescript-reviewer`, `security-guard`.
