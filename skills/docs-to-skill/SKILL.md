---
name: docs-to-skill
disable-model-invocation: true
description: >-
  Turns a documentation site, a repository's docs folder or a PDF manual into
  a new skill in the Everything Antigravity format: reads a bounded set of
  pages, extracts the API surface, core concepts and pitfalls in its own
  words, distils a 6-12 KB SKILL.md with reference files and cited sources,
  then tests it with realistic prompts and the validator. Invoke with
  /docs-to-skill.
---

# Docs to Skill

Documentation explains everything; a skill keeps only what an agent would otherwise get wrong. This workflow reads a bounded slice of a product's docs, extracts the commands, defaults, limits and traps, and writes them as an original, compact skill that follows the pack's authoring guide, `docs/AUTHORING.md` (in the EAG root, two levels above this file). Every fact in the result traces back to a cited page, and every command was checked.

**Source rule.** Respect `robots.txt`, the site's terms and the docs licence. Write the skill in your own words. Quote at most a short phrase where exact wording matters (an error message, a flag name), and never paste passages or long code samples from the source. Write and run your own minimal examples instead.

## When to use

- The user says "make a skill from these docs", "teach the agent this library" or "turn this manual into a skill".
- The agent keeps getting a tool's flags, defaults or version-specific behaviour wrong.
- A new SDK, CLI or internal platform has docs but no skill in the pack.
- An existing skill is out of date after a major release of the tool it covers.

## When not to use

- The procedure comes from the team's own habits, not from external docs: `/skill-create`.
- The user needs an answer from the docs once, not a reusable skill: read the page and answer, or use `/research-synthesis`.
- A one-line rule ("always pass `--frozen-lockfile`"): add it to the project's rules or `GEMINI.md`.
- Writing human-facing documentation: `documentation-writing`.

## Workflow

1. **Scope the skill.** Agree the tool, the version, and the five to ten tasks users will actually ask for. Choose the kind: a knowledge skill (loaded when the task matches) or a workflow (a slash command with gates). Choose the destination: `skills/<name>/` in the EAG repository for contributions, `.agents/skills/<name>/` for one project, or `~/.gemini/config/skills/<name>/` for the user's global skills. Pick a kebab-case name that is not a built-in (`plan`, `learn`, `goal`, `boost`, `swarm`, `teamwork`, `grill-me`, `schedule`, `hooks`, `skills`, `plugin`, `agents`) and not an existing skill (`find_by_name` on `SKILL.md` under each destination).

   **Check:** The scope note names the version, the task list, the kind, the destination and an unused name.

2. **Check access and licence.** Read the site's `robots.txt` and terms, and note the docs licence. If the docs are in a public repository, prefer a shallow clone over crawling (`git clone --depth 1 <repo>`). For a PDF, extract text locally (`pdftotext manual.pdf manual.txt` from poppler, if installed).

   **Check:** The licence and the allowed paths are recorded, and the planned reading stays inside them.

3. **Map and bound the reading list.** Start from `sitemap.xml`, the navigation menu, or an `llms.txt` file if the site publishes one. Pick 20 to 40 pages that cover: quickstart, core concepts, the reference index for the commands or API, configuration, limits and quotas, errors and troubleshooting, migration notes, and the changelog for the chosen version. Save the list as an artifact, with one line per page saying why it matters.

   **Check:** The user approved the list, and every page is on the same docs site or repository.

4. **Read and take notes.** Fetch pages one at a time, with a pause between requests, using the browser agent or `run_command` with `curl`. For more than about 15 pages, fan out: give each subagent a batch of URLs and the note format in Patterns, and ask for notes only. Each note is a fact in your own words, tagged with its source URL and the version it applies to.

   **Check:** Every note has a source URL, and no note contains more than a short quoted phrase.

5. **Keep what changes behaviour.** Merge and dedupe the notes. For each, ask: would a strong engineer get this wrong without being told? Keep exact flags, defaults, limits, version differences, ordering requirements, security settings and the errors people hit. Drop general knowledge the model already has. Sort the survivors into workflow steps, decision tables, anti-patterns and reference detail.

   **Check:** The kept notes fit on about two pages, and each one changes what an agent would do.

6. **Write the skill to the pack's standard** with `write_to_file`. Follow the section order in `docs/AUTHORING.md`: title and purpose, When to use, When not to use, Workflow with numbered steps that each end in a `**Check:**` line, Patterns, an Anti-patterns table, a Verification checklist, and Related. Frontmatter is `name`, then `disable-model-invocation: true` for slash-only skills, then a `description` that says what and when in under 450 characters (workflows end with `Invoke with /<name>.`). Model-visible skills must keep the description under 220 characters. Move long tables and vendor matrices into `references/<topic>.md`, linked with relative paths, and list every source in `references/sources.md` with the access date and version.

   **Check:** `SKILL.md` is 6 to 12 KB, every relative link resolves, and Related names only skills and agents that exist.

7. **Verify every command and number.** For each command, flag, field and default in the skill, re-open its source page, and run `<tool> --help` or a dry run where the tool is installed. Remove anything you cannot confirm, or mark it "check the current docs" with the link.

   **Check:** Each command in the skill was confirmed against its source or a local `--help`, and nothing was invented.

8. **Validate and test.** In the EAG repository, run the validator. Elsewhere, use the skill-create checker.

   ```bash
   node bin/eag.js validate                                              # EAG repository
   node <eag-root>/skills/skill-create/scripts/check-skill.js .agents/skills/<name> --workflow
   ```

   Then give three to five realistic prompts, phrased as a user would, to a fresh subagent that has only the new skill. Compare its answers with the docs.

   **Check:** The validator reports no errors for the skill, and the subagent completed each prompt correctly using the skill.

9. **Hand over.** Give the user the path, the version covered, the sources file, and a refresh trigger (the next major release, or a date). In the EAG repository, new slash-only skills also need an entry in an `eag-*` index; tell the user which category fits, because indexes are generated by the maintainers' catalog script.

   **Check:** The user knows where the skill is, what it covers, and when to refresh it.

## Patterns

### Note format

```markdown
- [config] `retries` defaults to 3 and applies per request, not per batch. (v4.2; https://docs.example.dev/config#retries)
- [pitfall] Setting both `region` and `endpoint` makes `endpoint` win silently. (v4.x; https://docs.example.dev/endpoints)
- [limit] Upload parts must be at least 5 MiB except the last. (all versions; https://docs.example.dev/limits)
```

Tags: `[concept]`, `[command]`, `[config]`, `[limit]`, `[pitfall]`, `[security]`, `[migration]`, `[error]`.

### What goes where

| Content | Location |
| :--- | :--- |
| When to reach for the tool, the main procedure, decision tables | `SKILL.md` |
| Full flag or field tables, provider matrices, long examples | `references/<topic>.md` |
| Source URLs, access dates, version covered, licence notes | `references/sources.md` |
| Helper scripts (zero-dependency Node, or bash and PowerShell pairs) | `scripts/` |

### Test prompts

Write prompts that hit the traps the skill is meant to prevent, not the happy path. For example: "set up X with a custom endpoint in eu-west" (tests the region and endpoint pitfall), "why does my upload fail at 3 MB parts" (tests the limit), and one prompt outside the skill's scope, to check that it is not selected by mistake.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Crawl the whole site | Bound the list to 20-40 pages that serve the tasks | Breadth adds noise and load on the site |
| Copy passages or sample code | Write original prose and run your own examples | Licences and copyright; copied text also bloats the skill |
| Summarise every page equally | Keep only what changes agent behaviour | A skill is not a mirror of the docs |
| Keep flags from memory | Confirm each against a source or `--help` | Invented flags are the commonest skill defect |
| Leave out the version | State the version in the skill and the sources file | Docs change; the skill must say what it covers |
| Skip the fresh-agent test | Test with realistic prompts and compare with the docs | Authors cannot see their own gaps |

## Verification checklist

- [ ] Scope, version, destination and an unused name were agreed.
- [ ] `robots.txt`, terms and licence were checked; reading stayed in bounds.
- [ ] Every fact has a cited source; no passages or long samples were copied.
- [ ] The skill follows `docs/AUTHORING.md`, is 6 to 12 KB, and has working reference links.
- [ ] Every command, flag and default was confirmed.
- [ ] The validator passes, and a fresh subagent handled the test prompts correctly.
- [ ] The user has the path, the sources file and a refresh trigger.

## Related

- Workflows: `/skill-create`, `/research-synthesis`, `/update-docs`, `/harness-audit`.
- Knowledge: `antigravity-customization`, `documentation-writing`, `browser-automation`, `prompt-engineering`, `agent-evals`, `subagent-delegation`.
- Agents: `deep-researcher`, `technical-writer`.
