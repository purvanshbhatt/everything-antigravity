---
name: task-runners
disable-model-invocation: true
description: >-
  Designs a project's command surface with Make, just, npm/pnpm scripts,
  Taskfile or mise tasks: standard task names, one entry point shared by
  developers and CI, argument passing, dependencies, incremental builds, and
  Windows-compatible commands. Use when a repo has scattered scripts, when
  README commands differ from CI, when choosing between Make and just, or
  when npm scripts break on Windows.
---

# Task Runners

Give every repo one discoverable list of commands (`setup`, `dev`, `test`,
`lint`, `build`, `check`) that humans, agents and CI all call the same way, on
every operating system. The runner matters less than the conventions.

## When to use

- Commands live in README prose, shell history and CI YAML, and they disagree.
- Choosing a runner for a new or polyglot repository.
- npm scripts use `rm -rf`, `export` or single quotes and fail on Windows.
- CI runs different steps than developers run locally.

## When not to use

- Monorepo task graphs with remote caching: use `monorepo-tooling` (Turborepo, Nx).
- Installing and pinning toolchains: use `dev-environments`.
- Lint and formatter configuration itself: use `linting-formatting`.
- Writing long shell scripts: use `bash-scripting` or `powershell-scripting`, and call them from a task.

## Workflow

1. **Inventory existing commands.** Read `package.json` scripts, `Makefile`, `justfile`, `Taskfile.yml`, `mise.toml`, CI workflow steps and the README. CI is the source of truth for what "passing" means.

   **Check:** A table maps each CI step to a local command, with mismatches marked.

2. **Pick one entry point.**

   | Situation | Choose |
   | :--- | :--- |
   | JavaScript/TypeScript-only repo | npm/pnpm scripts, logic in `scripts/*.mjs` |
   | Polyglot repo, Windows users, simple recipes | `just` |
   | Want YAML, file-based up-to-date checks, parallel deps | Taskfile (go-task) |
   | Already pinning tools with mise | mise tasks |
   | C/C++ or file-target builds, Unix-only team | Make |

   Other runners may stay, but the README documents only the entry point.

3. **Define standard verbs.** `setup` (install everything), `dev` (run locally), `test`, `lint`, `fmt`, `typecheck`, `build`, `check` (exactly what CI runs), `clean`. Each task has a one-line description so `--list` is self-documenting.

   **Check:** `just --list`, `task --list` or `npm run` prints every verb with a description.

4. **Make tasks cross-platform.** npm runs scripts with `sh` on POSIX and `cmd.exe` on Windows by default. Avoid `rm -rf`, `cp`, `export X=1`, `&` backgrounding and single quotes in npm scripts; use `node scripts/clean.mjs`, `rimraf`, or `cross-env`. In just, set a Windows shell. Make is not installed on Windows by default; do not make it the only entry point for Windows contributors.

   **Check:** `check` passes on Windows PowerShell and on Linux or macOS (CI matrix or a local run).

5. **Make CI call the tasks.** Replace inline CI commands with `npm run check`, `just check` or `task check`, so local and CI cannot diverge.

   **Check:** The CI workflow contains task invocations, not duplicated command lines.

6. **Add incremental and parallel behaviour where it pays.** Taskfile `sources`/`generates` and Make targets skip up-to-date work; `deps` run in parallel in Taskfile; npm uses `npm-run-all2` (`run-p`) or `concurrently` for parallel scripts.

   **Check:** A second `build` with no changes is noticeably faster or reports "up to date".

## Examples

### justfile

```just
set dotenv-load
set windows-shell := ["pwsh.exe", "-NoLogo", "-Command"]

# List recipes
default:
    @just --list

# Install dependencies and start services
setup:
    npm ci
    docker compose up -d --wait

# Run tests; extra args pass through: just test --watch
test *args:
    npm test -- {{args}}

# Everything CI runs
check: lint typecheck test
```

### Taskfile.yml

```yaml
version: '3'
tasks:
  build:
    desc: Compile the binary
    cmds:
      - go build -o bin/app ./cmd/app
    sources:
      - '**/*.go'
    generates:
      - bin/app
  lint:
    desc: Static checks
    cmds:
      - go vet ./...
  check:
    desc: Everything CI runs
    deps: [lint, build]   # deps run in parallel
    cmds:
      - go test ./...
```

### package.json

```json
{
  "scripts": {
    "clean": "node scripts/clean.mjs",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "check": "npm run lint && npm run typecheck && npm run test"
  }
}
```

`npm run test -- --reporter=verbose` passes extra flags. npm runs `pre<name>` and `post<name>` scripts automatically; pnpm does not by default (verify for your version), so avoid relying on them.

### Makefile

```make
.PHONY: test lint check
test:
	go test ./...
lint:
	go vet ./...
check: lint test
```

Recipe lines must start with a tab. Declare non-file targets in `.PHONY`, and call sub-makes with `$(MAKE)`.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Different commands in README and CI | CI calls the same `check` task | Local green, CI red wastes hours |
| POSIX-only syntax in npm scripts | Node scripts, `rimraf`, `cross-env`, or just with a Windows shell | `cmd.exe` breaks quoting and `rm` |
| 30-line shell one-liners inside tasks | Move logic to `scripts/` and call it | Unreadable, untestable, unportable |
| Several runners documented as equals | One documented entry point | Contributors guess and drift |
| Undocumented tasks | Descriptions shown by `--list` | Discoverability for people and agents |
| Tasks that prompt interactively | Flags or env vars; never prompt in `check` | Hangs CI and agent runs |

## Verification checklist

- [ ] One entry point lists all standard verbs with descriptions.
- [ ] `check` equals what CI runs, and CI invokes it.
- [ ] Tasks run on Windows PowerShell and a POSIX shell.
- [ ] No task prompts for input or depends on personal machine state.
- [ ] README documents the entry point and the `--list` command.

## Related

- Workflows: `/verify`, `/codebase-onboard`.
- Knowledge: `dev-environments`, `monorepo-tooling`, `ci-cd-github-actions`, `linting-formatting`, `bash-scripting`, `powershell-scripting`.
- Agents: `build-error-resolver`.
