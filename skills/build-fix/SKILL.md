---
name: build-fix
disable-model-invocation: true
description: >-
  Restores a red build, type-check or lint run with the smallest correct
  changes: captures the output, groups errors by root cause, fixes the earliest
  first and re-runs after each fix, without suppressing diagnostics. Covers tsc,
  eslint, mypy, pyright, ruff, go vet, cargo check/clippy, Gradle and flutter
  analyze. Use when a build, type-check, lint or CI compile step fails. Invoke
  with /build-fix.
---

# Build Fix

Make the build green by fixing causes, not by silencing symptoms. Compilers report cascades: one missing export can produce two hundred errors, so the order of fixes matters more than their number.

## When to use

- `build`, `tsc`, `mypy`, `pyright`, `cargo check`, `go vet`, `flutter analyze` or the linter fails locally or in CI.
- A dependency upgrade, merge or codegen change produced a wall of errors.
- `/verify` reported FAIL on build, types or lint.

## When not to use

- The code compiles but tests fail: `/root-cause` (or `/tdd` if the test is new).
- The fix needs a design change (wrong abstraction, missing module): `/blueprint` first.
- Formatting only: run the formatter in write mode (`npx prettier --write`, `ruff format`, `gofmt -w`, `cargo fmt`, `dart format`).
- Vulnerability or secret findings: `/security-scan`.

## Workflow

1. **Capture the exact failing command and its full output.** Use the command CI runs (read the workflow file) or the project script, not a near equivalent. Save the output outside the repo so you can re-read it without re-running a slow build.

   ```bash
   npx tsc --noEmit --pretty false > "${TMPDIR:-/tmp}/build.txt" 2>&1
   grep -c "error TS" "${TMPDIR:-/tmp}/build.txt"
   ```

   ```powershell
   npx tsc --noEmit --pretty false *> "$env:TEMP\build.txt"
   (Select-String "error TS" "$env:TEMP\build.txt").Count
   ```

   **Check:** You know the error count and have the first error verbatim.

2. **Separate new errors from old.** Compare with the last green state: `git diff --stat`, `git log --oneline -5`, the last green CI run. If errors predate the user's change, say so and fix only the new ones unless asked to do more.

   **Check:** Each error cluster is tagged new or pre-existing.

3. **Group by root cause.** Cluster by error code, symbol and file. Typical clusters: one changed type or export, one missing dependency or path alias, stale generated code, a runtime version mismatch. Environment errors (module not found, wrong version) come before code errors.

   **Check:** You have a short list of clusters, each with a suspected cause, ordered so that fixing one cannot be undone by the next.

4. **Fix the earliest root first.** Config and dependency errors first, then type definitions, then their usages; within a cluster, the first error in the output. Read the surrounding code with `view_file` before editing, and make the smallest change that restores the intended contract.

   **Check:** You can explain why the fix removes the whole cluster, not just one line.

5. **Re-run after every fix.** Use the fastest command that covers the cluster (`npx tsc --noEmit -p packages/api`, `cargo check`, `go vet ./billing/...`). The error count must fall. If it rises or a new cluster appears, undo that edit and rethink.

   **Check:** The count after each fix is recorded and decreasing.

6. **Then lint.** Apply autofixes only from the linter's own fix set (`npx eslint . --fix`, `ruff check --fix .`, `dart fix --dry-run` then `dart fix --apply`), review the resulting diff, and fix the rest by hand.

   **Check:** Lint is clean and every autofix change was reviewed.

7. **Confirm and report.** Re-run the original failing command, then `/verify quick` to make sure the fixes didn't break tests. Report the root causes, files changed, and any justified suppressions.

   **Check:** The original command exits 0 and the affected tests pass.

Escalate to the `build-error-resolver` subagent when there are more than ~50 errors across many modules, or three fix-and-rerun cycles brought no reduction; hand it the saved output and the list of changed files. Ask the user before upgrading or downgrading dependencies, regenerating lockfiles, or changing compiler or linter configuration.

## Commands

| Ecosystem | Build | Types | Lint |
| :--- | :--- | :--- | :--- |
| TypeScript | `npm run build` | `npx tsc --noEmit` (add `-p <tsconfig>` per package) | `npx eslint .` |
| Python | `python -m compileall -q src` | `mypy .` or `pyright` | `ruff check .` |
| Go | `go build ./...` | (the compiler) | `go vet ./...`, then `staticcheck ./...` or `golangci-lint run` if configured |
| Rust | `cargo build` | `cargo check --all-targets` | `cargo clippy --all-targets -- -D warnings` |
| JVM (Gradle) | `./gradlew build` | `./gradlew compileJava` or `./gradlew compileKotlin` | `./gradlew check` |
| Dart / Flutter | `flutter build <target>` | `dart analyze` or `flutter analyze` | same as types |

PowerShell: use `.\gradlew.bat` instead of `./gradlew`. Add `--stacktrace` to Gradle for configuration errors. With uv or Poetry, prefix Python tools with `uv run` or `poetry run`. Use `pnpm`, `yarn` or `bun` to match the lockfile.

## Root-cause hints

| Symptom | Likely cause | First move |
| :--- | :--- | :--- |
| Hundreds of errors after an upgrade | Breaking type change in a dependency | Read its changelog; inspect the lockfile diff with `git diff` |
| `Cannot find module` / `ModuleNotFoundError` | Not installed, wrong path alias, wrong virtualenv | Check the install, `tsconfig` `paths`, `python -c "import sys; print(sys.executable)"` |
| Green locally, red in CI | Different runtime version, missing env var, case-sensitive paths on Linux | Compare versions with the CI image |
| Errors only in generated files | Stale codegen | Re-run the generator (for example `npx prisma generate`, `dart run build_runner build`) |
| Cascading Rust borrow errors | One ownership mistake upstream | Fix the first error, re-run |
| Go `declared and not used` | Leftover from an edit | Remove the variable or import, or use it |

## Suppression policy

| Mechanism | Acceptable only when | Required form |
| :--- | :--- | :--- |
| `any`, `as unknown as T` | Never as a build fix | Use `unknown` and narrow |
| `@ts-ignore` | Never | `// @ts-expect-error -- <reason, issue link>` for a known upstream type bug |
| `# type: ignore` | Missing or wrong third-party stubs | `# type: ignore[<code>]  # <reason>` |
| `# pyright: ignore` | Same as above | `# pyright: ignore[<rule>]  # <reason>` |
| `eslint-disable` | The rule is wrong for this line, and you can say why | `// eslint-disable-next-line <rule> -- <reason>` |
| `#[allow(...)]`, `//nolint` | Lint false positive | Narrowest scope (item or line), with a comment |
| Lowering `strict` or disabling a rule globally | Only with user approval | A config change in its own commit |

List every suppression you added in the report.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Fix errors from the bottom of the output | Fix the first and root errors first | Cascades vanish when the cause is fixed |
| Make twenty edits, then re-run | Re-run after each fix | You can't tell which edit helped or hurt |
| Silence with `any`, `@ts-ignore` or a bare `type: ignore` | Fix the type, or use the narrow form above | Suppressions hide real bugs |
| Pin or downgrade a dependency silently | Ask, then pin with a comment and an issue | Hidden pins rot |
| Delete the code path that fails to compile | Restore the contract it needs | Deleting changes behaviour |
| Clear caches as the first move | Read the error first | Cache clears rarely fix code errors and cost minutes |

## Verification checklist

- [ ] The original failing command now exits 0.
- [ ] Each fix addressed a named root cause, and the error count fell after every fix.
- [ ] No new `any`, `@ts-ignore` or blanket ignore; justified suppressions are listed.
- [ ] No strictness lowered and no dependency changed without user approval.
- [ ] `/verify quick` passes on the changed files.

## Related

- Workflows: `/verify`, `/root-cause`, `/tdd`, `/blueprint`, `/code-review`.
- Agents: `build-error-resolver`, `typescript-reviewer`, `python-reviewer`, `go-reviewer`.
- Knowledge: `ci-cd-github-actions`, `frontend-react-nextjs`, `python-fastapi`, `golang-services`, `rust-systems`, `flutter-mobile`.
