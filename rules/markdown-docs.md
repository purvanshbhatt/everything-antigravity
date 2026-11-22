---
trigger: glob
globs: "**/*.md, **/*.mdx"
description: Markdown and MDX documentation conventions
---

# Markdown documentation

## Scope

- Some Markdown files are read by tools: `SKILL.md`, agent files, rules, `AGENTS.md`, `GEMINI.md`, changelogs and docs-site pages. Keep their front matter keys, types and required sections exactly as the tool expects, and validate after editing.

## Structure

- One `#` heading per file, as the title. Use heading levels in order without skipping (`##` then `###`).
- Start with what the reader gets and who it is for in one or two sentences. Put prerequisites before steps.
- Use numbered lists for sequential steps (one action per step) and bullets for unordered items.
- Keep sections short and scannable. Prefer tables for comparisons and reference data; keep table cells brief.
- Match the document type: a tutorial teaches, a how-to solves one task, a reference lists facts, an explanation gives reasons. Do not mix them in one page.

## Writing style

- Plain language, active voice, second person ("Run the command"), present tense.
- One term per concept, used consistently. Define acronyms on first use.
- Be specific: exact commands, file paths, versions, defaults and limits. No vague claims ("blazing fast", "simply", "just").
- Write for skimmers: the first sentence of each section carries the point.

## Code and commands

- Fence every code block with a language tag (`bash`, `powershell`, `json`, `ts`, `text`).
- Show commands without prompt characters so they copy cleanly; show expected output in a separate `text` block.
- Commands and samples must be correct for the current version. Run them where safe, or mark them as untested.
- Use obvious placeholders (`<project-id>`, `YOUR_API_KEY`) and never real secrets, tokens, internal hostnames or personal data.
- Note platform differences (macOS/Linux vs Windows) when commands differ.

## Links and media

- Use descriptive link text, never "click here". Prefer relative links within the repository so they survive forks and renames.
- Check links after moving or renaming files (`lychee`, `markdown-link-check` or the docs build).
- Every image has meaningful alt text; decorative images use empty alt text. Keep images small and stored next to the docs.

## Formatting

- Follow the project's linter (`markdownlint`, Prettier) and its configuration. One blank line around headings, lists and code blocks.
- Do not hard-wrap prose unless the project does; never wrap inside links or code spans.
- Use admonitions or blockquotes (`> **Note:**`) sparingly, for warnings that prevent mistakes.

## MDX

- Keep MDX components to those the docs site provides; import them at the top of the file.
- Escape `{`, `}` and `<` in prose, or put them in code spans, so MDX does not parse them as JSX.
- Keep front matter valid YAML with the keys the docs framework expects (`title`, `description`, `sidebar_position`).

## Maintenance

- Update docs in the same change as the behaviour they describe, including the changelog when the project keeps one.
- Remove outdated content instead of adding "deprecated" notes that never go away.
