"""
Unit tests for AntigravityOrchestrator and SDK hierarchy patterns.
"""

import sys
from pathlib import Path
import pytest
import asyncio

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.orchestrator import AntigravityOrchestrator, SubagentTask


@pytest.fixture
def orchestrator():
    return AntigravityOrchestrator(max_depth=3)


def test_orchestrator_initialization(orchestrator):
    status = orchestrator.get_sdk_status()
    assert "has_sdk" in status
    assert "app_data_dir" in status
    assert status["max_subagent_depth"] == 3


def test_orchestrator_does_not_confuse_stdlib_antigravity():
    """Ensure standard library 'antigravity' xkcd module is never treated as Google Antigravity SDK."""
    from src.orchestrator import HAS_SDK, agy
    import sys
    # If official google.antigravity is not installed, HAS_SDK must be False
    if "google.antigravity" not in sys.modules and "google_antigravity" not in sys.modules:
        assert HAS_SDK is False
        assert agy is None


@pytest.mark.asyncio
async def test_subagent_lifecycle_hooks(orchestrator):
    pre_turns = []
    post_turns = []

    def on_pre(task):
        pre_turns.append(task.name)

    def on_post(task, result):
        post_turns.append(result["status"])

    orchestrator.register_hook("pre_turn", on_pre)
    orchestrator.register_hook("post_turn", on_post)

    task = orchestrator.spawn_subagent(
        name="TestWorker",
        role="code-architect",
        instruction="Design microservice contracts."
    )
    assert task.status == "pending"

    result = await orchestrator.execute_task(task)

    assert task.status == "completed"
    assert result["status"] == "completed"
    assert "TestWorker" in pre_turns
    assert "completed" in post_turns
