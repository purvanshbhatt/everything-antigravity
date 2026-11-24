---
name: verify
disable-model-invocation: true
description: >-
  Runs the project's verification gates and prints a VERIFICATION REPORT with
  PASS, FAIL or SKIP per gate. Its quick mode is a pre-commit gate (format, lint,
  types, affected tests, secret scan); full mode adds build, full tests with
  coverage, security scans, a diff self-review and a debug-leftover hunt. Use
  before committing, before a PR, or after editing code. Invoke with /verify.
---

# Verify

Prove the change is shippable with the project's own tools, and report every gate honestly. A gate you did not run is SKIP with a reason, never PASS.

Usage: `/verify` or `/verify quick` (default), and `/verify full`.

## When to use

- Before every commit (`quick`), and before a PR or handoff (`full`).
- After editing code. EAG's Stop hook asks for verification once per turn when code was edited without being tested (controlled by `verifyGate` in `~/.gemini/eag/config.json`). The PostToolUse hook records the verification commands you run, so running `/verify` satisfies it.
- Gate 4 of `/feature-dev`, and after each `/build-fix` or `/refactor-clean` batch.

## When not to use

- Investigating why something fails: `/root-cause`. Verify reports; it does not debug.
- Fixing a red build: `/build-fix`.
- A deep security assessment: `/security-scan`.
- Judging the design or correctness of the diff: `/code-review`.

## Workflow

1. **Pick the mode.** Use `quick` unless the user asked for `full`, you are preparing a PR, dependencies changed, or the change touches build configuration.

   **Check:** The mode is stated at the top of the report.

2. **Detect the project's commands.** Commands the project declares win over ecosystem defaults: package scripts, Makefile targets, `pyproject.toml` tool sections, CI workflow steps. Detect the package manager from the lockfile. Read script bodies: a script named `format` or `lint:fix` may write files, and verify must only check.

   ```bash
   npm pkg get scripts          # package.json scripts
   make -n test                 # print what `make test` would run, without running it
   ls .github/workflows/
   ```

   ```powershell
   (Get-Content package.json -Raw | ConvertFrom-Json).scripts
   Get-ChildItem .github/workflows
   ```

   The full matrix is in [command detection](references/command-detection.md).

   **Check:** Every gate has a concrete command or a SKIP reason.

3. **Determine the change set.** Quick mode covers uncommitted and untracked files; full mode covers the branch against its base. Exclude deleted files. The three-dot form diffs from the merge base automatically.

   ```bash
   git diff --name-only --diff-filter=d HEAD
   git ls-files --others --exclude-standard
   git diff --name-only --diff-filter=d origin/main...HEAD
   ```

   These work unchanged in PowerShell. Replace `origin/main` with the repository's real default branch.

   **Check:** You can state how many files changed.

4. **Run the gates, cheapest first.** Full mode runs Q1-Q3 and Q5, then F1-F5 (F2 replaces Q4).

   | # | Gate | Mode | Typical command (prefer the project's own) |
   | :--- | :--- | :--- | :--- |
   | Q1 | format | quick | `npx prettier --check <files>`, `ruff format --check .`, `gofmt -l .`, `cargo fmt --check`, `dart format --output=none --set-exit-if-changed .` |
   | Q2 | lint | quick | `npx eslint <files>`, `ruff check .`, `go vet ./...`, `cargo clippy --all-targets -- -D warnings`, `flutter analyze` |
   | Q3 | types | quick | `npx tsc --noEmit`, `mypy .` or `pyright` |
   | Q4 | affected tests | quick | `npx vitest related <files> --run`, `npx jest --findRelatedTests <files>`, `pytest <mapped test files>`, `go test <changed packages>`, `cargo test -p <crate>` |
   | Q5 | secrets | quick | `eag shield --file <path>` for each changed file |
   | F1 | build | full | `npm run build`, `go build ./...`, `cargo build`, `./gradlew build`, `flutter build <target>` |
   | F2 | tests and coverage | full | Full suite with coverage (see `/test-coverage`); compare with the configured threshold, never an invented one |
   | F3 | security | full | Whichever is installed: `npm audit --audit-level=high`, `pip-audit`, `govulncheck ./...`, `cargo audit`; plus Q5 over every file in the branch diff |
   | F4 | diff self-review | full | Read `git diff origin/main...HEAD` for unintended files, commented-out code, TODOs without issue links, lockfile churn and large binaries |
   | F5 | debug leftovers | full | Scan added lines (below) |

   Secret scan over the change set (if `eag` is not on `PATH`, use `node <plugin-root>/bin/eag.js shield --file <path>`):

   ```bash
   git diff --name-only --diff-filter=d HEAD | xargs -n1 eag shield --file
   ```

   ```powershell
   git diff --name-only --diff-filter=d HEAD | ForEach-Object { eag shield --file $_; if ($LASTEXITCODE -ne 0) { "FINDING: $_" } }
   ```

   Debug leftovers in added lines:

   ```bash
   git diff -U0 origin/main...HEAD | grep -nE '^\+.*(console\.log|debugger|breakpoint\(\)|pdb\.set_trace|dbg!|\.only\(|\bfdescribe\(|\bfit\()'
   ```

   ```powershell
   git diff -U0 origin/main...HEAD | Select-String -Pattern '^\+.*(console\.log|debugger|breakpoint\(\)|pdb\.set_trace|dbg!|\.only\(|\bfdescribe\(|\bfit\()'
   ```

   Review new `print(` and `fmt.Println` lines by hand; in CLIs they are often legitimate.

   **Check:** Every gate has a status, the exact command and a one-line detail.

5. **Handle failures without hiding them.** Verify does not weaken gates or edit code. Route build, type and lint failures to `/build-fix`, and test failures to `/root-cause` unless the cause is obvious in one read. For a secret finding, remove it from the code, tell the user, and recommend rotating it: assume anything committed or pushed has leaked. After fixes, rerun the failed gates, then the whole mode once.

   **Check:** The final report comes from one complete run of the mode, not stitched together from partial runs.

6. **Emit the report.**

   ```text
   VERIFICATION REPORT  mode=quick  base=HEAD  changed=6 files
   | Gate    | Status | Command                           | Detail                   |
   | format  | PASS   | npx prettier --check <6 files>    |                          |
   | lint    | FAIL   | npx eslint <6 files>              | 2 errors: no-unused-vars |
   | types   | PASS   | npx tsc --noEmit                  |                          |
   | tests   | PASS   | npx vitest related <files> --run  | 41 passed, 0 failed      |
   | secrets | PASS   | eag shield --file (6 files)       | 0 findings               |
   OVERALL: FAIL (1 gate)   NEXT: /build-fix for lint, then /verify quick
   ```

   OVERALL is PASS only if no gate failed. Every SKIP carries a reason ("no type checker configured"). Report counts, not adjectives.

   **Check:** OVERALL matches the worst gate, and NEXT names the follow-up for every FAIL.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Report PASS for a gate you didn't run | SKIP with a reason | A false PASS is worse than no report |
| Run `--fix` or `--write` during verify | Check mode only; fix in `/build-fix` | Verify must not change the code it verifies |
| Run only the tests you wrote | Affected tests (quick) or the full suite (full) | Regressions live in tests you didn't touch |
| Invent a coverage threshold | Use the configured one, or report the number without a verdict | Made-up thresholds create fake failures |
| Disable the Stop hook to silence the nudge | Run `/verify` | The nudge exists because unverified edits ship bugs |
| Paste hundreds of lines of tool output | One-line detail per gate; full logs on request | The report exists to support a decision |

## Verification checklist

- [ ] The mode was chosen and stated.
- [ ] Commands came from the project's own scripts or config wherever declared.
- [ ] Every gate has PASS, FAIL or SKIP, the command and a detail; every SKIP has a reason.
- [ ] The secret scan ran on every changed file.
- [ ] Full mode: build, full tests with coverage, dependency audit, diff self-review and debug-leftover scan all ran.
- [ ] OVERALL matches the worst gate.

## Related

- Workflows: `/build-fix`, `/root-cause`, `/test-coverage`, `/code-review`, `/security-scan`, `/pr-ready`, `/feature-dev`.
- Agents: `build-error-resolver`, `security-guard`, `code-reviewer`.
- Knowledge: `agent-shield`, `credential-sanitizer`, `ci-cd-github-actions`, `tdd-testing`.
