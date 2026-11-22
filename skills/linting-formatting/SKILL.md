---
name: linting-formatting
description: >-
  Sets up and enforces linters and formatters across languages: Prettier,
  Biome and ESLint, Ruff, gofmt and golangci-lint, rustfmt and Clippy,
  dotnet format, clang-format, shellcheck and PSScriptAnalyzer, with
  pinned versions, pre-commit hooks, CI check mode, autofix, and adopting them
  in legacy repos without wrecking git blame. Use when adding or fixing lint
  and format tooling, when CI fails on style, or when a codebase has
  inconsistent style.
---

# Linting and Formatting

Formatting is not a discussion: one formatter per language, run automatically,
enforced in CI with the same pinned version everyone uses locally. Linters
catch bugs, not taste, so start from recommended rules and ratchet up instead
of turning everything on at once.

## When to use

- New repo, or a repo with no or conflicting lint and format configuration.
- CI fails on formatting or lint, or local and CI results differ.
- Adopting a formatter in a large legacy codebase.
- Adding pre-commit hooks or autofix to the edit loop.

## When not to use

- Security and bug-finding analysis (Semgrep, CodeQL, SonarQube): use `static-analysis`.
- Type checking strategy (`tsc --strict`, mypy, pyright): use the language skill, such as `typescript-patterns` or `python-patterns`.
- Reviewing a diff for logic bugs: use `/code-review`.

## Workflow

1. **Detect what exists.** `find_by_name` for `.editorconfig`, `.prettierrc*`, `biome.json`, `eslint.config.*`, `.eslintrc*`, `pyproject.toml` (`[tool.ruff]`, `[tool.black]`), `.golangci.yml`, `rustfmt.toml`, `.clang-format`, `.pre-commit-config.yaml` and `.husky/`. Read the CI workflow to see what runs today.

   **Check:** You can list, per language, the current formatter, linter, versions and where each runs.

2. **Choose one formatter and one linter per language** from the table below, and disable linter rules that overlap with the formatter (for ESLint, `eslint-config-prettier`).

   **Check:** No two tools rewrite the same file type.

3. **Pin versions in the project.** `devDependencies` for Node tools, a dev dependency group in `pyproject.toml`, `tool` directives in `go.mod` or a pinned install in CI for Go, `rust-toolchain.toml` for Rust. Add `.editorconfig` for line endings and indentation, which matters on Windows.

   **Check:** A fresh clone gets the same tool versions locally and in CI.

4. **Format the whole repo in one isolated commit** (legacy repos). Ask the user first, because it touches most files. Commit only the formatting, then add its SHA to `.git-blame-ignore-revs` and run `git config blame.ignoreRevsFile .git-blame-ignore-revs`. GitHub honours that file automatically.

   **Check:** The formatting commit contains no behaviour changes, and tests still pass.

5. **Ratchet lint rules.** Start with the recommended set. For legacy debt, lint only new code (`golangci-lint run --new-from-rev=origin/main`), add inline suppressions in bulk once (`ruff check --add-noqa`), or use the tool's baseline feature, then remove suppressions over time.

   **Check:** CI is green, and the suppression count is recorded so it can only go down.

6. **Add pre-commit hooks** (examples below) so problems are fixed before review.

   **Check:** Committing a badly formatted file triggers an automatic fix or a clear failure.

7. **Enforce in CI in check mode.** CI must never rewrite files; it fails with the command to run locally.

   **Check:** A deliberately misformatted file fails CI with an actionable message.

8. **Format after every agent edit.** After `write_to_file` or `replace_file_content`, run the project's formatter on the changed files before verification, so diffs stay minimal and reviewable.

   **Check:** The final diff has no formatting-only noise outside the intended change.

## Reference

### Tools by language

| Language | Format | Lint | CI check mode |
| :--- | :--- | :--- | :--- |
| JS / TS | Prettier or Biome | ESLint or Biome | `prettier --check .`, `eslint .`, `biome ci .` |
| Python | Ruff formatter (or Black) | Ruff | `ruff format --check .`, `ruff check .` |
| Go | gofmt / goimports | `go vet`, golangci-lint | `gofmt -l .` (must print nothing), `golangci-lint run` |
| Rust | rustfmt | Clippy | `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` |
| Java / Kotlin | Spotless (google-java-format, ktfmt) or ktlint | Checkstyle, Error Prone, detekt | `./gradlew spotlessCheck` |
| C# | `dotnet format` | Roslyn analyzers | `dotnet format --verify-no-changes` |
| C / C++ | clang-format | clang-tidy | `clang-format --dry-run --Werror <files>` |
| Shell | shfmt | shellcheck | `shfmt -d .`, `shellcheck scripts/*.sh` |
| PowerShell | `Invoke-Formatter` | PSScriptAnalyzer | `Invoke-ScriptAnalyzer -Path . -Recurse` |
| Terraform | `terraform fmt` | tflint | `terraform fmt -check -recursive` |
| SQL | sqlfluff | sqlfluff | `sqlfluff lint` |
| Dockerfile | n/a | hadolint | `hadolint Dockerfile` |
| YAML / Markdown | Prettier | yamllint, markdownlint-cli2 | `yamllint .` |

### ESLint flat config with Prettier

```js
// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['dist/', 'coverage/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier, // last: turns off rules that fight the formatter
];
```

### Ruff in pyproject.toml

```toml
[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP"]   # pyflakes, pycodestyle, isort, bugbear, pyupgrade
```

### Pre-commit hooks

Python and polyglot repos, `.pre-commit-config.yaml` (then `pre-commit install` and `pre-commit run --all-files`):

```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0            # pin; update with: pre-commit autoupdate
    hooks:
      - id: end-of-file-fixer
      - id: trailing-whitespace
      - id: check-merge-conflict
  - repo: local
    hooks:
      - id: ruff-check
        name: ruff check
        entry: ruff check --fix
        language: system
        types: [python]
      - id: ruff-format
        name: ruff format
        entry: ruff format
        language: system
        types: [python]
```

Node repos: `npx husky init`, put `npx lint-staged` in `.husky/pre-commit`, and configure `"lint-staged": { "*.{ts,tsx,js}": ["eslint --fix", "prettier --write"] }` in `package.json`. Check current versions in each tool's docs.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Mix formatting changes into feature PRs | Separate formatting commit plus `.git-blame-ignore-revs` | Reviewers cannot see the real change |
| Let CI auto-fix and push | CI checks; developers and hooks fix | Bots rewriting branches cause conflicts and surprises |
| Enable every lint rule on day one | Recommended set, then ratchet | Thousands of warnings get ignored wholesale |
| Unpinned tool versions | Pin in project config | Tool upgrades reformat code and break CI at random |
| Blanket `eslint-disable` or `# noqa` without codes | Suppress specific rules with a reason | Blanket suppressions hide real bugs |
| Style rules in the linter and the formatter | Formatter owns style; linter owns bugs | Tools fight and flip code back and forth |

## Verification checklist

- [ ] One formatter and one linter per language, with no overlapping rules.
- [ ] Versions pinned; local and CI results match.
- [ ] Repo-wide reformat (if any) was approved, isolated and added to `.git-blame-ignore-revs`.
- [ ] Pre-commit hooks installed and documented in the README or contributing guide.
- [ ] CI runs in check mode and fails with the command to fix.
- [ ] Suppression count is tracked and not growing.

## Related

- Agents: `code-reviewer`, `refactor-cleaner`, `build-error-resolver`.
- Workflows: `/verify`, `/pr-ready`, `/refactor-clean`.
- Knowledge: `static-analysis`, `ci-cd-github-actions`, `git-workflow`, `typescript-patterns`, `python-patterns`, `monorepo-tooling`.
