# Plugins, JSON configs and MCP entries

Paraphrased from Antigravity's built-in `agy-customizations` and `plugin`
guides (November 2026). Re-check with `agy plugin validate --strict --json`,
which reports what the loader actually accepts.

## Plugin layout

```text
<root>/plugins/<dir>/
├── plugin.json        # required marker and manifest
├── README.md          # for humans; the agent never reads it
├── hooks.json         # must be here, at the plugin root
├── mcp_config.json
├── assets/logo.svg
├── skills/<skill>/SKILL.md
├── agents/<agent>.md
└── rules/AGENTS.md    # plain markdown, always on while the plugin is enabled
```

Create only the folders you use. A plugin meant for publication lives in its
source repository; a personal one can live in `~/.gemini/config/plugins/<dir>/`.

## `plugin.json` fields

| Field | Type | Notes |
| :--- | :--- | :--- |
| `name` | string | Global unique key, kebab-case; defaults to the directory name. Duplicate names: first discovered wins, the other is silently dropped |
| `displayName` | string | Title in cards, headers and slash menus |
| `description` | string | One or two sentences; Marketplace search matches it |
| `version` | string | Semantic version |
| `author` | string or `{ "name", "url" }` | `url` must be `https://` |
| `homepage` | string | `https://` URL |
| `repository` | string or `{ "type": "git", "url" }` | `https://` URL |
| `logo` | string | Relative path ending `.png`, `.svg`, `.jpg`, `.jpeg` or `.webp`; URLs and absolute paths are silently rejected |
| `suggestedPrompts` | string[] | Up to 3 (exactly 3 suits the card layout); extras ignored |
| `disabled` | boolean | Ship turned off; the user's own choice wins |

Any other top-level field is discarded without an error. The file is parsed
as JSONC, so comments and trailing commas are allowed.

```json
{
  "name": "acme-dev-kit",
  "displayName": "Acme Dev Kit",
  "description": "Acme service conventions, a deploy runbook and the acme-tickets MCP server.",
  "version": "1.2.0",
  "author": { "name": "Acme Platform Team", "url": "https://example.com" },
  "logo": "assets/logo.svg",
  "suggestedPrompts": ["Open a ticket for this bug", "Deploy the API to staging", "Explain our retry policy"]
}
```

## Enable state

Whether a plugin is on is stored in `~/.gemini/config/config.json` under
`plugins.<dir>.enabled`, keyed by the install directory, not `name`. It wins
over `disabled` in the manifest and survives reinstalls. Change it from the
Customizations UI or with the CLI's plugin `enable` / `disable` subcommands;
never edit the file by hand. A disabled plugin stays listed but loads nothing.

Moving an MCP entry from the user's `mcp_config.json` into a plugin ties the
server to the plugin's on/off switch: tell the user before you move it.

## `skills.json` and `plugins.json`

Place them in a customization root (`.agents/` or `~/.gemini/config/`) to load
items from non-standard locations.

```json
{
  "inherits": [{ "path": "~/team/agents/skills.json", "exclude": ["experimental-.*"] }],
  "entries": [{ "path": "tools/agents/skills", "include_only": ["deploy-runbook"] }]
}
```

- Each entry directory is scanned one level deep.
- `/...` is absolute, `~/...` is home-relative, anything else is relative to
  the repository root.
- Every `.agents/` between the working directory and the project root is
  honoured, so a repo-root config applies from any subdirectory.
- Committing `.agents/skills.json` that points at a shared folder is the
  simplest way to give a whole team the same skills.

## `mcp_config.json`

```json
{
  "mcpServers": {
    "acme-tickets": {
      "command": "node",
      "args": ["C:/tools/acme-tickets/build/index.js"],
      "env": { "ACME_TOKEN_FILE": "C:/Users/me/.acme/token" }
    },
    "acme-search": { "url": "https://mcp.example.com/mcp" }
  }
}
```

- Stdio: `command` (required), `args`, `env`. Remote: `url` for Streamable
  HTTP (`serverUrl` is the accepted legacy key).
- Legacy HTTP+SSE (spec 2024-11-05) is not supported. Point `url` at the
  Streamable HTTP endpoint (usually `/mcp`), or run a stdio bridge such as
  `mcp-remote` for SSE-only servers.
- Server names collide globally across the user config and all plugins:
  prefix them (`acme-tickets`, not `tickets`).
- On Windows, prefer `node` plus an absolute script path over `npx`, which is
  a `.cmd` shim that some spawners cannot start directly.
- A plugin that declares `variables` (values the user must supply) starts
  disabled until they are filled in; say so in the plugin README.
- Plugin MCP servers also receive `PLUGIN_ROOT` and `PLUGIN_DATA`.
- Inspect connected servers and their tools under
  **Additional Options (...) > MCP Servers**.
