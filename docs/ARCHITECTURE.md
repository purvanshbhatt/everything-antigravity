# Architecture

## One repository, three surfaces

```text
everything-antigravity/            ← repo root = Antigravity plugin root = Gemini CLI extension root
├── plugin.json                    Antigravity manifest (allowed fields only; unknown ones are dropped)
├── hooks.json                     Antigravity lifecycle hooks
├── gemini-extension.json          Gemini CLI manifest (contextFileName → rules/AGENTS.md)
├── hooks/hooks.json               Gemini CLI hooks (same scripts, --harness gemini)
├── skills/<name>/SKILL.md         79 skills; workflows end their description with "Invoke with /<name>."
├── agents/<name>.md               23 subagents (Antigravity frontmatter)
├── rules/AGENTS.md + rules/*.md   always-on core + glob / model_decision rules
├── scripts/hooks/run.js           single hook entry point (all events, both harnesses)
├── scripts/lib/*.js               shield, state, sessions, instincts, config, install, doctor, validate
├── bin/eag.js                     CLI (zero dependencies)
└── mcp-configs/catalog.json       opt-in MCP servers (never auto-enabled)
```

`eag install` does not install the raw repository. It copies a clean bundle (`plugin.json`, `hooks.json`, skills, agents, rules, `scripts/hooks`, `scripts/lib`, `bin/eag.js`, assets, MCP catalog) into `~/.gemini/config/plugins/everything-antigravity/`, so Antigravity sees no stray files (tests, Python, Gemini-only manifests) and the plugin validates cleanly. The Gemini target gets its own bundle in `~/.gemini/extensions/everything-antigravity/` without agents.

## Hook contract (verified)

Everything below was verified empirically on 2026-11-19 by running a real `agy` agent against probe hooks. Where it contradicts intuition, the code follows the observed behaviour.

| Observation | Consequence in EAG |
| :--- | :--- |
| A `PreToolUse` hook that prints **nothing** and exits 0 means "no opinion"; normal permissions apply | The guard prints nothing for safe tool calls |
| A `PreToolUse` hook that prints **`{}`** **denies** the tool | Never print `{}` from pre-tool; covered by a test |
| A non-zero exit makes the tool call **fail** (the error surfaces to the agent) | `run.js` catches everything and always exits 0 |
| `decision: "ask"` follows the user's permission preset (auto-approved in Turbo); `force_ask` always prompts | Risky commands use `force_ask` |
| `SessionStart` `injectSteps[].systemMessage.systemMessage` reaches the model | Memory and instincts are injected this way |
| CLI tool names in payloads: `run_command` (`args.CommandLine`), `write_file` (`args.Path`, `args.Content`), `read_file`; the IDE and docs also use `write_to_file`, `replace_file_content` | Matchers cover both vocabularies; arguments are scanned generically |
| Hooks run with the folder that contains `hooks.json` as the working directory | Commands use plugin-relative paths (`node scripts/hooks/run.js …`) |
| Payload carries `conversationId`, `workspacePaths`, `transcriptPath`, `artifactDirectoryPath`, `lastUserInput`, `hookEventName`, `cwd`; `Stop` adds `terminationReason`, `continuationActive` | State is keyed by conversation; the verify gate checks `continuationActive` to avoid loops |
| Agent `model` must be `inherit`, `flash` or `pro`; other values make the loader skip the agent | The validator enforces it |
| Unknown agent tool names are not flagged by `agy plugin validate`, but can hang a subagent | The validator allows only the 7 verified tool names |

Gemini CLI differences (from the Gemini CLI hooks reference): snake_case payloads (`tool_name`, `tool_input`, `session_id`), events `BeforeTool` / `AfterTool` / `AfterAgent` / `SessionEnd`, `decision` limited to `allow` / `deny`, context injected via `hookSpecificOutput.additionalContext`. `scripts/lib/harness.js` normalizes both.

## Data flow

```text
PostToolUse ──► state/<conversation>.json   edits[], commands[], lastCodeEditSeq, lastVerifyOkSeq
Stop ─────────► sessions/<project>/auto-<conv>.md       (every turn, overwritten)
              └► verify gate: unverified code edits && !continuationActive && not already nudged
/session-save ► sessions/<project>/<timestamp>-<slug>.md
SessionStart ◄─ newest session summary + instincts (≥ 0.7, max 6) + detected stack commands
/instinct-capture ► instincts/<project>.json | instincts/global.json
```

All state lives under `~/.gemini/eag/` (`EAG_HOME`). It is shared by Antigravity and Gemini CLI and survives uninstall unless `--purge` is passed.

## Profiles

`scripts/lib/config.js` resolves the effective feature set: profile defaults (`minimal` | `standard` | `strict`), then `~/.gemini/eag/config.json`, then `EAG_HOOK_PROFILE` and `EAG_DISABLED_HOOKS`. Hooks read the config on every call, so changes need no reinstall.

## Design rules

- **Fail open, never block on our own bugs.** A broken hook must not break the user's agent. Errors go to `~/.gemini/eag/logs/hooks.log`.
- **Ask, don't silently block,** except for catastrophic commands that have no legitimate use from an agent.
- **Pay for context only when it is used.** Skills are progressively disclosed. Rules are glob-scoped or model-decided. The always-on core stays around 1k tokens.
- **Least privilege for agents.** Reviewers and auditors cannot write.
- **Exact uninstall.** Every path the installer creates is recorded in `install-state.json`.
