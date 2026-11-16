"""
Autonomous Agent Example using Antigravity Orchestrator & SDK patterns.
Demonstrates subagent task dispatching, security inspection, and lifecycle telemetry.
"""

import sys
from pathlib import Path
import asyncio

# Ensure repository root is on sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

try:
    from src.orchestrator import AntigravityOrchestrator
    from src.agent_shield import AgentShield
except ImportError:
    from orchestrator import AntigravityOrchestrator
    from agent_shield import AgentShield


async def run_agent_workflow():
    print("🤖 Initializing Everything Antigravity Autonomous Workflow...")
    orchestrator = AntigravityOrchestrator(max_depth=3)
    shield = AgentShield(mode="enforce")

    # 1. Inspect SDK status
    status = orchestrator.get_sdk_status()
    print(f"Status: SDK={status['has_sdk']}, MaxDepth={status['max_subagent_depth']}")

    # 2. Register lifecycle hooks
    def audit_hook(task):
        print(f" [HOOK: PRE-TURN] Auditing task: {task.name} ({task.role})")
        eval_result = shield.evaluate_payload(task.instruction)
        if not eval_result["passed"]:
            raise RuntimeError(f"Security Shield blocked task {task.name}: {eval_result}")

    orchestrator.register_hook("pre_turn", audit_hook)

    # 3. Spawn Subagent Tasks
    task1 = orchestrator.spawn_subagent(
        name="ArchitecturePlanner",
        role="code-architect",
        instruction="Design decoupled database and API contracts for user authentication."
    )
    task2 = orchestrator.spawn_subagent(
        name="SecurityReviewer",
        role="security-guard",
        instruction="Verify absence of hardcoded tokens and ensure password hashing uses Argon2id."
    )

    # 4. Execute Tasks
    for task in [task1, task2]:
        result = await orchestrator.execute_task(task)
        print(f"✅ {result['task']} completed: {result['summary']}")

    print("\n🎉 All autonomous agent tasks completed safely!")


def main():
    asyncio.run(run_agent_workflow())


if __name__ == "__main__":
    main()
