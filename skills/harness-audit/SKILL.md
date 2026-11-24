---
name: harness-audit
disable-model-invocation: true
description: >-
  Audits the user's Antigravity setup and scores it: installed plugins, colliding
  skill, agent and MCP names, always-on rules versus the 20k-token budget, EAG
  hook health, MCP server and tool bloat, v1 EAG leftovers, and missing project
  rules. Outputs a scored report with prioritized fixes and changes nothing
  without consent. Use when the agent feels slow, confused or misrouted, or
  after installing plugins. Invoke with /harness-audit.
---

# Harness Audit

The agent is only as sharp as its harness. Every always-on rule, every enabled
MCP tool and every duplicate skill name costs context or confuses routing. This
audit measures those costs, scores the setup out of 100, and proposes the
smallest set of changes that recovers the most quality. It is read-only until
the user approves a specific fix.

## When to use

- The user says "audit my setup", "why is the agent slow or confused", "check my harness".
- After installing or upgrading plugins, including EAG itself (especially from v1).
- A slash command runs the wrong skill, or two skills seem to answer the same request.
- Responses degrade early in conversations (a sign of a heavy always-on context).

## When not to use

- Reviewing learned instincts: use `/instincts`.
- Security of the user's application code: use `/security-scan`.
- Writing a new skill or rule: use `/skill-create`.
- Debugging a single broken hook or MCP server in depth: start here for the finding, then follow the `mcp-server-development` or `antigravity-customization` knowledge skill.

## Workflow

Commands use `eag`. If it is not on `PATH`, run `node <plugin-root>/bin/eag.js <command>`
instead, where `<plugin-root>` is two levels above this SKILL.md. Every step is read-only.

1. **Inventory the harness.**

   ```bash
   agy plugin list --json
   agy agents
   agy mcp list
   eag status
   eag doctor --json
   ```

   Also list skill directories with `list_dir`: `~/.gemini/config/skills/`, the workspace `.agents/skills/`, and each installed plugin's `skills/` (paths from the plugin list). If `agy` is missing, note it and continue with the filesystem view.

   **Check:** You have counts of plugins, skills (by source), agents and MCP servers.

2. **Find name collisions.** Build one table of `name | kind | source`. Flag:
   - Skills named like Antigravity built-ins: `plan`, `learn`, `goal`, `boost`, `swarm`, `teamwork`, `grill-me`, `schedule`, `hooks`, `skills`, `plugin`, `agents`.
   - Agents named like built-in agents: `self`, `browser`, `research`, `deepagent`, `review-agent`.
   - The same skill or agent name from two sources (plugin and global copy, two plugins).
   - The same MCP server configured twice under different names, or two servers exposing the same tools.

   **Check:** Every name appears once, or is listed as a finding with both sources.

3. **Measure the rules budget.** Always-on rules share about 20k tokens; estimate tokens as bytes divided by 4. Candidates: `AGENTS.md` and `GEMINI.md` at the repository root, `~/.gemini/GEMINI.md`, rule files under the workspace agent directory (find them with `find_by_name` for `*.md` under `.agents/` or `.agent/` folders named `rules`), and each plugin's `rules/`. A rule is always-on if it has no frontmatter or has `trigger: always_on`.

   ```bash
   for f in AGENTS.md GEMINI.md ~/.gemini/GEMINI.md ~/.gemini/config/plugins/*/rules/*.md; do [ -f "$f" ] && printf '%8d  %s\n' "$(wc -c < "$f")" "$f"; done
   ```

   ```powershell
   @('AGENTS.md','GEMINI.md',"$HOME\.gemini\GEMINI.md") + (Get-ChildItem "$HOME\.gemini\config\plugins\*\rules\*.md" -ErrorAction SilentlyContinue).FullName |
     Where-Object { $_ -and (Test-Path $_) } | ForEach-Object { '{0,8}  {1}' -f (Get-Item $_).Length, $_ }
   ```

   **Check:** You have the always-on total in estimated tokens, the share of 20k, and any file over 24 KB (hard limit) or over 4 KB (EAG guideline).

4. **Check hook health.** From `eag doctor --json`: install state, hook smoke test, duplicate detection, rule budget. Also run `eag profile get`. A failing smoke test means session summaries, instincts and safety blocks are silently off.

   **Check:** Each hook (SessionStart, PreToolUse, PostToolUse, PreInvocation, Stop) is reported working or has a finding.

5. **Check MCP hygiene.** From `agy mcp list` and a read-only `view_file` of `~/.gemini/config/mcp_config.json`: count servers and enabled tools; find servers nothing in this project uses (no matching stack, never mentioned in rules or skills; ask the user when unsure); and look for credentials written inline instead of read from environment variables.

   ```bash
   eag shield --file ~/.gemini/config/mcp_config.json
   ```

   Exit 1 means plaintext secrets: report the server name and the key name, never the value.

   **Check:** You have total tool count, a list of probably-unused servers, and the secrets result.

6. **Look for v1 EAG leftovers.** `eag doctor` reports most of them. Also look for: a `commands/` directory from EAG v1 with `boost.md`, `learn.md`, `plan.md`, `audit.md`, `checkpoint.md` or `review.md` (the first three shadow built-ins); references to the removed v1 Python CLI (`python src/cli.py ...`); old skill copies in `~/.gemini/config/skills/` that duplicate the installed v2 plugin.

   **Check:** Each leftover has a path and a proposed action (remove, rename, or keep with reason).

7. **Check project rules.** Does the repository have `AGENTS.md` or `GEMINI.md`? Does it state the build, test and lint commands, the layout, and the conventions an agent cannot infer? For local plugins under development, run `agy plugin validate <dir> --strict --json`.

   **Check:** You know whether project rules exist, their size, and what is missing.

8. **Score and report.** Apply the rubric in [scoring and report template](references/scoring.md), produce the report, and order fixes by points recovered per minute of effort.

   **Check:** The total equals the sum of category scores, and every deduction cites a finding.

9. **Apply fixes only with consent.** For each fix the user approves, show the exact change first. Never hand-edit `~/.gemini/config/config.json`. Back up `mcp_config.json` before an approved edit (copy it next to itself with a date suffix). Use the plugin manager (`/plugin`, or the `agy plugin` subcommand shown by `agy plugin --help`) to disable or remove plugins. Re-run `eag doctor` and the relevant step afterwards.

   **Check:** Each applied fix was approved individually, and the re-run shows the finding resolved.

## Reference

### Thresholds

| Measure | OK | Warn | Fail |
| :--- | :--- | :--- | :--- |
| Always-on rules (estimated tokens) | under 8k | 8k-14k | over 14k, or any file over 24 KB |
| Single rule file | under 4 KB | 4-12 KB | over 12 KB |
| Enabled MCP tools (EAG heuristic) | under 40 | 40-80 | over 80 |
| MCP servers unused by this project | 0 | 1-2 | 3 or more |
| Name collisions with built-ins | 0 | - | 1 or more |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| "Fix" findings while auditing | Report first, apply each fix after approval | Config changes affect every project and every session |
| Edit `config.json` by hand | Use the Antigravity UI, `/plugin` or `agy` commands | Hand edits can break Antigravity's own settings |
| Print secret values found in `mcp_config.json` | Report server and key names only | The report may be pasted into chats or issues |
| Disable MCP servers because they look unused | Ask; some are used by other projects | Global config is shared across all workspaces |
| Report raw byte counts | Convert to estimated tokens and share of 20k | Users act on budget percentages, not bytes |
| List 30 findings unsorted | Rank by points recovered per minute | The top three fixes usually recover most of the score |

## Verification checklist

- [ ] Inventory covers plugins, skills by source, agents, MCP servers and hooks.
- [ ] Collisions were checked against both built-in lists and across sources.
- [ ] Always-on rules total is in estimated tokens with its share of 20k.
- [ ] `eag doctor` ran, and its failures are findings.
- [ ] No secret value appears in the report.
- [ ] The score adds up, and fixes are prioritized with effort estimates.
- [ ] Nothing was changed without per-fix consent.

## Related

- Workflows: `/instincts`, `/skill-create`, `/security-scan`, `/checkpoint`.
- Knowledge: `antigravity-customization`, `mcp-server-development`, `context-compaction`, `llm-cost-routing`, `agent-shield`, `credential-sanitizer`.
- Agents: `security-guard` (when the MCP or hook review turns up secrets or risky permissions).
