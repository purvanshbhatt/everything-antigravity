---
name: refactor-clean
disable-model-invocation: true
description: >-
  Removes dead code, unused dependencies and duplication in tool-backed,
  test-guarded batches. Finds candidates with knip, ts-prune, depcheck,
  vulture, deadcode and cargo-udeps, sorts them into SAFE, CAREFUL and RISKY
  tiers, keeps tests green before and after every batch, and makes one commit
  per batch. Use when the user asks to clean up, delete unused code or
  dependencies, or deduplicate. Invoke with /refactor-clean.
---

# Refactor Clean

Delete what nothing uses and merge what is truly duplicated, without changing behaviour. Tools propose; search and tests decide. Every batch is small enough to review in one sitting and to revert in one command.

## When to use

- The user says "clean up", "remove dead code", "unused exports", "unused dependencies", "deduplicate" or "shrink the bundle".
- After a feature flag is retired, a migration completes, or an API version is removed.
- Before a large refactor, to shrink the surface first.

## When not to use

- Restructuring live code (extract, move, rename across modules): use the `safe-refactor` knowledge skill with characterization tests.
- Red build or failing tests: `/build-fix` or `/root-cause` first. Cleanup needs a green baseline.
- Removing a public API that external consumers rely on: plan a deprecation with `/blueprint`.
- Performance work: delegate to the `performance-optimizer` subagent.

## Workflow

1. **Establish a clean, green baseline.** Require a clean working tree on a dedicated branch, then run build and the full test suite and record the test counts.

   ```bash
   git status --short
   git switch -c chore/cleanup-<area>
   ```

   **Check:** Build and full tests pass before any deletion. If not, stop and report.

2. **Collect candidates with tools.** Run the detectors for the ecosystem (table below) and save their output outside the repo. Treat the output as leads, not verdicts.

   **Check:** Every candidate has a source tool and a location.

3. **Prove each candidate unused.** `grep_search` each name as a string as well as a symbol: dynamic imports, reflection, DI registrations, plugin and route registries, templates, config files, scripts, CI files and docs examples. Check framework conventions (Next.js `app/` and `pages/`, Django apps and migrations, pytest fixtures in `conftest.py`, Go `init()` and build tags, Rust `#[cfg(feature = ...)]`) and whether the package is published, in which case its exports are its API.

   **Check:** Every candidate has a recorded proof of non-use, or it is dropped from the list.

4. **Tier the candidates.**

   | Tier | Examples | Rule |
   | :--- | :--- | :--- |
   | SAFE | Unused imports and locals, unexported functions with zero references, commented-out code, devDependencies no config refers to | Batch after showing the list |
   | CAREFUL | Exported symbols with no internal callers, files with no importers, dependencies referenced only by scripts or config, duplicate blocks to merge | Search proof plus full tests; small batches |
   | RISKY | Public API of a published package, anything reached by string or reflection, feature-flagged paths, database columns and migrations, runtime dependencies, code other repos or services call | Per-item user confirmation and a deprecation path; never mixed into another tier's batch |

   **Check:** Every candidate has a tier, and RISKY items are listed separately.

5. **Confirm, then remove one batch.** Show the user the batch (files to delete, symbols to remove, dependencies to uninstall) and wait for an explicit yes before deleting anything. Remove with tracked, reviewable commands: `git rm <file>` for files, editor edits for symbols, and the package manager for dependencies (`npm uninstall <pkg>`, `uv remove <pkg>` or `poetry remove <pkg>`, `go mod tidy` after removing the imports, `cargo remove <crate>`).

   **Check:** The diff contains only the confirmed batch.

6. **Re-verify, then commit.** Run build, types, lint and the full test suite, not just affected tests: dead-code removal breaks dynamic paths that affected-test selection cannot see. If green, commit with the tool and tier in the message, for example `chore(cleanup): remove 12 unused exports (knip, SAFE)`. If red, put back only this batch and re-classify the item that broke:

   ```bash
   git restore --staged --worktree -- <paths in this batch>
   ```

   This discards uncommitted changes to the listed paths only; never widen it to `.`.

   **Check:** One commit per green batch, and the test count is unchanged except for tests deliberately removed with their dead code.

7. **Consolidate duplication last.** Find clones with `npx jscpd <src-dir>`. Merge only copies that change together for the same reason, and only after a characterization test pins each call site. Two similar blocks with different reasons to change are not duplication.

   **Check:** Each consolidation has tests covering every former call site.

8. **Report.** Per tier: items removed, lines removed (`git diff --shortstat <base>...HEAD`), dependencies removed, items skipped with the reason, and RISKY items awaiting the user's decision.

   **Check:** The report lists every RISKY item that was left untouched.

The `refactor-cleaner` subagent can run steps 2-3 for a large repo; give it the area, the tool list and the tier rules, and ask for a candidate table with proof of non-use. Batch confirmation stays with you and the user.

## Detection tools

| Ecosystem | Tool | Command | Finds | Watch for |
| :--- | :--- | :--- | :--- | :--- |
| JS/TS | knip | `npx knip` | Unused files, exports, dependencies | Entry points it can't see; configure `entry` and plugins rather than trusting raw output |
| TS | ts-prune | `npx ts-prune` | Unused exports | In maintenance mode; prefer knip when both work |
| JS/TS | depcheck | `npx depcheck` | Unused and missing dependencies | Dependencies used only by config files or CLIs |
| Python | vulture | `vulture src/ --min-confidence 80` | Unused functions, classes, variables | Framework hooks and dynamic attributes; keep a whitelist file |
| Python | ruff | `ruff check --select F401,F841 .` | Unused imports and variables | Re-exports in `__init__.py` |
| Go | deadcode | `deadcode ./...` (install: `go install golang.org/x/tools/cmd/deadcode@latest`) | Functions unreachable from `main` | Needs a `main` package; add `-test` to treat tests as roots |
| Go | staticcheck | `staticcheck ./...` | Unused code (check U1000) | Build tags |
| Rust | cargo-udeps | `cargo +nightly udeps --all-targets` | Unused dependencies | Requires a nightly toolchain |
| Rust | rustc | `cargo check` | `dead_code` warnings | `#[cfg]`-gated code |
| Any | jscpd | `npx jscpd src` | Duplicated blocks | Generated code and test fixtures |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Treat tool output as proof | Search for string and dynamic uses | Reflection, DI and config references are invisible to static tools |
| Mix tiers in one commit | One tier per batch | Reverting a RISKY item shouldn't undo SAFE work |
| Run only affected tests after deleting | Run the full suite | Dynamic paths escape affected-test selection |
| Remove "unused" exports of a published library | Deprecate first, remove in a major version | Consumers outside the repo break |
| Merge look-alike code with different reasons to change | Merge only same-reason copies | The wrong abstraction costs more than duplication |
| Undo a bad batch with `git checkout .` or `git reset --hard` | `git restore` only the batch's paths | Broad resets destroy unrelated work |

## Verification checklist

- [ ] A green baseline was recorded before the first deletion.
- [ ] Every removed item has a tool source, a proof of non-use and a tier.
- [ ] The user confirmed each batch, and each RISKY item individually.
- [ ] Build, types, lint and full tests were green after every batch, with one commit per batch.
- [ ] The report lists removed, skipped and pending RISKY items with line deltas.

## Related

- Workflows: `/verify`, `/build-fix`, `/code-review`, `/blueprint`, `/test-coverage`.
- Agents: `refactor-cleaner` (detection and SAFE batches), `code-reviewer`, `performance-optimizer`.
- Knowledge: `safe-refactor`, `git-workflow`, `tdd-testing`.
