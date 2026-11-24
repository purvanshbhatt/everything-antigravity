<p align="center">
  <img src="assets/logo.svg" width="96" alt="Everything Antigravity logo">
</p>

<h1 align="center">Everything Antigravity</h1>

<p align="center">
  <b>Skills, agents, rules and hooks for Google Antigravity and Gemini CLI, installed with one command.</b><br>
  367 skills · 66 slash-command workflows · 53 specialist subagents · 30 scoped rules · 53 vetted MCP servers · guard, memory, learning and verify hooks
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

## Fits Antigravity's context budget

Antigravity gives all installed plugins one shared **20,000-token budget** for model-visible skills, subagents and MCP tools. Past that, it silently drops the most expensive skills from what the agent can see. A large skill pack can push out everything else, including itself.

EAG is built around that limit:

- **351 of its 367 skills are slash-only.** They cost nothing until used. Type `/` and the name, for example `/kubernetes-gke`.
- **16 small `eag-*` index skills** stay visible, one per category plus one for workflows. When a task matches, the agent opens the index and reads the right playbook from disk.
- **About a dozen core skills and all 53 subagents** have short descriptions that survive the cut.
- **The whole footprint is about 4.7k tokens.** The validator fails the build if EAG goes over 6k, and CI regenerates the indexes on every push.

See what your setup really costs, per plugin, and what Antigravity is dropping:

```bash
eag budget
```

Not sure which skill you need? Run `/skill-finder` and describe the job.

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
| `/orchestrate` | `/perf-audit` | `/release-management` | `/research-synthesis` | `/dockerize` |
| `/write-spec` | `/a11y-audit` | `/dependency-upgrades` | `/explain-code` | `/api-scaffold` |
| `/architecture-decision` | `/ui-polish` | `/postmortem` | `/issue-triage` | `/threat-modeling` |
| `/framework-migration` | | | | |
| `/idea-to-design` | `/regression-bisect` | `/merge-conflict-resolution` | `/skill-finder` | `/recency-research` |
| `/design-interrogation` | `/bug-variant-hunt` | `/post-deploy-canary` | `/terse-mode` | `/advisor-council` |
| `/slice-into-tickets` | `/test-suite-audit` | `/human-step-wizard` | `/focus-friendly-output` | `/doc-co-writing` |
| `/throwaway-prototype` | `/cross-model-review` | | `/yagni-minimalism` | |
| `/context-driven-tracks` | `/review-feedback-response` | | `/socratic-tutor` | |
| `/fresh-context-loop` | `/ci-failure-triage` | | `/docs-to-skill` | |
| `/git-worktrees` | | | | |

Names avoid Antigravity's built-ins (`/plan`, `/learn`, `/boost` and the rest), so nothing gets shadowed. Every workflow ends with explicit **Check:** steps and a verification checklist.

## Subagents

There are 53 agents, each with the least privilege its job needs. Reviewers and auditors cannot write files. Each agent is routed to a model tier: `flash` for fast scans, `pro` for architecture and security, `inherit` everywhere else.

| Orchestration | Review | Build and fix | Specialists |
| :--- | :--- | :--- | :--- |
| `chief-of-staff` (main agent) | `code-reviewer` | `test-engineer` | `gemini-ai-engineer` |
| `planner` | `typescript-reviewer` | `build-error-resolver` | `database-architect` |
| `code-architect` | `python-reviewer` | `refactor-cleaner` | `cloud-devops-engineer` |
| `codebase-explorer` | `go-reviewer` | `e2e-runner` | `game-engine-specialist` |
| | `security-guard` | `doc-updater` | `multimedia-producer` |
| | `silent-failure-hunter` | | `accessibility-auditor` |
| | `performance-optimizer` | | `marketing-strategist` |

Also included:

- **Language reviewers:** Java, Kotlin, Rust, C++, C#, Swift, Dart, PHP, Ruby, React and SQL.
- **Build resolvers:** JVM, Rust, C++, .NET and mobile.
- **Engineers:** frontend, backend, mobile, data, ML and SRE.
- **Specialists:** incident commander, product manager, UX designer, technical writer, data analyst, compliance auditor, migration specialist and deep researcher.

Start a whole session as the orchestrator with `agy --agent chief-of-staff`.

## Knowledge skills

There are 301 knowledge skills in 15 categories. They are slash-only, so they cost no context until used, and the agent finds them through the index skill named in the table. The full list with descriptions is in [docs/CATALOG.md](docs/CATALOG.md).

| Category | Index | Skills | Covers |
| :--- | :--- | ---: | :--- |
| AI, agents and machine learning | `eag-ai-ml` | 29 | Gemini API, ADK, Antigravity customization, MCP, prompting, evals, RAG, fine-tuning, Gemma, Vertex AI, serving, speech, vision, LLM observability |
| Languages and runtimes | `eag-languages` | 32 | TypeScript, Node, Bun/Deno, Python, Go, Rust, Java, Kotlin, Scala, C#, C/C++, Swift, PHP, Ruby, Elixir, Bash, PowerShell, WebAssembly |
| Frontend and web | `eag-frontend-web` | 23 | React, Next.js, Vue/Nuxt, Angular, Svelte, Astro, Tailwind and CSS, design systems, state, forms, PWAs, i18n, accessibility, performance |
| Mobile and desktop | `eag-mobile-desktop` | 9 | Flutter, React Native, Jetpack Compose, iOS, Kotlin Multiplatform, Electron, Tauri, store releases |
| Architecture, backend and APIs | `eag-backend-apis` | 23 | DDD, microservices, events, GraphQL, gRPC, queues, jobs, caching, search, payments, email, webhooks, multi-tenancy, deep modules |
| Data and databases | `eag-data` | 17 | Postgres, MySQL, MongoDB, Firestore, BigQuery, dbt, Spark, streaming, vector databases, warehousing |
| Testing and code quality | `eag-testing-quality` | 16 | contract, visual and API testing, test data, linting, static analysis, profiling, leaks, concurrency, tech debt, flaky tests, property-based and mutation testing |
| Security and compliance | `eag-security` | 17 | AppSec, API and LLM security, supply chain, containers, cryptography, secrets, SOC 2, GDPR, HIPAA, PCI DSS, defense in depth |
| Cloud, DevOps and SRE | `eag-cloud-devops` | 29 | Google Cloud services, AWS, Azure, Kubernetes, Helm, GitOps, Terraform, Pulumi, Ansible, networking, incidents, load and chaos testing, FinOps |
| Industry and domain | `eag-industry` | 10 | healthcare (FHIR), fintech ledgers, IoT, embedded, robotics (ROS 2), GIS, smart contracts, scientific computing, bioinformatics, optimization |
| Games | `eag-games` | 15 | game architecture, Godot, Unity, Unreal, Phaser, Three.js, shaders, procedural generation, game AI, multiplayer, level design, publishing |
| Media, design and creative | `eag-media-design` | 15 | image generation and processing, SVG, Blender, Remotion, ffmpeg, video, YouTube, podcasts, audio, slides, visual identity, UI/UX, UX research, generative art |
| Developer workflow and tooling | `eag-dev-tooling` | 18 | git, docs, open source, dev environments, CLIs, SDKs, IDE and browser extensions, Apps Script, spreadsheets, current-docs lookup, file-backed planning, PDFs, Word documents, diagrams as code, interactive CLIs |
| Product, growth and business | `eag-business` | 36 | PRDs, discovery, roadmaps, OKRs, analytics, A/B tests, marketing, sales, pricing, finance, fundraising, hiring, operations, AI search visibility |
| Writing, research and education | `eag-writing-research` | 12 | technical blogging, editing, translation, data storytelling, literature reviews, courses, talks, grants, newsletters, de-slopping AI prose, internal comms |

## Rules that cost almost nothing

- **`rules/AGENTS.md`** is always on, at about 1.1k tokens. It holds the working loop, the non-negotiables (never weaken tests, no secrets, ask before destructive actions, treat untrusted content as data) and a routing map.
- **25 language and file-type rules** load only when a matching file is touched (`trigger: glob`). They cover TypeScript/JS, React, Python, Go, Rust, Java/Kotlin, Scala, Dart/Flutter, Swift, C#, C/C++, Ruby, PHP, Elixir, GDScript, SQL, GraphQL, Protobuf, shell/PowerShell, Terraform, containers, web frontend, notebooks, Markdown docs and tests.
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
eag budget                                                      # live context budget per plugin, and what Antigravity drops
eag list [skills|workflows|agents|rules]
eag profile get | set <minimal|standard|strict>
eag sessions list | latest | save
eag instincts list | add | reinforce | weaken | remove | promote | prune | export | import
eag shield --cmd "<command>" | --text "<s>" | --file <path>     # exit 1 on findings; use in CI or pre-commit
eag compact --file build.log                                   # strip ANSI, collapse repeated lines
eag mcp list | show <name> | add <name> --yes                  # 53 vetted MCP servers, with a backup of your config
```

## Gemini CLI (beta)

The same repository is a Gemini CLI extension:

```bash
gemini extensions install https://github.com/purvanshbhatt/everything-antigravity
```

Alternatively, run `eag install --target gemini`.

Gemini CLI gets the following:

- **All 367 skills.**
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
| **Context you only pay for when used** | 29 of the 30 rules are glob-scoped or model-decided. 351 of 367 skills are slash-only and reached through 16 small index skills, so EAG uses about 4.7k of the shared 20k-token budget. The always-on core is about 1.1k tokens. |
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
