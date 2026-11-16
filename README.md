# Everything Antigravity (EAG)

> **The Agent Harness Operating System & Performance Optimization Suite for Google Antigravity**

Everything Antigravity (EAG) is an open-source, modular agent operating system built specifically for Google Antigravity, the Google Antigravity SDK (`google-antigravity`), and Gemini-powered agent runtimes.

It provides a production-tested library of 30+ skills, 10 specialized subagents, security guardrails, Model Context Protocol (MCP) integrations, and context compaction tools.

---

## Key Pillars

EAG covers five foundational domains required for autonomous software development and digital creation:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      EVERYTHING ANTIGRAVITY (EAG)                      │
├──────────────┬──────────────┬──────────────┬─────────────┬─────────────┤
│   BUSINESS   │   SECURITY   │ ENGINEERING  │  VIDEO GAME │ MULTIMEDIA  │
│ & MARKETING  │ & GUARDRAILS │ & ARCHITECT  │ DEVELOPMENT │   & VIDEO   │
├──────────────┼──────────────┼──────────────┼─────────────┼─────────────┤
│ Brand Study  │ AgentShield  │ Clean Arch   │ Game Loops  │ Remotion    │
│ GTM Strategy │ Leak Scrub   │ API Design   │ Godot 4     │ FFmpeg Flow │
│ Tech SEO     │ Code Audit   │ Backend CQRS │ Three.js 3D │ AI Images   │
│ Copywriting  │ Prompt Guard │ Flutter Apps │ Procedural  │ Canvas Card │
│ SaaS Pricing │ Sandbox Mode │ TDD QA Suite │ Audio & SFX │ Video Prod  │
└──────────────┴──────────────┴──────────────┴─────────────┴─────────────┘
```

---

## Directory Structure

```
everything-antigravity/
├── .antigravity/            # Antigravity marketplace and config manifests
├── agents/                  # 10 specialized subagent definitions
│   ├── code-architect.md
│   ├── security-guard.md
│   ├── marketing-strategist.md
│   ├── game-engine-specialist.md
│   ├── multimedia-producer.md
│   ├── code-reviewer.md
│   ├── test-engineer.md
│   ├── cloud-devops-engineer.md
│   ├── database-architect.md
│   └── chief-of-staff.md
├── skills/                  # 30+ modular skills with SKILL.md specs
│   ├── brand-discovery/
│   ├── agent-shield/
│   ├── software-architecture/
│   ├── game-architecture/
│   ├── remotion-motion-graphics/
│   └── ...
├── commands/                # Workflow commands (/boost, /review, /audit, ...)
├── rules/                   # Domain coding rules and token limits
├── mcp-configs/             # Model Context Protocol server definitions
├── plugins/                 # Antigravity plugin package
├── src/                     # Core Python engine (AgentShield, Compactor, CLI)
├── examples/                # Runnable prototypes (Game Loop, Remotion, SDK)
├── tests/                   # Pytest test suite (100% passing)
├── install.sh               # Universal POSIX installer
└── install.ps1              # Windows PowerShell installer
```

---

## Quickstart

### 1. One-Line Installation

Run the universal installer to register EAG skills and plugins directly into your Antigravity environment:

```bash
./install.sh
```

On Windows:
```powershell
.\install.ps1
```

### 2. Verify Repository Integrity

```bash
python3 src/cli.py verify
```

### 3. Check Status and Available Skills

```bash
python3 src/cli.py status
python3 src/cli.py list-skills
python3 src/cli.py list-agents
```

### 4. Run the Security Scanner (AgentShield)

Scan a file or prompt for credential exposure and prompt injection attempts:

```bash
python3 src/cli.py shield --file path/to/source.py
```

### 5. Run Context Compaction

Reduce context token consumption by stripping ANSI codes and deduplicating repetitive build logs:

```bash
python3 src/cli.py compact --file build.log --summary-only
```

---

## Specialized Subagents

EAG includes 10 purpose-built subagents that can be invoked directly or delegated hierarchically:

| Subagent | Primary Role |
| :--- | :--- |
| **`code-architect`** | High-level system design, Clean Architecture, and domain modeling |
| **`security-guard`** | Vulnerability detection, secret scanning, and prompt defense |
| **`marketing-strategist`** | Brand positioning, GTM playbooks, and conversion copy |
| **`game-engine-specialist`** | Realtime 2D/3D physics, Godot 4, and Three.js scenes |
| **`multimedia-producer`** | Programmatic video generation with Remotion and FFmpeg |
| **`code-reviewer`** | Adversarial line-by-line peer reviews and defect spotting |
| **`test-engineer`** | Test-driven development (TDD), property tests, and test suites |
| **`cloud-devops-engineer`** | Google Cloud Platform (Cloud Run, GKE), Terraform, and CI/CD |
| **`database-architect`** | PostgreSQL, BigQuery, Firestore indexing and zero-downtime schemas |
| **`chief-of-staff`** | Multi-agent coordination, milestone tracking, and task delegation |

---

## Workflow Commands

| Command | Action |
| :--- | :--- |
| `/boost` | Activates deep reasoning, triggers token compaction, and enforces strict QA gates |
| `/review` | Performs senior peer review on changed files with copy-pasteable patches |
| `/audit` | Runs automated security scans and dependency CVE checks |
| `/feature-dev` | Executes an end-to-end TDD feature implementation workflow |
| `/game-build` | Scaffolds game loop prototypes, mechanics, and asset hooks |
| `/video-render` | Compiles programmatic video scenes with dynamic subtitle overlays |
| `/marketing-launch` | Generates GTM announcements, social cards, and hero landing page copy |
| `/checkpoint` | Commits changes and compacts context history for the next milestone |

---

## Running the Automated Test Suite

EAG includes full verification tests for manifests, CLI subcommands, security rules, and skill schemas:

```bash
PYTHONPATH=. python3 -m pytest tests/ -v
```

---

## Contributing

Contributions from the agent engineering community are welcome! Please review [CONTRIBUTING.md](CONTRIBUTING.md) and ensure that all new skills provide a valid `SKILL.md` with schema frontmatter.

## License

This project is open-source software licensed under the [MIT License](LICENSE).
