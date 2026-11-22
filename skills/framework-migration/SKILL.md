---
name: framework-migration
description: >-
  Migrates a framework, runtime or major library version in stages: baseline,
  blast-radius inventory, the official migration guide, a staged plan with
  green checkpoints, official codemods first, compatibility shims,
  deprecation burn-down and verification against the baseline. Use for major
  upgrades (React, Next.js, Angular, Vue, Django, Rails, Spring Boot, Python,
  Node) or moving between frameworks. Invoke with /framework-migration.
---

# Framework Migration

Move to the new framework or major version in small steps that each leave
the main branch green. Use the maintainers' guides and codemods first,
commit mechanical changes separately from manual ones, and prove the result
against a recorded baseline.

Usage: `/framework-migration <from> -> <to>` (for example `Next.js 14 -> 15`, `Vue 2 -> Vue 3`, `Express -> Fastify`).

## When to use

- A framework or runtime major version is reaching end of life or blocks other upgrades.
- Moving between frameworks (Vue 2 to Vue 3, Create React App to Vite, Express to Fastify, AngularJS to Angular).
- Large API removals in a core library (ORM, router, test runner).

## When not to use

- Routine dependency bumps across many packages: `/dependency-upgrades`.
- Rewriting a legacy system's architecture: `legacy-modernization`.
- Behaviour-preserving code restructuring without a version change: `safe-refactor`.

## Workflow

1. **Define the move and read the guide.** Record from and to versions, the reason, constraints (deadline, freeze windows) and the type: in-place upgrade or framework swap. Read the official migration guide and release notes for every major in between. Migrate one major at a time unless the guide says otherwise. Treat any version-specific fact as "verify against current docs".

   **Check:** The artifact lists each breaking change from the guide that applies to this codebase.

2. **Record a baseline.** On a clean main: build passes, test counts and coverage, deprecation-warning count, bundle size or startup time, key performance numbers, and an E2E smoke run.

   **Check:** Baseline numbers and commands are saved in the artifact.

3. **Inventory the blast radius.** Use `grep_search` for each removed or changed API and count call sites. Check ecosystem compatibility: plugins, peer dependencies and adapters.

   ```bash
   npm ls <package>                # who depends on it (or pnpm why / yarn why)
   npm outdated
   pip list --outdated
   ./gradlew dependencies          # or: mvn dependency:tree
   bundle outdated
   ```

   **Check:** Each breaking change has a usage count and every blocking plugin has a compatible version or a plan.

4. **Write the staged plan and get approval.** Typical stages, each its own commit or PR with main green:
   - Stage 0: upgrade to the latest minor of the current major; fix deprecation warnings.
   - Stage 1: toolchain (runtime version, build tool, TypeScript, linters).
   - Stage 2: the core upgrade plus official codemods.
   - Stage 3: manual fixes grouped by breaking change.
   - Stage 4: remove compatibility shims and flags.

   For a framework swap, use a strangler approach instead: run both side by side and move route by route or module by module. Present the plan as an implementation-plan artifact; optionally delegate a review to the `migration-specialist` subagent. Wait for user approval.

   **Check:** The user approved the stages, and each stage has a "done when" gate.

5. **Run official tools first.** Run codemods on a clean working tree, review the diff, and commit the codemod output alone so manual edits stay reviewable.

   | Ecosystem | Tooling (verify current commands in the guide) |
   | :--- | :--- |
   | Angular | `ng update @angular/core @angular/cli` |
   | Next.js | `npx @next/codemod@latest <transform> <path>` |
   | React | Codemods referenced from the official upgrade guide |
   | Vue 2 to 3 | Migration build (`@vue/compat`) to surface warnings, then remove |
   | Django | `python -Wa manage.py test` for deprecations; `django-upgrade --target-version <X.Y>` |
   | Python versions | `ruff check --select UP --fix` or `pyupgrade --py311-plus` |
   | Rails | `bin/rails app:update`, then the `new_framework_defaults` file one flag at a time |
   | Spring Boot / Java | OpenRewrite recipes via the Maven or Gradle plugin; `spring-boot-properties-migrator` for renamed properties |
   | Custom patterns | `npx jscodeshift -t transform.js src/ --dry --print` before a real run |

   **Check:** `git diff --stat` for the codemod commit was reviewed and contains only mechanical changes.

6. **Fix the rest by cause.** Group remaining errors by breaking change and fix one group at a time. Delegate compile and type errors to the `build-error-resolver` subagent and failing behaviour to `/root-cause`. Add temporary shims only with a removal note and an issue link.

   **Check:** Build and type-check are green, and deprecation warnings are at or below baseline.

7. **Verify against the baseline.** Run `/verify full`, the E2E smoke suite (`/e2e`), and compare bundle size, startup and key latencies with the baseline (`/perf-audit` if they regressed). For UI frameworks, click through critical journeys in the browser.

   **Check:** A before/after table shows tests, warnings and performance at or better than baseline, or explains each regression.

8. **Roll out and clean up.** Deploy to staging, then canary or flagged rollout where possible. Write the rollback plan (revert commits, restore lockfile, data compatibility). Production deploys need explicit user confirmation. Remove shims in a final stage.

   **Check:** Rollback was written before the production deploy, and shims have removal issues.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Jump several majors at once | One major per stage, green in between | Errors from different majors compound and hide each other |
| Mix codemod output with manual edits | Separate commits | Reviewers can't tell mechanical from intentional change |
| Upgrade on a red baseline | Fix or record the baseline first | You can't attribute new failures |
| Silence deprecation warnings | Burn them down before the next major | Today's warnings are the next major's errors |
| Long-lived migration branch | Small stages merged to main | Drift and merge conflicts grow daily |

## Verification checklist

- [ ] Official guide read for every intermediate major; applicable breaking changes listed.
- [ ] Baseline recorded before any change.
- [ ] Plan approved; each stage merged green.
- [ ] Codemod commits isolated and reviewed.
- [ ] `/verify full`, E2E and performance compared to baseline.
- [ ] Rollback plan written; production deploy confirmed by the user; shims tracked.

## Related

- Workflows: `/dependency-upgrades`, `/verify`, `/build-fix`, `/root-cause`, `/e2e`, `/perf-audit`, `/blueprint`.
- Knowledge: `legacy-modernization`, `safe-refactor`, `vite-bundlers`, `database-migrations`.
- Agents: `migration-specialist`, `build-error-resolver`, `test-engineer`.
