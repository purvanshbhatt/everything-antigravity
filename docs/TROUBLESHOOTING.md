# Troubleshooting

Start with:

```bash
eag doctor          # or: npx everything-antigravity doctor
```

It checks the following:

- the Node version
- the plugin installation and its version
- v1 leftovers
- duplicate skill names
- the rule budget
- a hook smoke test
- whether the state directory is writable
- the Gemini CLI extension
- `agy plugin validate`

## Skills or slash commands don't show up

1. Run `eag doctor`. If `antigravity-plugin` fails, run `eag install`.
2. Open **Customizations** in Antigravity and make sure **Everything Antigravity** is enabled. A disabled plugin still appears in the list.
3. Look for name collisions. Workspace (`.agents/skills`) and global loose skills (`~/.gemini/config/skills`) take precedence over plugin skills, and two plugins with the same name collide silently. `eag doctor` reports loose duplicates.
4. Upgrading from v1: `eag install` removes the old v1 symlinks. If you created copies by hand, delete them.

## The plugin is installed but the agent never uses its skills

Antigravity has a shared 20,000-token budget for every plugin's model-visible
skills, subagents and MCP tools. Past that, it quietly drops the most expensive
skills from what the agent sees. Plugins with many long skill descriptions use
it up fast. Check the live numbers:

```bash
eag budget
```

It lists each plugin's cost and how many of its skills are being dropped. To
recover room, disable plugins you don't use on the **Customizations** page.
EAG itself keeps its footprint under about 5,000 tokens: most of its skills
are slash-only and the agent reaches them through the small `eag-*` index skills.

You can always run any EAG skill directly by typing `/` and its name, for
example `/kubernetes-gke` or `/feature-dev`. If you don't know the name, run
`/skill-finder` and describe the job.

## Antigravity keeps reloading and stops the agent mid-task

The window reloads when Antigravity's language server exits and is
restarted. `main.log` then shows `Language server crashed: exited with code 2`
followed by `[Auto-Restart] Port changed! Reloading all windows`. The log is in
`%APPDATA%\Antigravity\logs` on Windows and `~/Library/Application Support/Antigravity/logs` on macOS.

1. Run `eag budget`. If the total is far over budget, disable plugins you don't
   use. Fewer customizations mean less work every time Antigravity rescans plugins.
2. The crash reason is written to `language_server.log` in the same folder, but
   that file is replaced each time the server restarts. Copy it straight after a
   reload, before the next crash, and include it in a bug report to the
   Antigravity team.
3. If the reloads started right after a plugin was installed or updated, disable
   that plugin on the **Customizations** page and see whether they stop.

## A command was blocked or asked for confirmation unexpectedly

The guard denies only catastrophic commands. Everything else in the rule list asks first. To see what the guard decides:

```bash
eag shield --cmd "git push --force origin main"
```

Change strictness with `eag profile set minimal|standard|strict`, or turn off one feature:

```bash
# PowerShell
$env:EAG_DISABLED_HOOKS = "secrets"
# bash
export EAG_DISABLED_HOOKS=secrets
```

If a rule is wrong, please open an issue with the command. Rules are tested for false positives.

## The agent keeps getting told to run tests

The verify gate fires at most once per turn, and only after code files changed with no passing test, type-check, lint or build since. To turn it off:

```bash
eag profile set minimal
```

Or set `"verifyGate": false` in `~/.gemini/eag/config.json`.

## Hooks seem to do nothing

- Hooks need `node` on the `PATH` that Antigravity uses. Run `node --version` in the same environment.
- Errors are logged to `~/.gemini/eag/logs/hooks.log`.
- Run `eag doctor` and check `hooks-smoke`.

## Gemini CLI

- Install with `eag install --target gemini` or `gemini extensions install <repo-url>`.
- Gemini CLI hooks have no "ask" decision, so risky commands produce a warning instead of a prompt. This is expected.

## Context is getting long

Use `/checkpoint` at a milestone, then start a fresh conversation. The next session starts with the saved summary. For noisy logs:

```bash
eag compact --file build.log
```
