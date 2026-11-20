---
name: documentation-writing
description: >-
  Writes and maintains developer documentation: READMEs with a 60-second
  quickstart, Diátaxis-structured docs, architecture decision records,
  generated API reference (TypeDoc, Sphinx, mkdocstrings, godoc), docs-as-code
  with link checking, and Keep a Changelog plus SemVer release notes. Use when
  writing or restructuring docs, recording a decision or release, or when docs
  have drifted from the code.
---

# Documentation Writing

Write docs that get a new developer from zero to a working result in minutes and
stay true as the code changes. Every command in a doc must have been run, every
config key must come from the source, and every page must serve one reader goal.

## When to use

- Writing or restructuring a README, a docs site, a how-to guide or a tutorial.
- Recording an architecture decision, or writing a CHANGELOG entry and release notes.
- Setting up generated API reference, link checking or docs builds in CI.
- Users report that the docs are wrong, or a code change made a page stale.

## When not to use

- Updating existing docs after a change set as a routine step: run `/update-docs` (it uses this skill's rules).
- Marketing pages, landing copy or launch posts: use `copywriting`.
- Designing the API itself (naming, versioning, errors): use `api-design`.
- Onboarding yourself to an unfamiliar codebase: use `/codebase-onboard`.

## Workflow

1. **Name the reader, the goal and the page type.** Classify each page with Diátaxis (table below): tutorial, how-to, reference or explanation. A page that tries to be two types gets split.

   **Check:** Every page you touch has one stated type and one reader goal in its first paragraph.

2. **Gather facts from the code, not from memory.** Use `grep_search` for configuration and flags (`process.env.`, `os.environ`, `os.Getenv`, `std::env::var`, CLI option definitions, config schemas) and `view_file` the entrypoints. Run every command you document in a clean environment and capture its real output.

   **Check:** Each command in the draft has been executed, and each config key in a table maps to a line in the source.

3. **Write the README to the structure below.** The quickstart lists prerequisites with versions, gives copy-paste commands (PowerShell variants where they differ), and shows the expected output so readers know it worked.

   **Check:** Following only the README from a fresh clone reaches the expected output in about 60 seconds of commands (excluding downloads).

4. **Organize the docs set by Diátaxis.** Put tutorials, how-to guides, reference and explanation in separate sections; link between them instead of repeating content. Name how-to pages as tasks ("Rotate API keys").

   **Check:** The navigation shows the four types clearly, and no page duplicates another's content.

5. **Record significant decisions as ADRs.** One file per decision in `docs/adr/NNNN-short-title.md` with Status, Context, Decision and Consequences. Accepted ADRs are immutable; a new ADR supersedes an old one and both link to each other. Template in [templates](references/templates.md).

   **Check:** The ADR states the alternatives considered and the consequences, including the negative ones.

6. **Generate API reference from source comments.** Use the ecosystem tool from the table below and fail the build on warnings. Keep examples in doc comments executable (doctests, Go `Example` functions).

   **Check:** The reference build passes with warnings as errors, and undocumented public symbols are flagged (TypeDoc `validation.notDocumented`, ruff `D1` rules, revive `exported`, Rust `#![deny(missing_docs)]`).

7. **Maintain the CHANGELOG with SemVer.** Add entries under `## [Unreleased]` in the same PR as the change, grouped as Added, Changed, Deprecated, Removed, Fixed and Security. Breaking changes bump MAJOR and include a migration note.

   **Check:** Every user-visible change in the release range has an entry, and the version bump matches the most severe entry.

8. **Gate docs in CI.** Link check, Markdown lint, prose lint if the project uses Vale, a strict docs build, doctests, and a drift check for generated files:

   ```bash
   lychee --no-progress "**/*.md"
   npx markdownlint-cli2 "**/*.md" "#node_modules"
   mkdocs build --strict              # or: sphinx-build -W --keep-going -b html docs docs/_build/html
   git diff --exit-code -- docs/api   # after regenerating: fails if committed reference is stale
   ```

   **Check:** CI fails on a deliberately broken link, and passes once it is fixed.

9. **Keep docs in sync with code.** Docs change in the same PR as the behaviour they describe; add a docs checkbox to the PR template and a CODEOWNERS entry for `docs/`. Include code samples from tested files (`pymdownx.snippets`, Sphinx `literalinclude`) rather than pasting them. For larger sweeps, delegate to the `doc-updater` subagent with the diff and the list of affected pages.

   **Check:** `git diff --stat` for the PR includes docs whenever public behaviour, config or CLI output changed.

## Patterns

### README structure

| Section | Content | Rule |
| :--- | :--- | :--- |
| Title and one-liner | What it is and who it is for | One sentence, no buzzwords |
| Why | The problem and what is different about this solution | Two to four bullets |
| Quickstart | Install, run, expected output | Copy-paste only; about 60 seconds |
| Usage | The two or three most common tasks, with real examples | Each example runs as shown |
| Configuration | Table: name, default, required, description | Generated from or checked against source |
| Troubleshooting | Symptom, cause, fix | The top three to five real support questions |
| Contributing, license, links | How to develop, test and release | Link to `CONTRIBUTING.md` for detail |

### Diátaxis

| Type | Reader is | Answers | Write it as |
| :--- | :--- | :--- | :--- |
| Tutorial | Learning | "Teach me by doing" | A guaranteed-success lesson; no choices, no tangents |
| How-to guide | Working on a task | "How do I...?" | Numbered steps toward one goal; assumes basics |
| Reference | Looking something up | "What exactly is...?" | Complete, dry, consistently structured; generated where possible |
| Explanation | Studying | "Why is it like this?" | Discussion of design, trade-offs and history; links to ADRs |

### API reference by ecosystem

| Ecosystem | Tool | Strict build |
| :--- | :--- | :--- |
| TypeScript | TypeDoc (TSDoc comments) | `npx typedoc --entryPoints src/index.ts --out docs/api --treatWarningsAsErrors` |
| Python (MkDocs) | mkdocstrings (`::: package.module` in a page) | `mkdocs build --strict` |
| Python (Sphinx) | autodoc + napoleon (Google or NumPy docstrings) | `sphinx-build -W --keep-going -b html docs docs/_build/html` |
| Go | godoc comments, `Example` functions with `// Output:` | `go vet ./...` and `go test ./...` (runs examples) |
| Rust | rustdoc, doctests | `cargo doc --no-deps` and `cargo test --doc` |
| HTTP APIs | OpenAPI spec rendered with Redoc or Swagger UI | `npx @redocly/cli lint openapi.yaml` |

### Style rules for developer docs

- Second person, present tense, active voice; steps start with a verb ("Run", "Set").
- Lead with the outcome; put prerequisites before the first step, not inside it.
- Commands without a `$` prompt, output in a separate block, placeholders in `<ANGLE_CAPS>` and explained once.
- Use the exact names from the code (flags, env vars, types); define each term once.
- No "simply", "just", "easy" or "obviously"; descriptive link text, never "click here"; alt text on every image.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Write commands from memory | Run each one and paste the real output | Untested docs fail on the first reader and lose trust for the rest |
| One giant README covering everything | README for the quickstart; a docs site split by Diátaxis | Readers cannot find the task they came for |
| Hand-maintained API reference | Generate it from doc comments and fail on warnings | Hand copies drift on the next signature change |
| Changelog written from `git log` at release time | Entries in the same PR as the change | Release-time archaeology misses breaking changes |
| Editing an accepted ADR to match new reality | Write a new ADR that supersedes it | The record of why a decision was made is the point |
| Pasting code samples into Markdown | Include from tested files or use doctests | Pasted samples rot silently |
| Screenshots of terminal output | Text blocks | Not searchable, not copyable, not accessible, and stale fast |

## Verification checklist

- [ ] Every page has one Diátaxis type and one reader goal.
- [ ] Every documented command was run; outputs are real; PowerShell variants given where they differ.
- [ ] Config tables match the source; no undocumented required settings.
- [ ] API reference builds with warnings as errors; examples are executed in CI.
- [ ] CHANGELOG `[Unreleased]` covers every user-visible change; SemVer bump matches.
- [ ] Link check, Markdown lint and the strict docs build pass in CI.
- [ ] Docs changed in the same PR as the behaviour they describe.

## Related

- Agents: `doc-updater` (bulk doc sync from a diff), `codebase-explorer` (find config keys, flags and entrypoints).
- Workflows: `/update-docs`, `/codebase-onboard`, `/pr-ready`.
- Knowledge: `api-design`, `copywriting`, `git-workflow`, `software-architecture`, `ci-cd-github-actions`.
