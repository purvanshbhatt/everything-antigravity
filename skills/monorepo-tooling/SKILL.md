---
name: monorepo-tooling
description: >-
  Sets up and runs JavaScript and TypeScript monorepos: pnpm, npm or Yarn
  workspaces, internal packages and the workspace protocol, Turborepo or Nx
  task graphs with local and remote caching, affected-only CI, module boundary
  rules, shared configs, dependency version policy, and versioning and
  publishing with Changesets. Use when creating a monorepo, adding a package,
  speeding up monorepo CI, or fixing dependency and cache problems.
---

# Monorepo Tooling

A monorepo works when three things are explicit: which packages exist and how
they depend on each other, how tasks are ordered and cached, and how versions
are released. Start with plain workspaces and add a task runner when builds or
CI get slow.

## When to use

- Combining apps and shared packages (UI, config, utils) in one repository.
- CI rebuilds and retests everything on every change.
- Cache hits return wrong builds, or internal packages resolve inconsistently.
- Publishing several npm packages with changelogs.

## When not to use

- Bundler configuration inside a package: use `vite-bundlers`.
- CI pipeline syntax and runners: use `ci-cd-github-actions`.
- Polyglot builds at very large scale (hermetic, multi-language): evaluate Bazel or Pants separately.

## Workflow

1. **Choose the level of tooling** with the table below, and agree on one package manager. Pin it in the root `package.json` `packageManager` field; check how your Node version provides package managers (Corepack availability has changed across Node releases).

   **Check:** The decision and package manager are recorded in the implementation plan.

2. **Lay out workspaces.**

   ```text
   apps/web  apps/api
   packages/ui  packages/utils  packages/config-typescript  packages/config-eslint
   ```

   ```yaml
   # pnpm-workspace.yaml
   packages:
     - "apps/*"
     - "packages/*"
   ```

   Reference internal packages with `"@acme/ui": "workspace:*"`. Mark apps `"private": true`.

   **Check:** `pnpm install` links internal packages (`pnpm ls --depth 0 --filter @acme/web` shows `link:`).

3. **Decide how internal packages build.** Just-in-time packages export TypeScript source and let the consuming app's bundler compile them (fastest, not publishable). Compiled packages build to `dist/` with an `exports` map (required for publishing or non-bundler consumers). Use `moduleResolution: "bundler"` or `"nodenext"` consistently, and share `tsconfig` bases from a config package.

   **Check:** A clean clone builds each app with no path hacks or relative imports into other packages' `src/`.

4. **Define the task graph.** Turborepo:

   ```json
   {
     "$schema": "https://turborepo.com/schema.json",
     "tasks": {
       "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**", "!.next/cache/**"] },
       "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
       "lint": {},
       "dev": { "cache": false, "persistent": true }
     }
   }
   ```

   Declare every environment variable that changes a build's output in the task's `env`, or the cache serves builds made with other values. Nx expresses the same with `targetDefaults` (`dependsOn: ["^build"]`, `cache: true`) and `namedInputs` in `nx.json`.

   **Check:** Running the build twice gives a full cache hit on the second run.

5. **Run only what changed.**

   ```bash
   pnpm --filter @acme/web dev
   pnpm --filter "@acme/web..." build            # web and everything it depends on
   pnpm --filter "...[origin/main]" test         # changed packages and their dependents
   npx turbo run build --filter=@acme/web...
   npx turbo run test --affected                 # check your turbo version supports it
   npx nx affected -t lint test build
   npx nx graph                                  # visualize dependencies
   ```

   **Check:** A change to one leaf package runs tests only for it and its dependents.

6. **Configure CI caching.** Fetch enough git history for affected detection (`fetch-depth: 0` or a merge-base fetch). Use a remote cache (Turborepo with `TURBO_TOKEN` and `TURBO_TEAM` secrets, Nx Cloud, or a self-hosted cache) and never cache tasks with side effects such as deploy or publish.

   **Check:** A no-op pull request completes mostly from cache; logs show cache hits.

7. **Enforce dependency hygiene and boundaries.** Single version policy for framework and tooling deps (pnpm catalogs, `syncpack`, or `manypkg check`); no phantom dependencies (every import is declared in that package's `package.json`); architectural boundaries with Nx `@nx/enforce-module-boundaries` tags or ESLint import rules; `CODEOWNERS` per package.

   **Check:** The version-mismatch check and boundary lint pass in CI.

8. **Version and publish with Changesets.**

   ```bash
   npx changeset            # describe a change and its semver bump
   npx changeset version    # apply bumps and write changelogs
   npx changeset publish    # publish to the registry
   ```

   Choose fixed or independent versioning in `.changeset/config.json` (`fixed`, `linked`, `ignore`). Automate with the Changesets GitHub Action. Publishing is outward-facing: confirm with the user and check registry auth before `changeset publish`.

   **Check:** `npx changeset status` shows the expected bumps before release.

## Patterns

### Tool choice

| Situation | Choose |
| :--- | :--- |
| A few packages, fast builds | Workspaces only (pnpm recommended) |
| Slow builds or CI, want caching with little config | Turborepo |
| Many teams, need generators, boundaries, plugins, graph tooling | Nx |
| Polyglot, hermetic builds at large scale | Bazel or Pants |

### Root scripts

```json
{
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "dev": "turbo run dev --filter=@acme/web..."
  }
}
```

Run scripts from the root; package-level scripts stay simple (`"build": "vite build"`).

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Import `../../packages/ui/src/button` | Import `@acme/ui` via the workspace | Bypasses the dependency graph and caching |
| Omit `outputs` or `env` in task config | Declare them | Wrong or missing cache restores |
| Different React or TypeScript versions per package | Single version policy | Duplicate runtimes and type conflicts |
| Cache deploy or publish tasks | Mark them uncached | Skipped side effects |
| Shallow clones with affected commands | Fetch the merge base | Everything (or nothing) appears changed |
| Publish manually from laptops | Changesets in CI after approval | Unreproducible releases |

## Verification checklist

- [ ] One package manager pinned; workspaces link internal packages.
- [ ] Internal packages have a clear build mode and correct `exports`.
- [ ] Task graph declares `dependsOn`, `outputs` and `env`; second build is a full cache hit.
- [ ] CI runs affected tasks only, with a remote cache.
- [ ] Version policy and boundary rules enforced in CI.
- [ ] Releases go through Changesets with user confirmation before publishing.

## Related

- Knowledge: `vite-bundlers`, `typescript-patterns`, `nodejs-patterns`, `ci-cd-github-actions`, `linting-formatting`, `task-runners`, `design-systems`.
- Workflows: `/release-management`, `/dependency-upgrades`, `/build-fix`.
- Agents: `build-error-resolver`, `cloud-devops-engineer`, `frontend-engineer`.
