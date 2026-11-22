# Changelog

All notable changes to Everything Antigravity (EAG) are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [2.1.0] - 2026-11-22

Coverage for every major field, not just software engineering.

### Added

- **248 new skills (327 in total), in 15 catalog categories.** Highlights:
  - 32 language and runtime skills.
  - 23 frontend and 9 mobile/desktop skills.
  - 22 backend and API skills, and 17 data and database skills.
  - 29 AI and ML skills.
  - 29 cloud, DevOps and SRE skills (Google Cloud first, plus AWS and Azure essentials).
  - 16 security and compliance skills.
  - 10 industry verticals, 15 games skills and 14 media and design skills.
  - 35 product, growth and business skills.
  - 10 writing, research and education skills.
- **15 new slash-command workflows (41 in total):** `/write-spec`, `/explain-code`, `/framework-migration`, `/dockerize`, `/perf-audit`, `/a11y-audit`, `/postmortem`, `/architecture-decision`, `/api-scaffold`, `/ui-polish`, `/research-synthesis`, `/threat-modeling`, `/issue-triage`, `/release-management` and `/dependency-upgrades`.
- **30 new subagents (53 in total):**
  - Language reviewers for Java, Kotlin, Rust, C++, C#, Swift, Dart, PHP, Ruby, React and SQL.
  - Build resolvers for JVM, Rust, C++, .NET and mobile.
  - Frontend, backend, mobile, data, ML and SRE engineers.
  - Incident commander, product manager, UX designer, technical writer, data analyst, compliance auditor, migration specialist and deep researcher.
- **9 new glob-scoped rules (30 in total):** Ruby, PHP, React, Elixir, Scala, Protobuf, GraphQL, notebooks and Markdown docs.
- `scripts/categories.json` drives the catalog grouping in `docs/CATALOG.md`.

## [2.0.0] - 2026-11-20

A ground-up rebuild as a native Antigravity plugin.

### Added

- **Native plugin.**
  - The repository root is now a valid Antigravity plugin: `plugin.json` with logo and suggested prompts, plus `hooks.json`, `skills/`, `agents/` and `rules/`.
  - In v1 the installed plugin contained no components at all.
- **Skills: 79 in total.**
  - 26 slash-command workflows: `/blueprint`, `/feature-dev`, `/tdd`, `/code-review`, `/build-fix`, `/verify`, `/root-cause`, `/refactor-clean`, `/test-coverage`, `/e2e`, `/codebase-onboard`, `/checkpoint`, `/session-save`, `/session-resume`, `/deep-work`, `/orchestrate`, `/instinct-capture`, `/instincts`, `/harness-audit`, `/skill-create`, `/pr-ready`, `/update-docs`, `/security-scan`, `/game-build`, `/video-render` and `/marketing-launch`.
  - New knowledge skills: `gemini-api`, `google-adk`, `antigravity-customization`, `mcp-server-development`, `prompt-engineering`, `agent-evals`, `rag-pipelines`, `llm-cost-routing`, `frontend-react-nextjs`, `web-performance`, `accessibility-a11y`, `auth-patterns`, `python-fastapi`, `golang-services`, `rust-systems`, `browser-automation`, `docker-containers`, `kubernetes-gke`, `terraform-iac`, `ci-cd-github-actions`, `observability-otel`, `git-workflow` and `documentation-writing`.
- **Subagents: 23 in total.** Each has Antigravity frontmatter, a least-privilege tool set and a model tier (`flash`, `pro` or `inherit`). New agents:
  - `planner`, `build-error-resolver`, `refactor-cleaner`, `doc-updater`, `e2e-runner` and `performance-optimizer`.
  - `silent-failure-hunter`, `codebase-explorer`, `typescript-reviewer`, `python-reviewer` and `go-reviewer`.
  - `gemini-ai-engineer` and `accessibility-auditor`.
- **Rules.**
  - An always-on core, `rules/AGENTS.md`, at about 1.1k tokens.
  - 16 glob-scoped language rules and 4 `model_decision` rules.
- **Hooks**, verified against a live `agy` agent:
  - A PreToolUse guard that denies catastrophic commands and force-asks before risky ones.
  - The guard also blocks real-looking keys in source files (`.env` files are allowed) and asks on low-confidence matches.
  - A PostToolUse tracker.
  - SessionStart memory and instinct injection.
  - A Stop hook that saves session summaries and runs the verify gate.
  - A PreInvocation compaction nudge.
- **Hook profiles:** `minimal`, `standard` and `strict`, set with `eag profile set`, plus `EAG_DISABLED_HOOKS` for single features.
- **Continuous learning:** confidence-weighted instincts (`eag instincts …`), with promotion to project skills and team export and import.
- **`eag` CLI** (Node, zero dependencies): `install`, `uninstall`, `doctor`, `status`, `update`, `validate`, `list`, `profile`, `sessions`, `instincts`, `shield`, `compact` and `mcp`.
- **One-stop installer:**
  - Installs a clean plugin bundle, and the Gemini CLI extension when Gemini CLI is detected.
  - Can optionally mirror skills into Cursor or Codex.
  - Supports dry runs, safely migrates v1 installs, backs up previous copies, refuses to overwrite foreign plugins, smoke-tests the hooks, and records its own files so uninstall is exact.
- **Gemini CLI support (beta):** `gemini-extension.json` and `hooks/hooks.json` with a snake_case payload adapter.
- **Vetted MCP catalog** (`eag mcp list|show|add`), which always previews and backs up your config before writing.
- **Tooling for contributors:** a repository validator (`npm run validate`), a catalog generator (`docs/CATALOG.md`), `docs/AUTHORING.md`, `docs/ARCHITECTURE.md`, and a `node:test` suite for hooks, installer, CLI and validator.

### Changed

- v1 slash commands became workflow skills, renamed so they don't shadow Antigravity built-ins:

  | v1 | v2 |
  | :--- | :--- |
  | `/plan` | `/blueprint` |
  | `/boost` | `/deep-work` |
  | `/learn` | `/instinct-capture` |
  | `/review` | `/code-review` |
  | `/audit` | `/security-scan` |

- Every v1 skill was rewritten. Each went from about 1.2 KB to 7–11 KB, with workflows, Check steps, anti-patterns, a verification checklist and references.
- `bin/eag.js` is now a Node CLI. Node.js 18+ is the only requirement.
- `index.js` exposes the new libraries; the v1 function names still work as aliases.

### Removed

- `commands/`: replaced by workflow skills. Antigravity workflows are deprecated.
- `plugins/everything-antigravity/`: the root is now the plugin.
- `.antigravity/marketplace.json`: undocumented format, and it pointed at the wrong organization.
- The v1 MCP configs that referenced packages that don't exist. They are replaced by `mcp-configs/catalog.json`.
- `bin/eag.sh`.
- The Python toolkit (`src/`, `pyproject.toml`, Python tests) and the v1 Python `examples/`. The Node CLI covers the scanner (`eag shield`) and the compactor (`eag compact`).
- `marketing/`, `Makefile` and `.npmignore`. The `files` list in `package.json` defines the npm package.

## [1.0.0] - Initial release

### Added

- **Core engine:** the `AgentShield` security scanner, `ContextCompactor` and `AntigravityOrchestrator`.
- **Skills:** 30 across business and marketing, security, engineering, game development, multimedia and video, and Antigravity orchestration.
- **Subagents:** 10 agent definitions.
- **Workflow commands:** `/boost`, `/review`, `/audit`, `/feature-dev`, `/game-build`, `/video-render`, `/marketing-launch` and `/checkpoint`.
- **Installers:** symlink-based installers for POSIX and Windows.
