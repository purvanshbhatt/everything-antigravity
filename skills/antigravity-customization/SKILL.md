---
name: antigravity-customization
description: >-
  Writes Antigravity skills, rules, workflows, subagents, hooks, MCP config and plugins that load correctly and fit the context budget.
---

# Antigravity Customization

Antigravity fails quietly. Unknown `plugin.json` fields are dropped, a plugin
name collision drops one plugin, an over-budget rule turns into a file
pointer, and a PreToolUse hook that prints `{}` blocks every tool call. This
skill gives the exact format for each customization type and a check that
proves it loaded.

## When to use

- Creating a skill, agent, rule, plugin, hook or MCP entry for Antigravity (App, IDE or the `agy` CLI).
- "My skill never triggers", "the plugin doesn't show up", "the hook does nothing", "MCP tools are missing".
- Packaging customizations for a team or for publication.

## When not to use

- Building the MCP server itself: `mcp-server-development`.
- Agents driven from Python code: `antigravity-sdk-orchestrator`.
- Deciding what a new skill should teach: `/skill-create`. Auditing a whole setup: `/harness-audit`.
- The security policy a guard hook enforces: `agent-shield`, `sandbox-isolation`.

## Workflow

1. **Pick the type and the root.**

   | Type | Location | Loaded |
   | :--- | :--- | :--- |
   | Rules | `AGENTS.md` / `GEMINI.md` in any directory, `.agents/rules/*.md`, plugin `rules/` | Always-on or by trigger |
   | Skills | `<root>/skills/<name>/SKILL.md` | Name and description always; body on demand |
   | Agents | plugin `agents/<name>.md` | When delegated to, or `agy --agent <name>` |
   | Plugins | `<root>/plugins/<dir>/plugin.json` | As one unit, when enabled |
   | Hooks | `<root>/hooks.json`, or `hooks.json` at a plugin root | On lifecycle events |
   | MCP servers | `~/.gemini/config/mcp_config.json`, or plugin `mcp_config.json` | Tools injected into the session |

   Roots: the workspace `.agents/` (also `.agent/`, `_agents/`, `_agent/`), found by walking from the working directory up to the repository root, and the global `~/.gemini/config/`. Precedence, highest first: workspace discovery; entries declared in workspace `skills.json` / `plugins.json`; global discovery; built-ins; entries declared in global JSON configs. On a name clash the higher slot wins.

   **Check:** you can name the directory and precedence slot the item will load from, and nothing with the same name sits in a higher slot.

2. **Write skills.** Frontmatter has `name` (kebab-case, equal to the directory) and `description` (third person, says what and when, with the phrases users type). Only those two fields reach the model until the skill is activated, so the description decides whether it ever runs. Put bulky material in `references/` and helpers in `scripts/`, linked with relative paths. Avoid names of built-in commands: `plan`, `learn`, `goal`, `boost`, `swarm`, `teamwork`, `grill-me`, `schedule`, `hooks`, `skills`, `plugin`, `agents`.

   **Check:** in a fresh session, "which skills cover X?" names it, and a prompt using the description's trigger phrases activates it.

3. **Write agents.**

   ```markdown
   ---
   name: codebase-explorer
   description: >-
     Read-only explorer. Delegate a question about where code lives; it returns
     file:line evidence and never edits.
   tools:
     - view_file
     - grep_search
     - find_by_name
     - list_dir
   mainAgent: false
   subagent: true
   model: flash
   ---
   ```

   Use only verified tool names (`view_file`, `grep_search`, `find_by_name`, `list_dir`, `run_command`, `write_to_file`, `replace_file_content`); a misspelled name can hang the subagent. `model` is `inherit` (default), `flash` (fast scans) or `pro` (deep reasoning). Set `mainAgent: true` only for agents a user starts a session with. Avoid built-in agent names: `self`, `browser`, `research`, `deepagent`, `review-agent`.

   **Check:** delegating a trivial task to the agent succeeds and it uses only its listed tools.

4. **Write rules within budget.** `AGENTS.md` and `GEMINI.md` take no frontmatter and are always on for their directory subtree. Other rule files need frontmatter: `trigger` is `always_on`, `glob`, `model_decision` or `manual`; `globs` is one comma-separated string (`"**/*.ts, **/*.tsx"`), never a YAML list; `model_decision` rules need a `description` saying when they apply. Each file is capped at 24,000 bytes (after `@[label](path)` includes) and truncated at a line boundary. Always-on and global rules share a 20,000-token budget; overflow is demoted to path pointers the agent may never open. Rules are deduplicated by resolved path.

   **Check:** `eag doctor` reports the rule budget; in PowerShell, `Get-ChildItem rules -File | Select-Object Name, Length` shows every file under 4 KB (6 KB for `AGENTS.md`).

5. **Package a plugin.** `plugin.json` (parsed as JSONC) accepts only `name`, `displayName`, `description`, `version`, `author`, `homepage`, `repository`, `logo`, `suggestedPrompts` (up to 3) and `disabled`; any other top-level field is silently discarded. `name` is a global key: when two plugins share it, the first discovered wins and the other is dropped without an error. The install directory, not `name`, identifies the plugin. A native plugin must keep `hooks.json` at its root (only `agy plugin install` restages `hooks/hooks.json` for imported Gemini CLI extensions). Prefer one `rules/AGENTS.md`. Field details: [references/plugins-and-mcp.md](references/plugins-and-mcp.md).

   ```bash
   agy plugin validate ./my-plugin --strict --json
   agy plugin validate https://github.com/<org>/<repo> --strict
   agy plugin install ./my-plugin
   ```

   **Check:** validation passes in strict mode, and the plugin's page in Customizations lists every skill, agent, rule, hook and MCP server you expect.

6. **Wire MCP servers.** Stdio entries take `command`, `args`, `env`; remote entries take `url` (Streamable HTTP; legacy `serverUrl` also accepted). Legacy HTTP+SSE servers are unsupported: bridge them with a stdio wrapper such as `mcp-remote`. Server names are global across the user config and every plugin, so prefix them with the plugin name. A plugin's servers live and die with the plugin, and a plugin that declares `variables` for the user to fill in starts disabled until they do. Pass secrets through `env`, never `args`.

   **Check:** **Additional Options (...) > MCP Servers** shows the server connected with the expected tools.

7. **Write hooks against verified behaviour.** Each top-level key in `hooks.json` is a named hook holding events. `PreToolUse` and `PostToolUse` take groups of `{ "matcher": "<regex>", "hooks": [handlers] }`; `SessionStart`, `PreInvocation`, `PostInvocation` and `Stop` take a flat list of handlers. A handler is `{ "type": "command", "command": "...", "timeout": 30 }`. The hook receives JSON on stdin and answers with JSON on stdout. Contract, examples and smoke tests: [references/hooks.md](references/hooks.md).

   **Check:** pipe a captured payload into the script (`Get-Content sample.json -Raw | node hooks/guard.js` in PowerShell, `node hooks/guard.js < sample.json` in bash), then trigger the real tool in `agy`.

8. **Prove it end to end.** Start a fresh `agy` session in the target workspace, ask which skills, rules and MCP tools are active, and run `eag doctor`.

   **Check:** every new customization appears, and nothing that worked before has disappeared.

## Verified hook behaviour (EAG, agy, 2026-11-19)

| Situation | Result |
| :--- | :--- |
| PreToolUse prints nothing and exits 0 | No opinion: normal permission flow |
| PreToolUse prints `{}` | The tool call is **denied** |
| Any hook exits non-zero | The tool call fails |
| PreToolUse `decision` | `allow`, `deny`, `ask`, `force_ask` |
| SessionStart `{"injectSteps":[{"systemMessage":{"systemMessage":"..."}}]}` | Injected |
| CLI tool names in payloads | `run_command` (`args.CommandLine`), `write_file` (`args.Path`, `args.Content`), `read_file` (`args.Path`) |
| IDE and docs tool names | `write_to_file`, `replace_file_content`, `view_file` |
| Hook process working directory | The folder containing `hooks.json` |
| Common payload fields | `conversationId`, `workspacePaths`, `transcriptPath`, `artifactDirectoryPath`, `lastUserInput`, `hookEventName`, `cwd` (the agent's directory) |

Match both naming schemes: `"matcher": "run_command|write_file|write_to_file|replace_file_content"`.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Print `{}` from PreToolUse to mean "no opinion" | Print nothing and exit 0 | `{}` denies the call |
| Let a hook script crash | Catch errors and choose fail-open (silent exit 0) or fail-closed (`deny` with a reason) on purpose | A non-zero exit fails the tool call |
| Match only `write_to_file` | Regex covering CLI and IDE names | The CLI emits `write_file` |
| Add custom fields to `plugin.json` | Allowed fields only; extra metadata in `README.md` | Unknown fields are silently dropped |
| Name an MCP server `db` or `search` | `<plugin>-db` | Global namespace collision |
| Write `globs` as a YAML list | One comma-separated string | The list form is not parsed as globs |
| Grow `AGENTS.md` into a manual | Constraints in rules, procedures in skills | Shared 20k-token budget; overflow is demoted |
| Hand-edit `~/.gemini/config/config.json` | Customizations UI or `agy plugin enable` / `disable` | It is written atomically and holds other state |
| Assume hooks run in the workspace | Paths relative to `hooks.json`, or `PLUGIN_ROOT` | Hook cwd is the `hooks.json` folder |

## Verification checklist

- [ ] Each item sits in the intended root, with no higher-precedence name clash.
- [ ] Skill and agent names are kebab-case, match their file or directory, and avoid built-in names.
- [ ] Agent `tools` use only verified names; reviewers have no write tools.
- [ ] Rule files are within size limits; `globs` are strings; `model_decision` rules have descriptions.
- [ ] `plugin.json` uses allowed fields only and `agy plugin validate --strict` passes.
- [ ] MCP server names are prefixed; secrets come from `env`.
- [ ] PreToolUse hooks print nothing for no opinion, handle both tool-name schemes, and were smoke-tested with a real payload.

## Related

- Knowledge: `mcp-server-development`, `agent-shield`, `sandbox-isolation`, `subagent-delegation`, `context-compaction`, `antigravity-sdk-orchestrator`, `documentation-writing`.
- Workflows: `/skill-create`, `/harness-audit`, `/instinct-capture`, `/update-docs`.
- Agents: `chief-of-staff`, `security-guard` (hook policy review), `doc-updater`.
