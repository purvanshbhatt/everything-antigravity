"""
Everything Antigravity (EAG) CLI.
Central command-line interface for managing, verifying, and running EAG components.
"""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import Dict, Any, List

# Local imports
from src.agent_shield import AgentShield
from src.compactor import ContextCompactor
from src.orchestrator import AntigravityOrchestrator

ROOT_DIR = Path(__file__).resolve().parent.parent


def get_repo_stats() -> Dict[str, Any]:
    """Inspects repository components and returns counts."""
    skills_dir = ROOT_DIR / "skills"
    agents_dir = ROOT_DIR / "agents"
    commands_dir = ROOT_DIR / "commands"
    rules_dir = ROOT_DIR / "rules"

    skills = [d.name for d in skills_dir.iterdir() if d.is_dir() and (d / "SKILL.md").exists()] if skills_dir.exists() else []
    agents = [f.name for f in agents_dir.glob("*.md")] if agents_dir.exists() else []
    commands = [f.name for f in commands_dir.glob("*.md")] if commands_dir.exists() else []
    rules = [f.name for f in rules_dir.glob("*.md")] if rules_dir.exists() else []

    return {
        "skills_count": len(skills),
        "skills": sorted(skills),
        "agents_count": len(agents),
        "agents": sorted(agents),
        "commands_count": len(commands),
        "commands": sorted(commands),
        "rules_count": len(rules),
        "rules": sorted(rules),
    }


def cmd_status(args):
    """Prints status of Everything Antigravity suite."""
    stats = get_repo_stats()
    orchestrator = AntigravityOrchestrator()
    sdk_status = orchestrator.get_sdk_status()

    print("=" * 65)
    print(" 🚀 EVERYTHING ANTIGRAVITY (EAG) - OPERATIONAL STATUS")
    print("=" * 65)
    print(f" Repository Path:  {ROOT_DIR}")
    print(f" EAG Version:      1.0.0")
    print(f" Total Skills:     {stats['skills_count']}")
    print(f" Total Agents:     {stats['agents_count']}")
    print(f" Total Commands:   {stats['commands_count']}")
    print(f" Total Rules:      {stats['rules_count']}")
    print("-" * 65)
    print(f" Google SDK Hook:  {'Available' if sdk_status['has_sdk'] else 'Native/Standard Mode'}")
    print(f" App Data Dir:     {sdk_status['app_data_dir']} (exists: {sdk_status['app_data_exists']})")
    print(f" Max Subagent Dp:  {sdk_status['max_subagent_depth']}")
    print("=" * 65)


def cmd_verify(args):
    """Verifies schema conformance across all skills, agents, commands, and manifests."""
    print("🔍 Running Comprehensive EAG Integrity Verification...\n")
    errors = []

    # 1. Verify Manifests
    manifest_files = [
        ROOT_DIR / ".antigravity" / "marketplace.json",
        ROOT_DIR / ".antigravity" / "config.json",
        ROOT_DIR / "plugins" / "everything-antigravity" / "plugin.json",
        ROOT_DIR / "package.json"
    ]
    for mf in manifest_files:
        if not mf.exists():
            errors.append(f"Missing manifest file: {mf}")
        else:
            try:
                with open(mf, "r", encoding="utf-8") as f:
                    json.load(f)
                print(f"  [PASS] Manifest JSON valid: {mf.relative_to(ROOT_DIR)}")
            except Exception as e:
                errors.append(f"Invalid JSON in {mf}: {e}")

    # 2. Verify Skills (frontmatter 'name' and 'description')
    skills_dir = ROOT_DIR / "skills"
    if skills_dir.exists():
        for sdir in skills_dir.iterdir():
            if sdir.is_dir():
                skill_md = sdir / "SKILL.md"
                if not skill_md.exists():
                    errors.append(f"Skill directory missing SKILL.md: {sdir.name}")
                    continue
                content = skill_md.read_text(encoding="utf-8")
                if not content.startswith("---"):
                    errors.append(f"Skill {sdir.name}/SKILL.md missing frontmatter header (---)")
                    continue
                parts = content.split("---", 2)
                if len(parts) < 3:
                    errors.append(f"Skill {sdir.name}/SKILL.md has malformed frontmatter delimiter")
                    continue
                frontmatter = parts[1]
                if "name:" not in frontmatter or "description:" not in frontmatter:
                    errors.append(f"Skill {sdir.name}/SKILL.md frontmatter must contain 'name' and 'description'")
                else:
                    print(f"  [PASS] Skill verified: {sdir.name}")

    # 3. Verify Subagents
    agents_dir = ROOT_DIR / "agents"
    if agents_dir.exists():
        for agent_file in agents_dir.glob("*.md"):
            content = agent_file.read_text(encoding="utf-8")
            if len(content.strip()) < 50:
                errors.append(f"Agent description too short/empty: {agent_file.name}")
            else:
                print(f"  [PASS] Agent verified: {agent_file.name}")

    # 4. Summary
    print("\n" + "-" * 65)
    if errors:
        print(f"❌ Verification FAILED with {len(errors)} error(s):")
        for err in errors:
            print(f"   - {err}")
        sys.exit(1)
    else:
        print("✅ ALL EAG COMPONENTS VERIFIED SUCCESSFULLY!")
        print("-" * 65)


def cmd_shield(args):
    """Executes AgentShield security scanner on text or file."""
    shield = AgentShield(mode="enforce")
    text = ""
    if args.file:
        p = Path(args.file)
        if not p.exists():
            print(f"Error: File not found: {args.file}")
            sys.exit(1)
        text = p.read_text(encoding="utf-8", errors="ignore")
    elif args.text:
        text = args.text
    else:
        text = sys.stdin.read()

    result = shield.evaluate_payload(text, command=args.cmd)
    print(json.dumps(result, indent=2))
    if not result["passed"]:
        sys.exit(1)


def cmd_compact(args):
    """Executes context compaction on text or file."""
    compactor = ContextCompactor()
    text = ""
    if args.file:
        p = Path(args.file)
        if not p.exists():
            print(f"Error: File not found: {args.file}")
            sys.exit(1)
        text = p.read_text(encoding="utf-8", errors="ignore")
    elif args.text:
        text = args.text
    else:
        text = sys.stdin.read()

    result = compactor.compact(text)
    if args.summary_only:
        print(f"Original:  {result['original_chars']} chars")
        print(f"Compacted: {result['compacted_chars']} chars")
        print(f"Saved:     {result['reduction_percent']}%")
    else:
        print(result["compacted_text"])


def cmd_list_skills(args):
    """Lists all skills grouped by domain."""
    stats = get_repo_stats()
    print("=" * 65)
    print(f" 📦 EVERYTHING ANTIGRAVITY - SKILLS CATALOG ({stats['skills_count']} total)")
    print("=" * 65)
    for skill in stats["skills"]:
        s_file = ROOT_DIR / "skills" / skill / "SKILL.md"
        desc = ""
        if s_file.exists():
            for line in s_file.read_text().splitlines():
                if line.startswith("description:"):
                    desc = line.replace("description:", "").strip().strip('"').strip("'")
                    break
        print(f" • {skill.ljust(30)} {desc[:60]}...")
    print("=" * 65)


def cmd_list_agents(args):
    """Lists all specialized subagents."""
    stats = get_repo_stats()
    print("=" * 65)
    print(f" 🤖 EVERYTHING ANTIGRAVITY - SUBAGENTS CATALOG ({stats['agents_count']} total)")
    print("=" * 65)
    for agent in stats["agents"]:
        a_file = ROOT_DIR / "agents" / agent
        first_line = ""
        if a_file.exists():
            lines = [l.strip() for l in a_file.read_text().splitlines() if l.strip()]
            first_line = lines[0] if lines else ""
        print(f" • {agent.ljust(30)} {first_line[:60]}")
    print("=" * 65)


def cmd_install(args):
    """Installs EAG skills and configs into Antigravity user directories."""
    user_skills_dir = Path.home() / ".gemini" / "antigravity" / "skills"
    user_plugins_dir = Path.home() / ".gemini" / "config" / "plugins"

    print("🔧 Installing Everything Antigravity...")
    user_skills_dir.mkdir(parents=True, exist_ok=True)
    user_plugins_dir.mkdir(parents=True, exist_ok=True)

    # Link skills
    skills_src = ROOT_DIR / "skills"
    linked_count = 0
    if skills_src.exists():
        for sdir in skills_src.iterdir():
            if sdir.is_dir():
                target = user_skills_dir / sdir.name
                if target.exists() or target.is_symlink():
                    if target.is_symlink() or target.is_file():
                        target.unlink()
                try:
                    os.symlink(sdir, target)
                    linked_count += 1
                except Exception as e:
                    print(f"Warning: could not symlink {sdir.name}: {e}")

    print(f"✅ Successfully linked {linked_count} skills into {user_skills_dir}")

    # Link plugin
    plugin_src = ROOT_DIR / "plugins" / "everything-antigravity"
    plugin_target = user_plugins_dir / "everything-antigravity"
    if plugin_src.exists():
        if plugin_target.exists() or plugin_target.is_symlink():
            if plugin_target.is_symlink() or plugin_target.is_file():
                plugin_target.unlink()
        try:
            os.symlink(plugin_src, plugin_target)
            print(f"✅ Successfully linked plugin into {plugin_target}")
        except Exception as e:
            print(f"Warning: could not symlink plugin: {e}")

    print("\n🎉 Everything Antigravity installed successfully!")


def main():
    parser = argparse.ArgumentParser(
        prog="eag",
        description="Everything Antigravity (EAG) CLI Suite"
    )
    subparsers = parser.add_subparsers(dest="command")

    # status
    p_status = subparsers.add_parser("status", help="Show EAG status and component metrics")
    p_status.set_defaults(func=cmd_status)

    # verify
    p_verify = subparsers.add_parser("verify", help="Verify integrity of all skills, agents, and manifests")
    p_verify.set_defaults(func=cmd_verify)

    # shield
    p_shield = subparsers.add_parser("shield", help="Run AgentShield security inspection")
    p_shield.add_argument("--file", "-f", help="File to scan")
    p_shield.add_argument("--text", "-t", help="Raw string to scan")
    p_shield.add_argument("--cmd", "-c", help="Shell command to validate")
    p_shield.set_defaults(func=cmd_shield)

    # compact
    p_compact = subparsers.add_parser("compact", help="Run context compaction and token optimization")
    p_compact.add_argument("--file", "-f", help="File to compact")
    p_compact.add_argument("--text", "-t", help="Text to compact")
    p_compact.add_argument("--summary-only", "-s", action="store_true", help="Print only compaction metrics")
    p_compact.set_defaults(func=cmd_compact)

    # list-skills
    p_skills = subparsers.add_parser("list-skills", help="List all available skills")
    p_skills.set_defaults(func=cmd_list_skills)

    # list-agents
    p_agents = subparsers.add_parser("list-agents", help="List all specialized subagents")
    p_agents.set_defaults(func=cmd_list_agents)

    # install
    p_install = subparsers.add_parser("install", help="Install EAG into Antigravity user directories")
    p_install.set_defaults(func=cmd_install)

    args = parser.parse_args()
    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
