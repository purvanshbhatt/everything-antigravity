# 👾 Everything Antigravity (EAG) — Reddit Launch Posts

Use these tailored posts across the relevant subreddits. Each is customized to the community's culture and guidelines.

---

## 1. r/ArtificialIntelligence & r/LocalLLaMA
**Title:** Everything Antigravity: An open-source agent operating system and security harness for autonomous AI (Skills, MCP servers, Guardrails)

**Post Body:**
Hey everyone!

Over the past few months of building autonomous agent workflows with Google Antigravity, Gemini, and Claude Code, we noticed a recurring set of bottlenecks:
1. **Context Window Waste:** Long runs flood context windows with terminal ANSI escape codes and repeated log dumps.
2. **Security Vulnerabilities:** Agents executing shell commands need real-time interception for credential leaks, prompt injections (including Base64-encoded evasion payloads), and destructive commands.
3. **Siloed Tooling:** Most agent frameworks focus on text or standard CRUD APIs, leaving games, multimedia, and full-stack DevOps unaddressed.

Inspired by modular community suites like `Everything Claude Code`, we built and open-sourced **Everything Antigravity (EAG)**:
- **GitHub:** https://github.com/purvanshbhatt/everything-antigravity
- **GitLab:** https://gitlab.com/purvansh95b/everything-antigravity
- **NPM Package:** `everything-antigravity` (`npx everything-antigravity`)

### Core Highlights:
- **30+ Production Skills:** Spans software architecture, cloud DevOps (GCP/Cloud Run), game development (Godot 4, Three.js), multimedia pipelines (Remotion, FFmpeg, Canvas), and growth marketing.
- **AgentShield MCP Server:** A native Model Context Protocol (MCP) stdio server that runs real-time security scans on commands and agent outputs to intercept secret leaks, prompt injections, and dangerous operations.
- **Token Optimization & Compaction:** Built-in context compactor strips ANSI sequences, deduplicates lines, and extracts key facts to reduce token spend by 40-70%.
- **10 Autonomous Agent Profiles & Slash Commands:** From Code Architect and Security Guard to Game Specialist and Chief of Staff, plus workflow commands like `/plan`, `/boost`, `/audit`, and `/learn`.
- **Verified Cross-Platform:** 100% test coverage with automated integrity verification (`eag verify`) on Linux, macOS, and Windows.

Everything is licensed under MIT. We’d love your feedback on the architecture and security patterns!

---

## 2. r/ClaudeAI & r/ChatGPTCoding
**Title:** We built "Everything Antigravity" — porting and expanding the ECC philosophy for Google Antigravity, Gemini & Multi-Agent Swarms

**Post Body:**
Hey folks!

Many of us in this sub love modular developer harness suites (like `affaan-m/ECC` for Claude Code) that provide pre-packaged skills, custom commands, and persona profiles.

We wanted that same powerhouse experience for Google Antigravity, Gemini, and modern agentic engineering. Today we are open-sourcing **Everything Antigravity (EAG)**!

### What's Inside:
- **30 Domain Skills:** Everything from Clean Architecture and TDD testing to Godot game engines, Remotion video generation, and growth marketing.
- **AgentShield:** Zero-day prompt injection blocker and secret scanner (handles Base64 evasion, OpenAI project keys, GitHub PATs, and dangerous bash execution).
- **Custom Commands:** Workflow commands including `/plan` (contract design), `/boost` (two-phase delegation loops), `/audit` (security reviews), and `/learn` (instinct capture).
- **Multi-Agent Orchestrator:** Native hooks for managing subagents without context thrashing.

Check it out on GitHub: https://github.com/purvanshbhatt/everything-antigravity
GitLab Mirror: https://gitlab.com/purvansh95b/everything-antigravity

Would love to hear what skills or subagent roles you rely on most in your daily agent workflows!

---

## 3. r/webdev & r/gamedev
**Title:** Autonomous Game Dev & Multimedia Pipelines with Everything Antigravity (Open Source Agent Harness)

**Post Body:**
Hey devs!

We just open-sourced **Everything Antigravity (EAG)**, a developer suite designed to make AI agents actually good at real-world creative engineering tasks.

Instead of just generating single-file scripts:
- **Game Architecture & Audio:** Dedicated skills for Godot Engine (GDScript, node lifecycle, physics), Three.js WebGL rendering, ECS patterns, procedural terrain generation, and Web Audio API procedural sound synthesis.
- **Programmatic Multimedia:** Full pipelines for Remotion (React-based motion graphics video rendering), FFmpeg automation, and Canvas/Pillow dynamic visual asset creation.
- **Security & Sandboxing:** Runtime command scanning to keep agent sandbox environments safe.

Check out the code, examples, and documentation:
- Repository: https://github.com/purvanshbhatt/everything-antigravity
- GitLab: https://gitlab.com/purvansh95b/everything-antigravity

Feedback and PRs are very welcome!
