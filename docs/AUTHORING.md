# Authoring Guide: Skills, Agents and Rules

This is the quality bar for everything shipped in Everything Antigravity (EAG).
`npm run validate` enforces the mechanical parts. Reviewers enforce the rest.

EAG targets **Google Antigravity** first (App, IDE and the `agy` CLI) and
**Gemini CLI** second. Both read the same `SKILL.md` format.

---

## 1. Skills

### Layout

```text
skills/<name>/
├── SKILL.md          # required, 4-12 KB, the procedure
├── references/*.md   # optional, bulky detail the agent reads on demand
└── scripts/*         # optional, zero-dependency helpers (Node or bash+PowerShell pairs)
```

### Frontmatter (exactly these two keys)

```markdown
---
name: code-review
description: >-
  Reviews a diff, branch or set of files for correctness, security and
  maintainability bugs and returns ranked findings with concrete patches. Use
  when the user asks for a review, before opening a PR, or after a large edit.
  Invoke with /code-review.
---
```

- `name` is kebab-case, identical to the directory name, and must not collide
  with Antigravity built-in commands: `plan`, `learn`, `goal`, `boost`, `swarm`,
  `teamwork`, `grill-me`, `schedule`, `hooks`, `skills`, `plugin`, `agents`.
- `description` is what the router reads to decide whether to load the skill.
  Write it in the third person, cover **what** and **when** (with the phrases
  users actually type), and keep it under 450 characters. Workflow skills end
  with `Invoke with /<name>.`

### Body structure

Use these sections in this order. Omit a section only when it would be empty.

1. `# Title`, followed by a two- or three-sentence purpose statement.
2. `## When to use` and `## When not to use`, each 3-6 bullets. The second
   names the better skill or agent to use instead.
3. `## Workflow`: numbered steps. Each step is an action with concrete commands
   and ends with a `**Check:**` line that says how to confirm the step worked.
4. `## Patterns` or `## Reference`: tables, decision matrices and short, correct
   code. Prefer one excellent example to three mediocre ones.
5. `## Anti-patterns`: a `| Don't | Do instead | Why |` table.
6. `## Verification checklist`: `- [ ]` items that must hold before declaring done.
7. `## Related`: other EAG skills (`/name` for workflows, plain names for
   knowledge skills) and agents (`code-reviewer` subagent).

### Writing rules

- **Procedure over prose.** Antigravity's own guidance is "don't teach the model
  what it already knows". Spend words on the decisions, commands, thresholds
  and failure modes that a strong engineer would want written down.
- **Be concrete.** Give real commands for the ecosystems that matter, for
  example `npm|pnpm|yarn|bun`, `pytest`, `go test ./...` and `cargo test`. Show
  the PowerShell form when it differs.
- **Never invent** CLI flags, API fields or version numbers. If something moves
  fast (model names, SDK versions), say "check the current docs" and show how.
- **Use Antigravity-native mechanics:**
  - Tools: `view_file`, `grep_search`, `find_by_name`, `list_dir`, `run_command`,
    `write_to_file`, `replace_file_content`.
  - Delegate bounded investigations to a subagent ("delegate to the
    `code-reviewer` subagent with the diff and the acceptance criteria").
  - Use Antigravity artifacts (implementation plan, task list, walkthrough)
    whenever the user should review before or after work.
- **Cross-platform.** Never assume bash: the user may be on Windows PowerShell.
- **Safe by default.** Destructive steps (force push, data deletion, migrations
  on shared databases, `terraform apply`) always require explicit user
  confirmation in the procedure.
- **Progressive disclosure.** If `SKILL.md` grows past ~12 KB, move tables,
  long examples or vendor matrices into `references/` and link them with a
  relative path, e.g. `[OWASP checklist](references/owasp.md)`.
- No emojis in headings, no marketing language, no filler intros.

### The EAG runtime (`eag` CLI and hooks)

Workflow skills may rely on the EAG runtime. Always give the fallback form,
because `eag` may not be on `PATH`:

```bash
eag <command>                       # if installed globally (npm i -g everything-antigravity)
node <plugin-root>/bin/eag.js <cmd> # always works; <plugin-root> is two levels above this SKILL.md
```

| Command | Purpose |
| :--- | :--- |
| `eag status` | Version, profile, component counts, install targets |
| `eag doctor [--json]` | Health check: install, v1 leftovers, duplicates, rule budget, hook smoke test |
| `eag profile get` / `eag profile set <minimal\|standard\|strict>` | Hook behaviour profile |
| `eag sessions list [--project <dir>]` | Saved session summaries for a project (newest first) |
| `eag sessions latest [--project <dir>]` | Print the most recent session summary |
| `eag sessions save [--project <dir>] [--title <t>] < summary.md` | Save a session summary from stdin; prints the file path |
| `eag instincts list [--project <dir>] [--min <0-1>] [--json]` | Learned instincts, ranked by confidence |
| `eag instincts add --trigger "<when>" --action "<do>" [--confidence 0.5] [--scope project\|global] [--evidence "<why>"] [--project <dir>]` | Record a new instinct; prints its id |
| `eag instincts reinforce <id>` / `eag instincts weaken <id>` | Confidence +0.1 / -0.15 (clamped 0-1) |
| `eag instincts promote <id> --skill <name> [--project <dir>]` | Scaffold a skill from an instinct into `<project>/.agents/skills/<name>/` |
| `eag instincts prune [--below 0.3]` | Delete low-confidence instincts |
| `eag instincts remove <id>` | Delete one instinct |
| `eag instincts export [--out file]` / `eag instincts import <file>` | Share instincts across machines or a team (import merges and reinforces duplicates) |
| `eag compact --file <log>` / `--text "<s>"` | Strip ANSI codes and collapse repeated lines before reasoning over logs |
| `eag shield --text "<s>"` / `--file <path>` / `--cmd "<command>"` | Secret, prompt-injection and dangerous-command scan; exit 1 on findings |
| `eag mcp list` / `eag mcp show <name>` / `eag mcp add <name> [--yes]` | Bundled MCP server catalog |
| `eag validate` | Validate this repository (contributors) |

State lives in `~/.gemini/eag/` (override with `EAG_HOME`):

- `sessions/<project-key>/*.md`: session summaries. The Stop hook writes a
  short automatic summary each turn, and `/session-save` writes a rich one.
- `instincts/<project-key>.json` and `instincts/global.json`: learned
  instincts. The SessionStart hook injects up to 6 with confidence ≥ 0.7.
- `state/<conversation-id>.json`: per-conversation hook scratch state.
- `config.json`: `{ "profile": "standard", "verifyGate": true, "autoFormat": false }`.

The hooks do the following:

- **SessionStart:** injects the last session summary, top instincts and stack hints.
- **PreToolUse:** blocks catastrophic commands, asks before risky ones, blocks
  real-looking keys written into source files (`.env` files are allowed) and asks
  on low-confidence secret matches.
- **PostToolUse:** tracks edited files and verification commands.
- **PreInvocation:** one-time strategic-compaction nudges on long sessions.
- **Stop:** saves a session summary and, once per turn, asks the agent to run
  verification if it edited code without testing it.

---

## 2. Agents (`agents/<name>.md`)

```markdown
---
name: code-reviewer
description: >-
  Adversarial senior code reviewer. Delegate to it with a diff or file list
  and acceptance criteria; it returns ranked findings with exact patches.
  Read-only: it never edits files.
tools:
  - view_file
  - grep_search
  - find_by_name
  - list_dir
  - run_command
mainAgent: false
subagent: true
model: inherit
---

# Code Reviewer
...system prompt...
```

- **Tools.** Use only these verified native names:
  - Read-only: `view_file`, `grep_search`, `find_by_name`, `list_dir`.
  - Commands: `run_command`.
  - Writes: `write_to_file`, `replace_file_content`.

  A misspelled tool name can hang a subagent. Give an agent the fewest tools its
  job needs; reviewers and auditors get no write tools.
- **`model`:** `inherit` (default), `flash` (fast scans and exploration) or
  `pro` (deep reasoning: architecture, security).
- **`mainAgent`:** `true` only for agents a user would start a whole session
  with (`agy --agent <name>`), such as `chief-of-staff`.
- **Body.** In order:
  1. Mission (2-3 sentences).
  2. Inputs it expects from the delegating agent.
  3. Operating procedure (numbered).
  4. Output contract: an exact format, because the parent agent parses it.
  5. Hard constraints (what it must never do).
  6. Escalation (when to stop and report instead of guessing).
- **Size:** 2.5-6 KB.
- **Names:** must not collide with built-ins (`self`, `browser`, `research`,
  `deepagent`, `review-agent`).

---

## 3. Rules (`rules/*.md`)

- `rules/AGENTS.md` is always on and has no frontmatter. Keep it under 6 KB,
  because it is charged against the shared 20k-token rules budget every turn.
- Every other rule needs frontmatter:

  ```markdown
  ---
  trigger: glob
  globs: "**/*.ts, **/*.tsx"
  description: TypeScript conventions
  ---
  ```

  - `trigger` is one of `always_on`, `glob`, `model_decision` or `manual`.
  - `globs` is one comma-separated string, never a YAML list.
  - `model_decision` rules need a `description` that says when they apply.
- Each rule file stays under 4 KB (the hard limit is 24 KB). Rules state
  constraints; skills hold procedures. If a rule needs a code example longer
  than 10 lines, it belongs in a skill.
