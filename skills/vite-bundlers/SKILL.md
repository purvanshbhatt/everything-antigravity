---
name: vite-bundlers
description: >-
  Configures and troubleshoots Vite and related bundlers: vite.config
  structure, plugins, aliases, dev proxy, env variables and modes, code
  splitting and chunking, library mode with type declarations and package
  exports, bundle analysis, and migrating from webpack or Create React App,
  with notes on Rollup, esbuild, Rspack and Rolldown. Use when setting up or
  debugging a Vite build, shrinking bundles, publishing a library, or leaving
  webpack.
---

# Vite and Bundlers

Keep the build config small and explicit: one alias source, environment
variables that are safe to expose, splitting driven by measurement, and
libraries that ship correct `exports`. Bundler majors move quickly, so read
the installed version's migration notes before changing config.

## When to use

- Creating or editing `vite.config.*`, adding plugins, aliases or a dev proxy.
- Environment variables are missing, leaking or differ between modes.
- The bundle is large, or a route loads code it does not need.
- Publishing a component or utility library from a Vite project.
- Migrating from webpack, Create React App or another bundler.

## When not to use

- Framework-specific build config (Next.js, Nuxt, SvelteKit, Astro): start from that framework's skill.
- Runtime performance after load: use `web-performance` or `/perf-audit`.
- Monorepo task orchestration: use `monorepo-tooling`.

## Workflow

1. **Pin versions and Node.**

   ```bash
   npm ls vite @vitejs/plugin-react vitest
   node --version
   ```

   Recent Vite majors require recent Node LTS lines and change the default browser target; check the migration guide for your major. Rolldown-powered Vite changes some build internals and options; verify before copying older chunking config.

   **Check:** Node satisfies the Vite major's requirement and `npx vite build` runs.

2. **Keep the config explicit.**

   ```ts
   // vite.config.ts
   import { defineConfig, loadEnv } from 'vite';
   import react from '@vitejs/plugin-react';
   import { fileURLToPath, URL } from 'node:url';

   export default defineConfig(({ mode }) => {
     const env = loadEnv(mode, process.cwd(), ''); // config-time only; not exposed to the client
     return {
       plugins: [react()],
       resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
       server: { proxy: { '/api': { target: env.API_ORIGIN ?? 'http://localhost:8080', changeOrigin: true } } },
       build: { sourcemap: true },
     };
   });
   ```

   Keep `resolve.alias` and `tsconfig.json` `paths` in sync (or use a tsconfig-paths plugin).

   **Check:** Dev server starts, `/api` requests proxy correctly, and imports through `@/` resolve in both Vite and `tsc`.

3. **Handle env vars safely.** Files load in order `.env`, `.env.local`, `.env.[mode]`, `.env.[mode].local`. Only variables prefixed `VITE_` reach client code via `import.meta.env`, and everything exposed is public. Type them in `src/vite-env.d.ts` (`interface ImportMetaEnv`). Build other modes with `vite build --mode staging`.

   **Check:** `grep_search` the `dist/` output for any secret value returns nothing.

4. **Split code by route and feature.** Use dynamic `import()` (with `React.lazy`, `defineAsyncComponent` or router lazy routes) for routes and heavy widgets, and `import.meta.glob` for locale files or plugins. Add `build.rollupOptions.output.manualChunks` only when analysis shows a clear win.

   **Check:** The initial route's JS is smaller after the change (compare build output sizes).

5. **Analyze before optimizing.**

   ```bash
   npx vite-bundle-visualizer
   ```

   Look for duplicate packages (`npm ls <pkg>`), whole-library imports (`lodash`, icon packs, locale data) and server-only code pulled into the client.

   **Check:** Each large chunk has a known owner and a reason.

6. **Build libraries in library mode.**

   ```ts
   build: {
     lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' },
     rollupOptions: { external: ['react', 'react-dom', 'react/jsx-runtime'] },
   },
   ```

   Emit types (`vite-plugin-dts` or `tsc --emitDeclarationOnly`), declare `exports` with the `types` condition first, list peer dependencies, and set `sideEffects` (include CSS files). For pure TypeScript utilities, tsup or tsdown is simpler.

   ```bash
   npx publint
   npx @arethetypeswrong/cli --pack .
   ```

   **Check:** Both tools report no errors, and a consumer app imports the package with types.

7. **Migrate from webpack or CRA incrementally.** Commit first and keep the old build runnable until the new one is verified. Map concepts using the table below, run both builds, compare bundles and smoke-test every route. Ask the user before deleting the webpack config and its dependencies.

   **Check:** All routes work under `vite build && vite preview`, tests run under Vitest or the existing runner, and CI uses the new build.

8. **Debug common failures.** `npx vite --force` re-runs dependency pre-bundling; `npx vite --debug` logs resolution. Add late-discovered CommonJS deps to `optimizeDeps.include`. Always test production behaviour with `vite preview`, not only the dev server.

   **Check:** The failure reproduces (or not) under `vite preview` and the fix is confirmed there.

## Patterns

### webpack to Vite mapping

| webpack or CRA | Vite |
| :--- | :--- |
| `public/index.html` template | `index.html` at the project root with `<script type="module" src="/src/main.tsx">` |
| `process.env.REACT_APP_*` | `import.meta.env.VITE_*` |
| Loaders (`babel-loader`, `css-loader`, `file-loader`) | Built-in handling plus plugins |
| `require.context` | `import.meta.glob` |
| SVG as component | `vite-plugin-svgr` (`import Logo from './logo.svg?react'`) |
| `DefinePlugin` | `define` (prefer env vars) |
| `devServer.proxy` | `server.proxy` |
| Jest with Babel | Vitest (shares the Vite config) |

### Other bundlers

| Tool | Use when |
| :--- | :--- |
| Rspack | Large webpack apps that need speed with webpack-compatible config |
| Rollup | Libraries needing fine control over output |
| esbuild | Scripts, CLIs, simple bundling without HMR |
| tsup / tsdown | TypeScript libraries with minimal config |
| Turbopack | Next.js projects only |
| Rolldown | Rust-based Rollup-compatible bundler used by newer Vite; check status per version |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Put API keys in `VITE_*` | Keep secrets server-side | Inlined into public JS |
| `define: { 'process.env': process.env }` | Explicit, typed `import.meta.env` | Leaks every variable |
| Bundle React into a library | Externalize peers | Duplicate React breaks hooks |
| Guess at `manualChunks` | Analyze, then split | Bad splits add requests and duplicate code |
| Trust the dev server for prod bugs | `vite build && vite preview` | Dev skips bundling and minification |

## Verification checklist

- [ ] Vite and Node versions compatible; config is explicit and typed.
- [ ] No secrets in `VITE_*` or in `dist/`.
- [ ] Routes and heavy features are lazy; analysis justifies chunking.
- [ ] Libraries pass `publint` and `arethetypeswrong`, with peers externalized.
- [ ] Production build verified with `vite preview`.

## Related

- Knowledge: `monorepo-tooling`, `typescript-patterns`, `nodejs-patterns`, `web-performance`, `react-patterns`, `vue-nuxt`, `pwa-offline`, `ci-cd-github-actions`.
- Workflows: `/framework-migration`, `/dependency-upgrades`, `/build-fix`, `/perf-audit`.
- Agents: `build-error-resolver`, `migration-specialist`, `performance-optimizer`, `frontend-engineer`.
