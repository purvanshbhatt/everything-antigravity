---
name: dev-environments
description: >-
  Builds reproducible developer environments: pinned toolchains with mise,
  asdf or version files, Dev Containers and the devcontainer CLI, Nix dev
  shells, local services with Docker Compose, env templates, dotfiles, and
  idempotent bootstrap scripts for bash and PowerShell. Use when onboarding
  takes days, "works on my machine" bugs appear, CI and laptops disagree on
  versions, or a repo needs a one-command setup.
---

# Dev Environments

A new contributor should get from clone to a green test run with one command,
on macOS, Linux or Windows, using the same tool versions as CI. Pin everything
that can drift, script everything that is manual, and test the setup on a clean
machine.

## When to use

- Onboarding needs a wiki page of manual steps or takes more than an hour.
- Bugs differ between laptops and CI because of Node, Python, Go or Java versions.
- A project needs Postgres, Redis or other services for local development.
- Choosing between mise, Dev Containers and Nix for a team.

## When not to use

- Containerizing the app for production: use `/dockerize` and `docker-containers`.
- Defining the task commands themselves: use `task-runners`.
- Secret storage and rotation: use `secrets-management`.
- Internal platforms and golden paths across many repos: use `platform-engineering`.

## Workflow

1. **Inventory the real requirements.** CI config is the source of truth for versions. Read `.github/workflows/*.yml` (or equivalent), README, `package.json` engines, `pyproject.toml`, `go.mod`, Dockerfiles and compose files. List runtimes, package managers, system packages, services, env vars and secrets.

   **Check:** A table lists every tool with the exact version CI uses.

2. **Pin toolchains in files.** Choose one manager and commit its file:

   | Tool | File | Notes |
   | :--- | :--- | :--- |
   | mise | `mise.toml` | Multi-language, env vars and tasks; reads `.tool-versions` and `.nvmrc` |
   | asdf | `.tool-versions` | Plugin per language; Unix-focused |
   | Node only | `.nvmrc` / `.node-version`, `"packageManager"` in `package.json` | Pin pnpm/yarn via `packageManager` |
   | Python | `.python-version`, `requires-python` | `uv` and pyenv both read `.python-version` |
   | Rust | `rust-toolchain.toml` | rustup installs it automatically |
   | Go | `go` and `toolchain` lines in `go.mod` | Go 1.21+ downloads the toolchain |

   ```toml
   # mise.toml
   [tools]
   node = "22"
   python = "3.12"

   [env]
   DATABASE_URL = "postgres://dev:dev@localhost:5432/app"
   ```

   **Check:** `mise install` (or the chosen tool) on a fresh shell yields the CI versions: compare `node --version`, `python --version`.

3. **Run services with Compose.** Put databases and queues in `compose.yaml` with healthchecks and named volumes; bind to `127.0.0.1` only. Start and block until healthy:

   ```bash
   docker compose up -d --wait
   ```

   **Check:** `docker compose ps` shows every service `healthy`.

4. **Template configuration.** Commit `.env.example` with safe placeholder values and comments; ignore `.env`. Load secrets from the team's secret manager CLI, never from the repo. Optional: `direnv` with an `.envrc` that loads `.env`.

   **Check:** `git check-ignore .env` prints `.env`; `.env.example` lists every variable the app reads (`grep_search` for `process.env`, `os.environ`, `os.Getenv`).

5. **Write an idempotent bootstrap.** One entry point, `scripts/bootstrap.sh` plus `scripts/bootstrap.ps1` (or a `setup` task in the task runner) that checks prerequisites with actionable errors, installs pinned tools, installs dependencies with the lockfile (`npm ci`, `uv sync`, `go mod download`), starts services, migrates and seeds. Safe to re-run.

   ```powershell
   # scripts/bootstrap.ps1
   $ErrorActionPreference = 'Stop'
   if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Install Docker Desktop first: https://docs.docker.com/get-docker/' }
   mise install
   npm ci
   docker compose up -d --wait
   npm run db:migrate
   ```

   **Check:** Running bootstrap twice in a row succeeds both times with no manual step.

6. **Add a Dev Container when host setup is too varied.** `.devcontainer/devcontainer.json` gives a full Linux environment for editors with Dev Containers support and for cloud workspaces:

   ```json
   {
     "name": "app",
     "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
     "features": { "ghcr.io/devcontainers/features/node:1": { "version": "22" } },
     "forwardPorts": [3000],
     "postCreateCommand": "npm ci",
     "customizations": { "vscode": { "extensions": ["dbaeumer.vscode-eslint"] } }
   }
   ```

   Verify image tags and feature options against the current Dev Containers docs. Not every VS Code-compatible editor build includes Dev Containers support (check yours, including the Antigravity IDE); the CLI works anywhere Docker does:

   ```bash
   npx @devcontainers/cli up --workspace-folder .
   npx @devcontainers/cli exec --workspace-folder . npm test
   ```

   **Check:** `devcontainer exec ... npm test` passes in a fresh container.

7. **Consider Nix for bit-for-bit reproducibility.** A flake `devShell` entered with `nix develop` (or `use flake` in `.envrc`) pins every system package. Powerful but a steep learning curve and weak native Windows support (use WSL2).

8. **Prove it on a clean machine.** Fresh clone in a temp directory or a throwaway container, run bootstrap, run tests, record time to green. Add a CI job that runs the bootstrap so it cannot rot.

   **Check:** Clean clone to passing tests takes one command and is timed in the README.

## Choosing an approach

| Situation | Choose |
| :--- | :--- |
| Single-language repo, mixed OS team | Version files + mise, bootstrap scripts |
| Many system dependencies or native libraries | Dev Container |
| Cloud workspaces or locked-down laptops | Dev Container |
| Need exact reproducibility, Nix-comfortable team | Nix flake dev shell |
| Windows users with bash-heavy tooling | WSL2 plus any of the above |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| "Install Node 20 or later" in the README | Pin the exact major in a version file | Ranges drift between laptops and CI |
| Commit `.env` with real credentials | `.env.example` plus a secret manager | Leaked secrets are permanent in git history |
| Bash-only setup scripts | Bash plus PowerShell, or a cross-platform task runner | Windows contributors are blocked |
| Put personal dotfiles in the repo | Keep project config in the repo, personal config in a dotfiles repo | Personal preferences break others' setups |
| Ship a devcontainer nobody tests | Run it in CI | Untested environments rot within weeks |
| Mix CRLF and LF silently | `.gitattributes` with `* text=auto eol=lf` | Scripts fail with `\r` errors on Linux |

## Verification checklist

- [ ] Tool versions are pinned in committed files and match CI.
- [ ] Services start with `docker compose up -d --wait` and report healthy.
- [ ] `.env.example` covers every variable; `.env` is ignored.
- [ ] Bootstrap is idempotent and exists for bash and PowerShell (or a cross-platform runner).
- [ ] Clean-clone setup is proven in CI and timed in the README.

## Related

- Workflows: `/codebase-onboard`, `/dockerize`, `/verify`.
- Knowledge: `docker-containers`, `task-runners`, `secrets-management`, `monorepo-tooling`, `platform-engineering`, `bash-scripting`, `powershell-scripting`.
- Agents: `cloud-devops-engineer`, `build-error-resolver`.
