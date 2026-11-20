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
