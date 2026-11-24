---
name: google-adk
disable-model-invocation: true
description: >-
  Builds agents with Google's Agent Development Kit (google-adk): LLM agents
  with function tools, coordinator and workflow multi-agent designs, sessions,
  state and memory, callbacks for guardrails, evaluation with adk eval, and
  deployment to Cloud Run or Agent Runtime (formerly Vertex AI Agent Engine).
  Use when the user mentions ADK, root_agent, adk web, adk eval or adk deploy,
  or wants a multi-agent app on Gemini.
---

# Google Agent Development Kit (ADK)

ADK wraps Gemini (and other models) in an agent runtime: tools, sessions,
state, memory, callbacks, evaluation and deployment. Build the smallest agent
that passes its eval set, then add agents only when a single agent
demonstrably fails. ADK moves fast (2.x added graph workflows and agent
modes), so confirm every API below against `https://adk.dev` for your
installed version.

## When to use

- The project has `root_agent`, imports `google.adk`, or uses the `adk` CLI.
- The user wants "an agent with tools, memory, or several specialist agents" on Gemini, with per-user sessions and a deployable API.
- Agent trajectories need regression testing with `adk eval`.

## When not to use

- A single model call or a short tool loop: `gemini-api` is less code.
- An agent that edits a codebase and runs commands: `antigravity-sdk-orchestrator`.
- Tools that many agent hosts should share: build an MCP server (`mcp-server-development`); ADK can consume it.
- Infrastructure beyond `adk deploy`: `cloud-devops`, `kubernetes-gke`, `terraform-iac`.

## Workflow

1. **Install, check the version, scaffold.**

   ```bash
   python -m venv .venv
   # PowerShell: .venv\Scripts\Activate.ps1    bash: source .venv/bin/activate
   pip install google-adk
   pip show google-adk          # 2.x: graph workflows, Agent(mode=...); Python 3.10+
   adk create my_agent          # my_agent/agent.py, __init__.py, .env
   ```

   **Check:** `adk --help` lists `create`, `run`, `web`, `eval` and `deploy`, and the version is pinned in `requirements.txt`.

2. **Configure the model backend in `my_agent/.env`.** API key: `GOOGLE_API_KEY=<key>`. Google Cloud: `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION` and `GOOGLE_GENAI_USE_ENTERPRISE=True` (current docs; older releases read `GOOGLE_GENAI_USE_VERTEXAI=TRUE`), after `gcloud auth application-default login`.

   **Check:** `git check-ignore my_agent/.env` prints the path, and `adk run my_agent` answers "hello".

3. **Write the root agent and its tools.**

   ```python
   # my_agent/agent.py
   import os
   from google.adk.agents.llm_agent import Agent
   from google.adk.tools.tool_context import ToolContext

   def get_order_status(order_id: str, tool_context: ToolContext) -> dict:
       """Return the shipping status for one order.

       Args:
           order_id: Order ID such as "A-1042".
       """
       tool_context.state["user:last_order_id"] = order_id
       if not order_id.startswith("A-"):
           return {"status": "error", "message": f"Unknown order ID format: {order_id}"}
       return {"status": "success", "order_id": order_id, "shipping": "in transit"}

   root_agent = Agent(
       name="support_agent",
       model=os.environ.get("ADK_MODEL", "gemini-flash-latest"),  # pin a concrete ID for production
       description="Answers order-status questions.",
       instruction="Answer order questions. Call get_order_status before stating any status.",
       tools=[get_order_status],
   )
   ```

   Tool rules: typed parameters and a docstring (the model reads both); return a dict with `status`; report expected failures as data, not exceptions; keep side effects idempotent. ADK injects `tool_context` and hides it from the model.

   **Check:** `adk run my_agent` calls the tool for a prompt that needs it, and `adk web --port 8000` (run from the parent folder; development only) shows the call in the event trace.

4. **Add agents only for a proven reason.**

   | Pattern | Use when | Shape |
   | :--- | :--- | :--- |
   | One agent + tools | Default | `Agent(tools=[...])` |
   | Coordinator + `sub_agents` | Distinct specialties; the model picks | `Agent(sub_agents=[a, b])`; delegation tools are injected per sub-agent |
   | Agent as a tool | Parent keeps control and needs a result | `AgentTool(agent=specialist)` |
   | Fixed order, fan-out or loop | Deterministic flow | 2.x graph `Workflow(edges=[...])`; `SequentialAgent`, `ParallelAgent`, `LoopAgent` still work but are deprecated in favour of graphs |

   Give each sub-agent a precise `description`, because the coordinator routes on it. In 2.x, sub-agents take `mode="chat" | "task" | "single_turn"`; never set `mode` on the root, and task agents must be leaves. Pass data with `output_key` plus `{key}` in later instructions (`{key?}` when optional). Examples: [references/adk-patterns.md](references/adk-patterns.md).

   **Check:** in the `adk web` trace, each request type is handled by the intended agent.

5. **Treat sessions and state as a data model.**

   | Key prefix | Scope | Persistence |
   | :--- | :--- | :--- |
   | none | This session | Only with a persistent session service |
   | `user:` | All sessions of one user in this app | Database or Vertex AI services |
   | `app:` | All users of the app | Database or Vertex AI services |
   | `temp:` | Current invocation | Never |

   Write state only through `tool_context.state`, `callback_context.state` or `output_key`; a session object fetched with `get_session` is read-only in practice. Use `InMemorySessionService` for development, a database or Vertex AI session service for anything users rely on.

   ```python
   import asyncio
   from google.adk.runners import Runner
   from google.adk.sessions import InMemorySessionService
   from google.genai import types
   from my_agent.agent import root_agent

   async def main() -> None:
       sessions = InMemorySessionService()
       session = await sessions.create_session(app_name="support", user_id="u1")
       runner = Runner(agent=root_agent, app_name="support", session_service=sessions)
       msg = types.Content(role="user", parts=[types.Part(text="Where is order A-1042?")])
       async for event in runner.run_async(user_id="u1", session_id=session.id, new_message=msg):
           if event.is_final_response() and event.content:
               print(event.content.parts[0].text)

   asyncio.run(main())
   ```

   **Check:** with a persistent service, `user:` keys survive a process restart.

6. **Add long-term memory only when sessions are not enough.** `InMemoryMemoryService` for development; `VertexAiMemoryBankService(project=..., location=..., agent_engine_id=...)` in production (all from `google.adk.memory`). Store finished sessions with `await memory_service.add_session_to_memory(session)`, give the agent `load_memory` (on demand) or `preload_memory` (every turn) from `google.adk.tools`, and pass `memory_service=` to `Runner`.

   **Check:** a new session recalls a fact stated in an earlier one.

7. **Guard with callbacks.**

   ```python
   from typing import Any, Optional
   from google.adk.tools.base_tool import BaseTool
   from google.adk.tools.tool_context import ToolContext

   NEEDS_APPROVAL = {"issue_refund", "delete_account"}

   def guard_tools(tool: BaseTool, args: dict[str, Any], tool_context: ToolContext) -> Optional[dict]:
       if tool.name in NEEDS_APPROVAL and not tool_context.state.get("temp:approved"):
           return {"status": "error", "message": f"{tool.name} needs human approval."}  # tool skipped
       return None  # run the tool
   ```

   Attach with `Agent(..., before_tool_callback=guard_tools)`. Returning `None` continues; returning a value replaces the step: `types.Content` from `before_agent_callback`, `LlmResponse` from `before_model_callback` or `after_model_callback`, a `dict` from `before_tool_callback` (skips the tool, even `{}`) or `after_tool_callback`. Parameter names must match exactly, because ADK passes them by keyword.

   **Check:** a unit test calls `guard_tools` with a blocked tool and asserts a dict comes back.

8. **Evaluate before every change.** Save real conversations as cases from the `adk web` Eval tab ("Add current session"), set thresholds in `test_config.json`, then run:

   ```bash
   adk eval my_agent my_agent/smoke.evalset.json --config_file_path=my_agent/test_config.json --print_detailed_results
   ```

   Criteria include `tool_trajectory_avg_score` (default 1.0, exact match), `response_match_score` (ROUGE-1, default 0.8), and LLM-judged `final_response_match_v2`, rubric, `hallucinations_v1` and `safety_v1`. For pytest, call `AgentEvaluator.evaluate(...)` from `google.adk.evaluation.agent_evaluator`. See `agent-evals` for gates and judge calibration.

   **Check:** the eval runs in CI and a failing case prints expected versus actual.

9. **Deploy only after the user confirms.** Deploys create billable resources and can expose a public endpoint.

   ```bash
   adk deploy cloud_run --project=$GOOGLE_CLOUD_PROJECT --region=$GOOGLE_CLOUD_LOCATION \
     --service_name=support-agent --app_name=support ./my_agent
   adk deploy agent_engine --project=$GOOGLE_CLOUD_PROJECT --region=$GOOGLE_CLOUD_LOCATION \
     --display_name="Support agent" my_agent
   ```

   On Cloud Run, pass `--session_service_uri` and `--artifact_service_uri` or sessions vanish when instances recycle; answer `N` to "Allow unauthenticated invocations" unless the user wants a public endpoint; keep `GOOGLE_API_KEY` in Secret Manager. `--with_ui` deploys the dev UI too: avoid it in production. For Agent Runtime, save the printed `reasoningEngines/<id>`.

   **Check:** an authenticated request (`gcloud auth print-identity-token`) to the deployed service succeeds, and the eval set passes against it.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Start with five agents | One agent plus tools; split on eval evidence | Every hop adds latency, cost and routing errors |
| Mutate `session.state` from `get_session` | `output_key`, context `state`, or `state_delta` | Bypasses event tracking; changes are lost with persistent services |
| Raise for expected tool failures | Return `{"status": "error", "message": ...}` | The model can read it and recover |
| Literal `{braces}` in instructions | An instruction provider function | `{x}` is state templating; a missing key raises |
| Run `adk web` in production | `adk deploy` or an authenticated API server | The dev UI is not hardened |
| In-memory services on Cloud Run | `--session_service_uri` | State disappears with the instance |
| Attach one agent instance to two parents | Create separate instances | An agent has exactly one parent |

## Verification checklist

- [ ] ADK version pinned; APIs used exist in that version.
- [ ] `.env` is gitignored; no keys in code or deploy flags.
- [ ] Every tool has types, a docstring, and a structured error return.
- [ ] State writes go through context objects or `output_key`; prefixes match the intended scope.
- [ ] Destructive tools are behind a callback or approval step, with a test.
- [ ] An eval set with thresholds runs in CI and passes.
- [ ] Deployment used persistent services, private access, and the user's explicit go-ahead.

## Related

- Knowledge: `gemini-api`, `agent-evals`, `subagent-delegation`, `mcp-server-development`, `prompt-engineering`, `cloud-devops`, `observability-otel`.
- Agents: `gemini-ai-engineer` (build), `cloud-devops-engineer` (deploy), `security-guard` (tool guardrails).
- Workflows: `/feature-dev`, `/verify`, `/security-scan`.
