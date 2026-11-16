"""
Integration tests for Everything Antigravity CLI commands.
"""

import os
import sys
import subprocess
from pathlib import Path
import pytest

ROOT_DIR = Path(__file__).resolve().parent.parent


def run_eag_cli(*args):
    cmd = [sys.executable, str(ROOT_DIR / "src" / "cli.py")] + list(args)
    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT_DIR) + os.pathsep + env.get("PYTHONPATH", "")
    proc = subprocess.run(
        cmd,
        cwd=str(ROOT_DIR),
        env=env,
        capture_output=True,
        text=True,
        timeout=10
    )
    return proc


def test_cli_status():
    proc = run_eag_cli("status")
    assert proc.returncode == 0
    assert "EVERYTHING ANTIGRAVITY" in proc.stdout
    assert "Total Skills:" in proc.stdout
    assert "Total Commands:" in proc.stdout


def test_cli_verify():
    proc = run_eag_cli("verify")
    assert proc.returncode == 0
    assert "ALL EAG COMPONENTS VERIFIED SUCCESSFULLY!" in proc.stdout


def test_cli_list_skills():
    proc = run_eag_cli("list-skills")
    assert proc.returncode == 0
    assert "SKILLS CATALOG" in proc.stdout
    assert "brand-discovery" in proc.stdout
    assert "game-architecture" in proc.stdout
    assert "remotion-motion-graphics" in proc.stdout


def test_cli_list_agents():
    proc = run_eag_cli("list-agents")
    assert proc.returncode == 0
    assert "SUBAGENTS CATALOG" in proc.stdout
    assert "code-architect.md" in proc.stdout
    assert "security-guard.md" in proc.stdout


def test_cli_compact():
    proc = run_eag_cli("compact", "--text", "line1\nline1\nline1", "--summary-only")
    assert proc.returncode == 0
    assert "Compacted:" in proc.stdout


def test_cli_compact_no_input_non_blocking():
    """Ensures running compact without arguments fails fast instead of hanging on TTY stdin."""
    proc = run_eag_cli("compact")
    assert proc.returncode == 1
    assert "No text provided" in proc.stdout or "No text provided" in proc.stderr


def test_cli_shield_detection():
    proc = run_eag_cli("shield", "--cmd", "rm -rf /")
    assert proc.returncode == 1
    assert "dangerous_command" in proc.stdout


def test_cli_shield_clean():
    proc = run_eag_cli("shield", "--text", "console.log('hello world')")
    assert proc.returncode == 0
    assert '"passed": true' in proc.stdout.lower()
