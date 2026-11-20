---
name: update-docs
description: >-
  Syncs documentation with code: detects drift from the diff (changed public
  APIs, CLI flags, env vars, scripts, config keys), updates README, CHANGELOG,
  API docs, CODEMAP and ADRs, verifies that code samples still run, and
  delegates large sweeps to the doc-updater subagent. Use after a feature or
  refactor, before a release, or when the user says the docs are out of date.
  Invoke with /update-docs.
---

# Update Docs

Docs rot one renamed flag at a time. Start from what the code changed, find
every place the docs describe it, fix those places, and prove the examples
still work. Do not rewrite docs that did not drift; a focused doc diff gets
reviewed, a sweeping one gets skimmed.

## When to use

- After a feature, refactor or dependency upgrade that changed anything a user, operator or caller touches.
- Before a release or as part of `/pr-ready`.
- The user says "update the docs", "the README is wrong", "document this flag".
- A new env var, CLI flag, script, endpoint or config key landed without docs.

## When not to use

- Writing new long-form documentation from scratch (guides, tutorials): use the `documentation-writing` knowledge skill.
- Onboarding yourself to a repository: use `/codebase-onboard`.
- Session notes and hand-offs: use `/session-save`; those are not project docs.
- Release notes and marketing copy: use the `copywriting` knowledge skill.

## Workflow

1. **Scope the change.**

   ```bash
   git diff --name-only origin/main...HEAD          # or <last-tag>..HEAD before a release
   git describe --tags --abbrev=0                   # last tag, if releasing
   ```

   **Check:** You have the list of changed source files and the base you compared against.

2. **Detect drift candidates** in the diff. Each hit is something that may be documented somewhere.

   ```bash
   B=origin/main...HEAD
   git diff $B -U0 | grep -nE '^[+-].*(process\.env\.|import\.meta\.env\.|os\.environ|os\.getenv|os\.Getenv|env::var)'      # env vars
   git diff $B -U0 | grep -nE '^[+-].*(add_argument\(|\.option\(|click\.option|Flags\(\)\.|flag\.(String|Bool|Int)|#\[arg)'  # CLI flags
   git diff $B -U0 | grep -nE '^[+-]\s*(export |pub fn |pub struct |def [a-z]|func [A-Z]|@(app|router)\.(get|post|put|delete))'  # public API
   git diff $B -- package.json Makefile justfile pyproject.toml docker-compose.yml '*.env.example'                              # scripts, config
   ```

   ```powershell
   $B = 'origin/main...HEAD'
   git diff $B -U0 | Select-String -Pattern '^[+-].*(process\.env\.|import\.meta\.env\.|os\.environ|os\.getenv|os\.Getenv|env::var)'
   git diff $B -U0 | Select-String -Pattern '^[+-].*(add_argument\(|\.option\(|click\.option|Flags\(\)\.|flag\.(String|Bool|Int)|#\[arg)'
   git diff $B -U0 | Select-String -Pattern '^[+-]\s*(export |pub fn |pub struct |def [a-z]|func [A-Z]|@(app|router)\.(get|post|put|delete))'
   git diff $B -- package.json Makefile justfile pyproject.toml docker-compose.yml '*.env.example'
   ```

   **Check:** You have a list of added, removed and renamed items (old name and new name).

3. **Find where each item is documented.** Use `grep_search` for the old and new names across `*.md`, `docs/`, docstrings, OpenAPI or GraphQL schemas, `.env.example`, CLI `--help` text and code comments that serve as docs. Build a drift table: item, change, doc locations, action.

   **Check:** Every drift candidate has either doc locations or "undocumented: add to <file>".

4. **Update, in the project's existing style.**

   | Doc | What to update |
   | :--- | :--- |
   | README | Install, quick start, usage, flags, env vars, scripts |
   | CHANGELOG | One user-facing line under `## [Unreleased]` (skip if the changelog is generated from commits) |
   | API docs | Regenerate with the project's generator if one exists (check `package.json` scripts or the Makefile); otherwise edit docstrings or the schema, never the generated output |
   | CODEMAP or architecture map | Add, move or remove modules that were added, moved or deleted; keep one line per module |
   | ADRs | Never rewrite an accepted ADR. Write a new one that supersedes it and set the old one's status to "Superseded by ADR-NNN" |
   | `.env.example` | Add new variables with placeholder values and a comment; never real values |

   **Check:** The doc diff touches only drifted content, and every drift-table row is resolved.

5. **Verify code samples still run.** For each fenced example in the changed docs:
   - Shell commands: run the safe ones (`--help`, `--version`, `--dry-run`, read-only queries); compare `<cli> --help` against the documented flags.
   - Python: `python -m doctest -v README.md` for `>>>` examples, or paste the snippet into a scratch file and run it.
   - Go: `go test ./...` runs `Example` functions; Rust: `cargo test --doc`.
   - TypeScript or JavaScript: copy the snippet into a scratch file and run `npx tsc --noEmit <file>` or `node <file>`.
   - Links: run the project's link checker if it has one; otherwise check relative links to files you moved.
   Never run examples that deploy, migrate, send messages or delete data; mark them "not executed" in the report.

   **Check:** Every changed example ran or is listed as not executed with a reason.

6. **Delegate large sweeps.** More than about 10 doc files, a full CODEMAP regeneration, or docs across several packages: delegate to the `doc-updater` subagent with the drift table, the file list, the style rules (heading case, tone, line width), and the output contract "unified diff per file plus a list of samples you could not verify". Review its diff yourself before applying.

   **Check:** The delegated diff matches the drift table and contains no unrelated rewrites.

7. **Report and stop.** Show the drift table with status, the doc diff summary, and the sample verification results. Offer to commit (`docs: sync <area> with <change>`) and commit only on a yes.

   **Check:** The user can see what drifted, what changed, and what could not be verified.

## Patterns

### Drift table

| Item | Change | Documented in | Action | Status |
| :--- | :--- | :--- | :--- | :--- |
| `--max-retries` flag | renamed from `--retries` | `README.md:88`, `docs/cli.md:41` | update both, note rename in CHANGELOG | done |
| `ORDERS_DB_URL` env var | added | nowhere | add to README env table and `.env.example` | done |
| `GET /v1/search` | removed | `docs/api.md:120`, OpenAPI | remove, add migration note | done |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Rewrite whole docs while updating one flag | Change only drifted content | Large doc diffs hide the real fix and get rubber-stamped |
| Edit generated API docs | Change the source (docstrings, schema) and regenerate | Generated output is overwritten on the next build |
| Edit an accepted ADR to match new code | Add a superseding ADR | ADRs record why a decision was made at the time |
| Trust a sample because it "looks right" | Run it, or mark it not executed | Broken examples are the most visible doc bug |
| Put real values in `.env.example` | Use placeholders and comments | The example file is committed and public |
| Document internals in the README | Keep the README to what users and operators touch | Internals belong in code comments, the CODEMAP or ADRs |

## Verification checklist

- [ ] Drift candidates came from the diff, not from memory.
- [ ] Every candidate is resolved in the drift table.
- [ ] Generated docs were regenerated, not hand-edited.
- [ ] Accepted ADRs were superseded, never rewritten.
- [ ] Every changed code sample ran, or is listed as not executed with a reason.
- [ ] Any commit was approved by the user.

## Related

- Workflows: `/pr-ready`, `/codebase-onboard`, `/refactor-clean`, `/session-save`.
- Knowledge: `documentation-writing`, `api-design`, `software-architecture`, `git-workflow`.
- Agents: `doc-updater` (large sweeps), `codebase-explorer` (mapping modules for the CODEMAP).
