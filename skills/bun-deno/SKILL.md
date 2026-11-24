---
name: bun-deno
disable-model-invocation: true
description: >-
  Chooses between Node.js, Bun and Deno and uses the latter two well: built-in
  tooling (install, test, bundle, compile, fmt, lint), Deno's permission flags
  and least-privilege runs, npm and JSR compatibility, lockfiles and frozen
  installs in CI, HTTP servers with Bun.serve and Deno.serve, single-binary
  builds and container deployment to Cloud Run. Use when starting a
  TypeScript or JavaScript project on Bun or Deno, or migrating from Node.
---

# Bun and Deno

Bun and Deno are TypeScript-first runtimes with batteries included. Bun aims
at speed and drop-in Node compatibility; Deno aims at secure defaults and
standard tooling. Pick based on compatibility needs and security posture, then
use each runtime's own tools instead of re-adding the Node toolchain.

## When to use

- Starting a new TypeScript service, CLI or script and choosing a runtime.
- Migrating a Node project to Bun or Deno, or evaluating whether it is worth it.
- Running untrusted or third-party scripts with Deno's permission sandbox.
- Producing a single executable from TypeScript.
- Setting up CI and containers for a Bun or Deno project.

## When not to use

- Node-specific runtime topics (streams, worker threads, ESM/CJS interop): use `nodejs-patterns`.
- Type-level TypeScript design: use `typescript-patterns`.
- Framework choice and frontend builds: use `vite-bundlers` or the relevant framework skill.
- Edge runtimes such as Cloudflare Workers: use `cdn-edge-cloudflare`.

## Workflow

1. **Detect the current runtime and lockfiles.**

   ```bash
   ls package.json bun.lock bun.lockb bunfig.toml deno.json deno.jsonc deno.lock 2>/dev/null
   bun --version; deno --version; node --version
   ```

   PowerShell: `Get-ChildItem package.json, bun.lock*, deno.json*, deno.lock -ErrorAction SilentlyContinue`. **Check:** You know which runtime the project uses today; do not mix lockfiles from two package managers.

2. **Choose with the matrix below.** Write the decision and its reasons in the implementation plan artifact. If key dependencies use native addons, Node-specific internals or are critical to the business, prototype them on the target runtime before committing.

   **Check:** A spike runs the project's riskiest dependency (database driver, auth SDK, native module) on the chosen runtime.

3. **Install runtimes from official sources.** Use a package manager (Homebrew, winget, Scoop) or the install instructions in the official docs, and pin the version for the team (`.tool-versions`/mise, `packageManager`, or a Docker tag). Avoid piping remote install scripts into a shell inside project automation.

   **Check:** `bun --version` or `deno --version` matches the pinned version in CI and locally.

4. **Use the built-in toolchain.**

   | Task | Bun | Deno |
   | :--- | :--- | :--- |
   | Install dependencies | `bun install` (`--frozen-lockfile` in CI) | `deno install` (`--frozen` in CI; verify flags for your version) |
   | Add a dependency | `bun add zod` | `deno add jsr:@std/assert npm:zod` |
   | Run a script | `bun run dev` / `bun src/index.ts` | `deno task dev` / `deno run main.ts` |
   | Test | `bun test` (Jest-style `expect`) | `deno test` |
   | Format and lint | Use Biome, Prettier or ESLint | `deno fmt --check`, `deno lint` |
   | Type check | `tsc --noEmit` (Bun strips types without checking) | `deno check main.ts` |
   | Bundle | `bun build ./src/index.ts --outdir dist` | Use a bundler (esbuild, Vite); check current Deno docs for built-in options |
   | Single executable | `bun build --compile ./cli.ts --outfile mycli` | `deno compile --allow-net -o mycli main.ts` |

   **Check:** CI runs install with a frozen lockfile, type check, lint and tests.

5. **Run Deno with least privilege.** Grant only the hosts, paths, variables and subprocesses needed. Use `--no-prompt` in CI so missing permissions fail instead of waiting for input. Bun has no permission sandbox; treat Bun processes like Node processes.

   ```bash
   deno run --no-prompt --allow-net=api.example.com,0.0.0.0:8080 --allow-env=PORT,DATABASE_URL --allow-read=./config main.ts
   ```

   **Check:** The app works with the narrow flags and fails clearly when a permission is missing; no `-A` in production commands.

6. **Verify Node compatibility before migrating.** Both runtimes support many `node:` built-ins and npm packages, but coverage differs and changes quickly; check each runtime's Node compatibility page for the APIs you use. Run the full test suite on the new runtime and compare behaviour, not just startup.

   **Check:** The existing test suite passes on the new runtime, or each failure is understood and fixed.

7. **Containerize and deploy.** Use the official images (`oven/bun`, `denoland/deno`) with a pinned tag, run as a non-root user, and listen on the `PORT` environment variable for Cloud Run. Deploying is outward-facing: confirm with the user first.

   **Check:** The container starts locally with `docker run -e PORT=8080 -p 8080:8080 <image>` and answers a health request.

## Patterns

### Choosing a runtime

| Need | Prefer |
| :--- | :--- |
| Maximum ecosystem compatibility, LTS support policy, enterprise tooling | Node.js |
| Fast installs and tests, drop-in for many Node apps, one binary for tooling | Bun |
| Running scripts or plugins with restricted permissions | Deno |
| TypeScript with built-in fmt, lint, test and type check, no config | Deno |
| Native addons, APM agents or tools that hook Node internals | Node.js (verify support elsewhere first) |
| Single-file CLI distribution from TypeScript | Bun or Deno `compile` |

### Minimal HTTP servers

```ts
// Bun
const port = Number(process.env.PORT ?? 8080);
Bun.serve({
  port,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/healthz") return new Response("ok");
    return Response.json({ hello: "world" });
  },
});
```

```ts
// Deno (run with --allow-net and --allow-env=PORT)
const port = Number(Deno.env.get("PORT") ?? 8080);
Deno.serve({ port, hostname: "0.0.0.0" }, (req) => {
  const url = new URL(req.url);
  if (url.pathname === "/healthz") return new Response("ok");
  return Response.json({ hello: "world" });
});
```

Both use the web-standard `Request`/`Response`, so handlers port easily
between them and to edge runtimes.

### Tests

```ts
// Bun: bun test
import { describe, expect, test } from "bun:test";
describe("slugify", () => {
  test("lowercases and joins words", () => expect(slugify("Hello World")).toBe("hello-world"));
});

// Deno: deno test
import { assertEquals } from "jsr:@std/assert";
Deno.test("slugify lowercases and joins words", () => {
  assertEquals(slugify("Hello World"), "hello-world");
});
```

### Deno configuration

Keep tasks, imports and compiler options in `deno.json`; map bare specifiers
in `"imports"` (for example `"zod": "npm:zod@^3"`) so source files use plain
imports. Prefer JSR packages for Deno-native libraries and `npm:` specifiers
for everything else.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `deno run -A` in production | Narrow `--allow-*` flags | Throws away Deno's main security benefit |
| Assume Bun type-checks | Run `tsc --noEmit` in CI | Bun transpiles without type checking |
| Commit lockfiles from several package managers | One runtime, one lockfile | Conflicting resolutions and confusing CI |
| Migrate a production service on benchmarks alone | Run the full test suite and a soak test | Compatibility gaps show up under real traffic |
| Mix Node-only APIs into code meant to run on Deno Deploy or the edge | Use web-standard APIs (`fetch`, `Request`, Web Crypto) | Portable across runtimes |
| Floating `latest` runtime images | Pinned version tags | Reproducible builds and rollbacks |

## Verification checklist

- [ ] Runtime choice and reasons are recorded; the riskiest dependency was spiked.
- [ ] Runtime version is pinned locally, in CI and in the container image.
- [ ] CI uses frozen installs, type checks, lints and runs tests.
- [ ] Deno commands use least-privilege flags with `--no-prompt`; no `-A` in production.
- [ ] Node compatibility of used APIs was checked against current docs and the test suite passes.
- [ ] The container listens on `PORT`, runs as non-root, and deployment was confirmed by the user.

## Related

- Workflows: `/dockerize`, `/framework-migration`, `/verify`, `/build-fix`.
- Knowledge: `nodejs-patterns`, `typescript-patterns`, `vite-bundlers`, `cloud-run`, `serverless-functions`, `cdn-edge-cloudflare`, `cli-development`.
- Agents: `backend-engineer`, `typescript-reviewer`, `build-error-resolver`.
