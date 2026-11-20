# Command Detection Matrix

How `/verify` decides which command runs each gate. Work top to bottom and stop at the first match per gate: what the project declares beats what the ecosystem usually does.

## 1. Precedence

1. **CI workflow steps** (`.github/workflows/*.yml`, `.gitlab-ci.yml`, `cloudbuild.yaml`). This is what must pass to merge.
2. **Task runners:** `Makefile` targets (`check`, `lint`, `test`, `build`), `justfile`, `Taskfile.yml`, `tox.ini`, `noxfile.py`.
3. **Package scripts:** `package.json` `scripts`, `[project.scripts]` or `[tool.poe.tasks]` in `pyproject.toml`, `melos.yaml` scripts.
4. **Ecosystem defaults** (section 4).

Inspect without executing: `make -n <target>` prints a target's commands; `npm pkg get scripts` or `(Get-Content package.json -Raw | ConvertFrom-Json).scripts` lists scripts.

## 2. Package manager and runner prefix

| Signal file | Tool | Run a script | Run a binary |
| :--- | :--- | :--- | :--- |
| `pnpm-lock.yaml` | pnpm | `pnpm run <s>` | `pnpm exec <bin>` |
| `yarn.lock` | Yarn | `yarn <s>` | `yarn <bin>` |
| `bun.lock` or `bun.lockb` | Bun | `bun run <s>` | `bunx <bin>` |
| `package-lock.json` | npm | `npm run <s>` | `npx <bin>` |
| `uv.lock` | uv | `uv run <cmd>` | `uv run <bin>` |
| `poetry.lock` | Poetry | `poetry run <cmd>` | `poetry run <bin>` |
| `Pipfile.lock` | Pipenv | `pipenv run <cmd>` | `pipenv run <bin>` |
| `gradlew` / `gradlew.bat` | Gradle wrapper | `./gradlew <task>` (PowerShell: `.\gradlew.bat <task>`) | |
| `mvnw` / `mvnw.cmd` | Maven wrapper | `./mvnw <phase>` (PowerShell: `.\mvnw.cmd <phase>`) | |

Monorepos: `pnpm -r run <s>` runs a script in every workspace package; with Turborepo use `npx turbo run <task>`; with Nx use `npx nx affected -t <target>` for affected projects only.

## 3. Script-name mapping (package.json)

| Gate | Look for scripts named | Caution |
| :--- | :--- | :--- |
| format | `format:check`, `fmt:check`, `prettier:check` | `format` alone usually writes; run the tool in check mode instead |
| lint | `lint` | `lint:fix` writes |
| types | `typecheck`, `type-check`, `tsc`, `check-types` | |
| tests | `test`, `test:unit`, `test:ci` | `test` may start watch mode (plain `vitest`); prefer `vitest run` |
| coverage | `coverage`, `test:coverage`, `test:cov` | |
| build | `build` | |

## 4. Ecosystem defaults

| Ecosystem (signal) | Format check | Lint | Types | Tests | Build |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TS/JS (`package.json`, `tsconfig.json`) | `npx prettier --check .` | `npx eslint .` | `npx tsc --noEmit` | `npx vitest run` or `npx jest` | `npm run build` |
| Python (`pyproject.toml`) | `ruff format --check .` (or `black --check .`) | `ruff check .` | `mypy .` if `[tool.mypy]`; `pyright` if `[tool.pyright]` or `pyrightconfig.json` | `pytest` | `python -m build` (packages only) |
| Go (`go.mod`) | `gofmt -l .` (non-empty output = FAIL) | `go vet ./...`; `golangci-lint run` if `.golangci.yml` exists | (compiler) | `go test ./...` | `go build ./...` |
| Rust (`Cargo.toml`) | `cargo fmt --check` | `cargo clippy --all-targets -- -D warnings` | `cargo check --all-targets` | `cargo test` | `cargo build` |
| Dart/Flutter (`pubspec.yaml`) | `dart format --output=none --set-exit-if-changed .` | `flutter analyze` or `dart analyze` | (same as lint) | `flutter test` or `dart test` | `flutter build <target>` |
| Gradle (`build.gradle[.kts]`) | Spotless or ktlint task if configured | `./gradlew check` | `./gradlew compileJava` / `compileKotlin` | `./gradlew test` | `./gradlew build` |
| Maven (`pom.xml`) | plugin-specific | `mvn verify` | `mvn compile` | `mvn test` | `mvn package` |

`gofmt -l .` prints the files that need formatting and exits 0 either way; treat any output as FAIL.

## 5. Affected-test selection (quick mode)

| Runner | Command | Notes |
| :--- | :--- | :--- |
| Vitest | `npx vitest related <changed files> --run` | Uses the module graph |
| Jest | `npx jest --findRelatedTests <changed files>` | Uses the module graph |
| pytest | `pytest <test files mapped from changed modules>` | No built-in graph: map `src/pkg/foo.py` to `tests/**/test_foo.py`; if unsure, run the package's test directory |
| Go | `go test ./path/to/changed/pkg/...` | Add packages that import the changed package when the API changed |
| Rust | `cargo test -p <crate>` | Run the crate and its dependents in a workspace |
| Flutter | `flutter test <mapped test files>` | Same mapping approach as pytest |

## 6. Coverage thresholds (full mode)

Only enforce a threshold the project declares:

| Source | Where |
| :--- | :--- |
| Vitest | `test.coverage.thresholds` in `vitest.config.*` |
| Jest | `coverageThreshold` in `jest.config.*` or `package.json` |
| coverage.py | `fail_under` under `[tool.coverage.report]`, or `--cov-fail-under` in pytest `addopts` |
| Go / Rust | Usually a CI step (for example `cargo llvm-cov --fail-under-lines <n>`); read the workflow |

No declared threshold: report the number and mark the gate PASS on test success alone, noting "no threshold configured".

## 7. Security tools (full mode)

| Ecosystem | Command | Install if missing (ask first) |
| :--- | :--- | :--- |
| npm / pnpm / yarn | `npm audit --audit-level=high` (or `pnpm audit`, `yarn npm audit`) | bundled |
| Python | `pip-audit` | `pip install pip-audit` |
| Go | `govulncheck ./...` | `go install golang.org/x/vuln/cmd/govulncheck@latest` |
| Rust | `cargo audit` | `cargo install cargo-audit` |
| All | `eag shield --file <path>` per changed file | ships with EAG |

Installing a tool changes the environment, so ask before installing; otherwise mark that sub-check SKIP with "not installed".
