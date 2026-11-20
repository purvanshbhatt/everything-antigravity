---
name: codebase-onboard
description: >-
  Maps an unfamiliar repository fast: entry points, build and test commands,
  architecture layers, data flow, key modules and conventions, delegating
  breadth scans to the codebase-explorer subagent and writing the result as a
  CODEMAP.md. Use when the user opens a new repo, asks how a codebase works or
  where something is handled, or before planning work in unknown code. Invoke
  with /codebase-onboard.
---

# Codebase Onboard

Build a working model of a repository in minutes, grounded in `file:line` evidence, and leave it behind as a CODEMAP.md that the next session (human or agent) can start from. Depth on the paths that matter beats breadth over every file.

## When to use

- First session in a repository, or the user asks "how does this codebase work", "where is X handled" or "give me a tour".
- Before `/blueprint` in code you haven't mapped.
- CODEMAP.md is missing, or stale after major changes.

## When not to use

- You already know the area and need a plan: `/blueprint`.
- A single targeted question ("where is `parseInvoice` defined"): one `grep_search` answers it.
- Writing user or API documentation: `/update-docs` with `documentation-writing`.
- Judging whether the architecture is good: delegate to the `code-architect` subagent.

## Workflow

1. **Inventory the repository.** List the root with `list_dir`, then read in this order: `README*`, `CONTRIBUTING*`, `AGENTS.md` or `GEMINI.md` and any `.agents/` folder, manifests (`package.json`, `pnpm-workspace.yaml`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `build.gradle*`, `pom.xml`, `pubspec.yaml`), container and deploy files (`Dockerfile`, `docker-compose.yml`, `k8s/`, `*.tf`), and CI workflows (`.github/workflows/*.yml`).

   ```bash
   git ls-files | wc -l
   git ls-files | sed -n 's/.*\.\([^./]*\)$/\1/p' | sort | uniq -c | sort -rn | head
   ```

   ```powershell
   (git ls-files | Measure-Object).Count
   git ls-files | ForEach-Object { [IO.Path]::GetExtension($_) } | Group-Object | Sort-Object Count -Descending | Select-Object -First 10 Count, Name
   ```

   **Check:** You can name the languages, frameworks, package manager, layout (single package or monorepo) and approximate size.

2. **Find the real build, test and run commands.** CI workflows are the source of truth for what actually runs; package scripts and Makefile targets are shortcuts. Run the cheapest check (type-check or unit tests) to confirm the commands work. If dependencies are not installed, ask before installing: installs take time and execute third-party install scripts.

   **Check:** At least one verification command ran green, or the blocker is recorded.

3. **Locate the entry points.** Search for where execution starts:

   | Kind | Search for |
   | :--- | :--- |
   | Node CLI or server | `"bin"` and `"main"` in `package.json`, `createServer(`, `express()`, `.listen(` |
   | Web UI | `app/` or `pages/` routes (Next.js), `main.tsx`, `index.html` |
   | Python | `if __name__ == "__main__"`, `FastAPI(`, `Flask(`, `[project.scripts]`, `manage.py` |
   | Go | `func main(` under `cmd/` |
   | Rust | `fn main(`, `[[bin]]` in `Cargo.toml` |
   | Flutter | `void main(` in `lib/main.dart` |
   | Jobs and handlers | Cron configs, queue consumers, serverless handlers, `CMD` or `ENTRYPOINT` in `Dockerfile` |

   **Check:** Every deployable unit has an entry point with a `file:line`.

4. **Delegate the breadth scan.** For repositories over ~200 files or with several packages, split by top-level area and delegate each area to a `codebase-explorer` subagent, in parallel. Give each one the area path, the questions (responsibility, public interfaces, inbound and outbound dependencies, data stores, notable patterns) and the required output: a `file:line | what` table plus a five-line summary. Merge their tables; don't read every file yourself.

   **Check:** Every top-level area has a summary backed by `file:line` references.

5. **Map layers and dependency direction.** Name the layers (for example UI, transport/API, application, domain, data access, infrastructure) and check the import direction with search, such as `git grep -n "from app.db" -- app/domain/`. Record violations as facts without judging them.

   **Check:** The layer description matches what the imports show.

6. **Trace one request end to end.** Pick the most important user action and follow it from entry point to data store and back, listing each hop as `file:line`, including validation, authorization checks, side effects (queues, emails, events) and error handling.

   **Check:** The trace has no gaps; each hop names the function that hands off to the next.

7. **Record conventions and hot spots.** Naming, error handling, logging, config and env loading (variable names only, never values), test layout and fixtures, commit style (`git log --oneline -20`), ownership (`CODEOWNERS`), and lint and format config. Hot spots: the most-changed files over the last 90 days, and the largest files.

   **Check:** A newcomer could add a module that passes review using only this section.

8. **Write CODEMAP.md.** Use [the CODEMAP template](references/codemap-template.md). Ask where it should live: repository root, `docs/`, or only as an artifact. If a CODEMAP already exists, update it in place and show the diff; never overwrite it without confirmation. Keep it under ~300 lines and link to files rather than copying code.

   **Check:** Every claim in CODEMAP.md cites a path, and it contains no secrets or env values.

9. **Persist what matters.** Save a session summary with `/session-save`, and record non-obvious conventions as project instincts (fallback: `node <plugin-root>/bin/eag.js instincts add ...`):

   ```bash
   eag instincts add --trigger "adding a database query in this repo" --action "go through src/db/repo.ts; never import the driver directly" --scope project --confidence 0.6 --evidence "CODEMAP layering section"
   ```

   **Check:** `eag instincts list` shows the new entries.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Read files alphabetically | Entry points first, then trace a request | Execution order reveals architecture; alphabetical order doesn't |
| Trust the README's commands | Confirm against CI and by running one | READMEs drift; CI runs every day |
| Write summaries without paths | Cite `file:line` for every claim | Unverifiable maps mislead the next session |
| Read the whole repository yourself | Delegate breadth to `codebase-explorer` | Context fills with detail you'll never use |
| Install dependencies without asking | Ask first | Install scripts execute third-party code |
| Copy env values or secrets into the map | Record names only | CODEMAP gets committed and shared |
| Judge the architecture while mapping | Record facts; hand opinions to `code-architect` | Mixing them makes the map less trustworthy |

## Verification checklist

- [ ] Languages, frameworks, package manager and layout are identified.
- [ ] Build and test commands were confirmed by running at least one.
- [ ] Entry points and one end-to-end request trace are recorded with `file:line`.
- [ ] Layers and dependency direction were checked against actual imports.
- [ ] Conventions and hot spots are recorded, with no secret values anywhere.
- [ ] CODEMAP.md was written or updated where the user chose, and the session was saved.

## Related

- Workflows: `/blueprint`, `/session-save`, `/session-resume`, `/instincts`, `/update-docs`, `/deep-work`.
- Agents: `codebase-explorer`, `code-architect`, `doc-updater`.
- Knowledge: `software-architecture`, `documentation-writing`, `context-compaction`, `subagent-delegation`.
