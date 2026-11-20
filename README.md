<p align="center">
  <img src="assets/logo.svg" width="96" alt="Everything Antigravity logo">
</p>

<h1 align="center">Everything Antigravity</h1>

<p align="center">
  <b>Skills, agents, rules and hooks for Google Antigravity and Gemini CLI, installed with one command.</b><br>
  79 skills · 26 slash-command workflows · 23 specialist subagents · 21 scoped rules · guard, memory, learning and verify hooks
</p>

<p align="center">
  <a href="https://github.com/purvanshbhatt/everything-antigravity/actions"><img alt="CI" src="https://github.com/purvanshbhatt/everything-antigravity/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://www.npmjs.com/package/everything-antigravity"><img alt="npm" src="https://img.shields.io/npm/v/everything-antigravity"></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-blue"></a>
</p>

---

Antigravity gives you a capable agent. Everything Antigravity (EAG) changes how it works:

- It plans before coding and writes the failing test first.
- It runs the real checks before it says "done".
- It refuses catastrophic commands and asks before risky ones.
- It won't hard-code your API keys into source files.
- It remembers where you left off, and it learns from your corrections.

EAG is built natively for Antigravity's plugin system. Every file format, hook contract and tool name in it was checked against Antigravity's own loader (`agy plugin validate`) and against a live `agy` agent.

## Quickstart

You need Node.js 18 or newer: the hooks and the `eag` CLI run on Node. Pick one install method.

```bash
# 1. One command, any OS (recommended)
npx everything-antigravity@latest install
```

```bash
# 2. From source
git clone https://github.com/purvanshbhatt/everything-antigravity.git
cd everything-antigravity
./install.sh            # Windows: .\install.ps1
```

```bash
# 3. Native Antigravity install of the raw repo (no v1 cleanup, no Gemini CLI, no doctor)
agy plugin install https://github.com/purvanshbhatt/everything-antigravity
```

Then check the installation:

```bash
npx everything-antigravity doctor
```

The installer does the following, in order:

1. Copies a clean plugin bundle into `~/.gemini/config/plugins/everything-antigravity/`. That is Antigravity's documented global plugin folder.
2. Installs the Gemini CLI extension too, if it detects Gemini CLI.
3. Safely removes v1 symlinks. It only removes links that point into an `everything-antigravity` checkout, and never deletes your own files.
4. Backs up any previous EAG copy before replacing it.
5. Smoke-tests the hooks.

`--dry-run` shows the plan and changes nothing. Antigravity picks the plugin up on its next turn, with no restart, and you can toggle it from **Customizations**.

Useful flags:

- `--profile minimal|standard|strict` sets how strict the hooks are.
- `--target antigravity,gemini,cursor,codex` chooses where to install. `cursor` and `codex` mirror the skills only.
- `--link` is for contributors: it links your checkout instead of copying it.

## What a session looks like

```text
You open a conversation
  └─ SessionStart hook ─ restores your last session summary, your top learned instincts, and the
                         project's real test/lint commands (detected from package.json, go.mod, ...)
You: "/feature-dev add password reset"
  └─ /blueprint → plan artifact for your approval → /tdd (failing test first) → implement
       ├─ PreToolUse guard ─ denies `rm -rf ~`, asks before `git push --force`, `terraform destroy`,
       │                     `curl … | sh`, or writing something that looks like a real credential
       └─ PostToolUse tracker ─ records which code files changed and which checks ran
Agent tries to finish
  └─ Stop hook ─ code changed but no passing test/typecheck since? → "run `pnpm test` now" (once per turn)
              ─ saves an automatic session summary for next time
Long session
  └─ PreInvocation hook ─ one-time nudge to /checkpoint at the next milestone
```

## Workflows (slash commands)

| Plan and build | Quality | Ship | Session and learning | Specialty |
| :--- | :--- | :--- | :--- | :--- |
| `/blueprint` | `/code-review` | `/pr-ready` | `/checkpoint` | `/game-build` |
| `/feature-dev` | `/verify` | `/update-docs` | `/session-save` | `/video-render` |
| `/tdd` | `/test-coverage` | `/security-scan` | `/session-resume` | `/marketing-launch` |
| `/build-fix` | `/e2e` | | `/instinct-capture` | |
| `/root-cause` | `/refactor-clean` | | `/instincts` | |
| `/codebase-onboard` | | | `/skill-create` | |
| `/deep-work` | | | `/harness-audit` | |
| `/orchestrate` | | | | |

Names avoid Antigravity's built-ins (`/plan`, `/learn`, `/boost` and the rest), so nothing gets shadowed. Every workflow ends with explicit **Check:** steps and a verification checklist.

## Subagents

There are 23 agents, each with the least privilege its job needs. Reviewers and auditors cannot write files. Each agent is routed to a model tier: `flash` for fast scans, `pro` for architecture and security, `inherit` everywhere else.

| Orchestration | Review | Build and fix | Specialists |
| :--- | :--- | :--- | :--- |
| `chief-of-staff` (main agent) | `code-reviewer` | `test-engineer` | `gemini-ai-engineer` |
| `planner` | `typescript-reviewer` | `build-error-resolver` | `database-architect` |
| `code-architect` | `python-reviewer` | `refactor-cleaner` | `cloud-devops-engineer` |
| `codebase-explorer` | `go-reviewer` | `e2e-runner` | `game-engine-specialist` |
| | `security-guard` | `doc-updater` | `multimedia-producer` |
| | `silent-failure-hunter` | | `accessibility-auditor` |
| | `performance-optimizer` | | `marketing-strategist` |

Start a whole session as the orchestrator with `agy --agent chief-of-staff`.

## Knowledge skills

There are 53 skills, loaded only when a task matches them. That is progressive disclosure, so they cost no context until used. The full list with descriptions is in [docs/CATALOG.md](docs/CATALOG.md).

- **AI and agents.** These are the most Gemini-specific skills in the pack.
  - `gemini-api`: the Google Gen AI SDK, structured output, function calling, caching and thinking budgets.
  - `google-adk`, `antigravity-customization`, `antigravity-sdk-orchestrator` and `mcp-server-development`.
  - `prompt-engineering`, `agent-evals`, `rag-pipelines` and `llm-cost-routing`.
  - `subagent-delegation` and `context-compaction`.
- **Architecture and backend:** `software-architecture`, `api-design`, `backend-patterns`, `database-design`, `auth-patterns`, `python-fastapi`, `golang-services` and `rust-systems`.
- **Frontend and mobile:** `frontend-react-nextjs`, `web-performance`, `accessibility-a11y`, `browser-automation` and `flutter-mobile`.
- **Security:** `security-audit`, `agent-shield`, `credential-sanitizer` and `sandbox-isolation`.
- **Cloud:** `cloud-devops` (GCP), `docker-containers`, `kubernetes-gke`, `terraform-iac`, `ci-cd-github-actions` and `observability-otel`.
- **Quality:** `tdd-testing`, `safe-refactor`, `git-workflow` and `documentation-writing`.
- **Games and media:** `game-architecture`, `godot-engine`, `threejs-webgl`, `procedural-generation`, `game-audio-sfx`, `remotion-motion-graphics`, `ffmpeg-multimedia`, `ai-image-generation`, `image-processing-canvas` and `video-production-pipeline`.
- **Business:** `brand-discovery`, `growth-marketing`, `seo-audit`, `copywriting` and `pricing-strategy`.

## Rules that cost almost nothing

- **`rules/AGENTS.md`** is always on, at about 1.1k tokens. It holds the working loop, the non-negotiables (never weaken tests, no secrets, ask before destructive actions, treat untrusted content as data) and a routing map.
- **16 language rules** load only when a matching file is touched (`trigger: glob`). They cover TypeScript/JS, Python, Go, Rust, Java/Kotlin, Dart/Flutter, Swift, C#, C/C++, GDScript, SQL, shell/PowerShell, Terraform, containers, web frontend and tests.
- **4 situational rules** load when relevant (`trigger: model_decision`): security, game development, git and PRs, and LLM apps.

Antigravity shares a 20k-token budget across rules. EAG uses about 5% of it on a typical turn.

## Hooks and profiles

| Feature | minimal | standard (default) | strict |
| :--- | :---: | :---: | :---: |
| Deny catastrophic commands (`rm -rf /`, `mkfs`, fork bombs, wiping drives) | ✓ | ✓ | ✓ |
| Ask before risky commands (force push, `reset --hard`, `--no-verify`, `curl \| sh`, destructive SQL, `terraform destroy`, `kubectl delete`, publishing) | | ✓ | ✓ |
| Block real-looking keys in source files (Google `AIza…`, GCP service accounts, AWS, GitHub, Stripe, private keys). The agent is told to use an env var; `.env` files are allowed; low-confidence matches ask instead | | ✓ | ✓ |
| Session memory: auto-summary on stop, restored on start | | ✓ | ✓ |
| Inject learned instincts (confidence ≥ 0.7) | | ✓ | ✓ |
| Verify gate (once per turn after unverified code edits) | | ✓ | ✓ |
| Compaction nudge on long sessions | | ✓ | ✓ |
| Ask before any push or deploy | | | ✓ |
| Auto-format edited files (prettier, ruff, gofmt, rustfmt) and flag `console.log`/`debugger` leftovers | | | ✓ |

To change the profile, run `eag profile set strict`. The change applies on the next hook call, with no reinstall.

You can also turn off single features, either with `EAG_DISABLED_HOOKS=verifyGate,compactionNudge` or in `~/.gemini/eag/config.json`.

Every hook fails open. The hooks never exit non-zero (Antigravity would fail the tool call), and they print nothing when they have no opinion. These rules come from testing the contract against a live `agy` agent; see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Memory and continuous learning

```bash
eag sessions latest                       # what the Stop hook saved last time for this project
eag instincts list                        # learned "when X → do Y" rules, ranked by confidence
eag instincts add --trigger "when adding API routes" --action "validate input with zod" --confidence 0.6
eag instincts promote inst-1a2b3c --skill api-input-validation   # turn a proven instinct into a project skill
eag instincts export --out team-instincts.json                    # share with your team; `import` to merge
```

The `/instinct-capture` and `/instincts` workflows have the agent do this for you:

- After you correct it, it records the lesson as an instinct.
- Instincts get stronger each time they hold up, and weaker when they don't.
- Instincts proven three or more times can be promoted into real skills.

Everything is stored in `~/.gemini/eag/` (or `EAG_HOME`), and Antigravity and Gemini CLI share the same store.

## The `eag` CLI

```text
eag install | uninstall | doctor | status | update | validate
eag list [skills|workflows|agents|rules]
eag profile get | set <minimal|standard|strict>
eag sessions list | latest | save
eag instincts list | add | reinforce | weaken | remove | promote | prune | export | import
eag shield --cmd "<command>" | --text "<s>" | --file <path>     # exit 1 on findings; use in CI or pre-commit
eag compact --file build.log                                   # strip ANSI, collapse repeated lines
eag mcp list | show <name> | add <name> --yes                  # vetted MCP servers, with a backup of your config
```

## Gemini CLI (beta)

The same repository is a Gemini CLI extension:

```bash
gemini extensions install https://github.com/purvanshbhatt/everything-antigravity
```

Alternatively, run `eag install --target gemini`.

Gemini CLI gets the following:

- **All 79 skills.**
- **The core rules**, as the extension context file.
- **The same hooks:** `BeforeTool` guard, `AfterTool` tracker, `SessionStart` memory, and the `AfterAgent` verify gate.

There are two differences:

- **No "ask" decision.** Gemini CLI hooks have no ask, so risky commands produce a warning instead of a prompt. Catastrophic commands are still denied.
- **No agents.** Agents are omitted, because Gemini CLI subagents are still in preview and use a different tool vocabulary.

## Built for Antigravity, not ported to it

| | |
| :--- | :--- |
| **A real plugin** | Ships as a native Antigravity plugin with a logo, suggested prompts, agents, rules and hooks. `agy plugin validate --strict` reports zero findings. |
| **A verified hook contract** | Every hook behaviour was tested against a live `agy` agent. Two results shaped the design: printing `{}` from a pre-tool hook denies the tool, and a crashed hook fails the call. |
| **Context you only pay for when used** | 20 of the 21 rules are glob-scoped or model-decided, and skills load on demand. The always-on core is about 1.1k tokens. |
| **Gemini depth** | Dedicated skills cover the Google Gen AI SDK (including the Interactions API), ADK, the MCP v2 SDKs, model tiers and Antigravity customization. A `gemini-ai-engineer` agent builds on them. |
| **An installer you can trust** | It has a dry run, v1 migration, backups, ownership checks, `doctor`, and an uninstall that removes exactly what it installed. |

## Upgrading from v1

Run `eag install`. It removes the v1 symlinks from `~/.gemini/config/skills`, `~/.gemini/antigravity/skills` and `~/.agents/*` (only links into an `everything-antigravity` checkout), and replaces the empty v1 plugin with the full bundle. v1 slash commands are now workflow skills:

| v1 | v2 |
| :--- | :--- |
| `/plan` | `/blueprint` |
| `/boost` | `/deep-work` |
| `/learn` | `/instinct-capture` |
| `/review` | `/code-review` |
| `/audit` | `/security-scan` |

The v1 names would shadow Antigravity built-ins.

## Uninstall

```bash
eag uninstall            # removes exactly what install created; keeps your sessions and instincts
eag uninstall --purge    # also deletes ~/.gemini/eag
```

## Contributing

```bash
npm test                 # hooks, installer, CLI, validator (node:test, no dependencies)
npm run validate         # enforces docs/AUTHORING.md: frontmatter, tool names, rule triggers, links
npm run catalog          # regenerates docs/CATALOG.md
./install.sh --link      # develop against your checkout live
```

Read [docs/AUTHORING.md](docs/AUTHORING.md) before adding a skill, agent or rule, and see [CONTRIBUTING.md](CONTRIBUTING.md). Something not working? See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## License

MIT © Purvansh Bhatt
