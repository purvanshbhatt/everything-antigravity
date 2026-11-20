---
name: antigravity-sdk-orchestrator
description: >-
  Builds and orchestrates agents in code with the Google Antigravity Python
  SDK (google-antigravity): Agent and LocalAgentConfig, streaming, custom
  tools, MCP servers, subagent hierarchies, safety policies and sandboxing,
  hooks, budgets, retries, compaction, persistence and structured output. Use
  when writing Python that imports google.antigravity, or when automating
  Antigravity agents in scripts, CI or evaluations.
---

# Antigravity SDK Orchestrator

The Antigravity SDK runs the Antigravity agent harness inside your Python
process: one async context manager gives you an agent with file, search and
shell tools, policies, hooks and subagents. The hard part is not calling the
agent; it is bounding it: what it may touch, how much it may spend, and how
you know it finished. This skill covers only APIs shown in the SDK's bundled
documentation (listed under Sources); check there for anything else.

## When to use

- Python code imports `google.antigravity`, or the user wants to "run an Antigravity agent from a script, CI job, test harness or scheduler".
- A coordinator with specialist subagents, custom tools or MCP servers must be wired up in code.
- Benchmarking agent behaviour reproducibly.

## When not to use

- Configuring the interactive app or CLI (skills, rules, `hooks.json`): `antigravity-customization`.
- Single model calls without an agent harness: `gemini-api`. Deployed multi-agent web services: `google-adk`.
- Deciding whether to delegate at all: `subagent-delegation` (this skill is the mechanics).

## Workflow

1. **Install and authenticate.**

   ```bash
   pip install google-antigravity   # platform wheels bundle the runtime binary: always install with pip
   ```

   - Gemini API key: `GEMINI_API_KEY` in the environment or `.env` (keys from `https://aistudio.google.com/app/api-keys`). `LocalAgentConfig(api_key=...)` exists; feed it only from a secret store.
   - Google Cloud: `LocalAgentConfig(vertex=True, project=..., location=...)` after `gcloud auth application-default login`, or express mode with `vertex=True, api_key=...`.
   - On-device: `LiteRTAgentConfig(model_path=...)` (lightweight preset applied automatically) or `LocalOpenAIAgentConfig` for Ollama or LM Studio (call `.lightweight()`).

   **Check:** the step 2 script prints a reply.

2. **Run the smallest agent.**

   ```python
   import asyncio
   from google.antigravity import Agent, LocalAgentConfig

   async def main() -> None:
       config = LocalAgentConfig(system_instructions="You explain codebases precisely.")
       async with Agent(config) as agent:
           response = await agent.chat("List the top-level folders and what each is for.")
           async for token in response:          # or: print(await response.text())
               print(token, end="", flush=True)
           print("\n", agent.conversation.total_usage)

   asyncio.run(main())
   ```

   `response.thoughts` streams reasoning and `response.tool_calls` streams typed tool calls. Leave `model` unset unless the user names one; never guess model IDs. `run_interactive_loop` waits for a human at the terminal and hangs any automated job.

   **Check:** tokens stream and `total_usage` is non-zero (zero usually means the call failed).

3. **Bound what the agent may do before giving it real work.** Built-in tools are `list_directory`, `search_directory`, `find_file`, `view_file`, `create_file`, `edit_file`, `run_command`, `ask_question`, `start_subagent`, `generate_image`, `search_web`, `read_url_content` and `finish`. The default policy, `confirm_run_command()`, denies `run_command` and allows everything else; the quickstart enables write tools with `capabilities=CapabilitiesConfig()`. Setting `workspaces` confines file tools to those directories.

   ```python
   from google.antigravity import Agent, LocalAgentConfig, types
   from google.antigravity.hooks import policy

   async def approve(tool_call: types.ToolCall) -> bool:
       return tool_call.args.get("CommandLine", "").startswith(("pytest", "npm test"))

   config = LocalAgentConfig(
       system_instructions="Fix the failing tests. Stay inside the repository.",
       workspaces=["/abs/path/to/repo"],
       capabilities=types.CapabilitiesConfig(
           run_command_config=types.RunCommandConfig(enable_sandbox=True)),
       policies=[
           policy.deny_all(),
           policy.allow("list_directory"), policy.allow("search_directory"), policy.allow("find_file"),
           policy.allow("view_file"), policy.allow("edit_file"),
           policy.deny("run_command", when=lambda a: "rm -rf" in a.get("CommandLine", ""), name="deny_rm_rf"),
           policy.ask_user("run_command", handler=approve),
       ],
   )
   ```

   Resolution order: specific deny, ask, allow; then `server/*` prefix deny, ask, allow; then global `*` deny, ask, allow; first match wins within a level. A predicate that raises counts as a match (fails closed). `enable_sandbox` silently does nothing where the OS sandbox is unavailable, so never rely on it alone.

   **Check:** a test prompt that tries `rm -rf` and a write outside `workspaces` is refused.

4. **Add tools, MCP servers and skills.** Custom tools are typed Python functions whose docstrings the model reads: `tools=[get_weather]`. Add a `ctx: ToolContext` parameter for per-conversation state (`ctx.get_state(key, default)`, `ctx.set_state(key, value)`). A custom tool with a built-in's exact name overrides it. MCP: `types.McpStdioServer(name=..., command=..., args=[...])` or `types.McpStreamableHttpServer(name=..., url=..., headers={...})` in `mcp_servers=[...]`, narrowed with `enabled_tools` or `disabled_tools`; tool and parameter names must be valid Python identifiers. Under `deny_all()`, allow server tools explicitly: `policy.allow(server, ["tool_name"])`. Load `SKILL.md` folders (EAG's `skills/` directory works) with `skills_paths=[...]`.

   **Check:** asked "what tools and skills do you have?", the agent lists the new ones, and one MCP call succeeds under the policy.

5. **Orchestrate subagents.**

   ```python
   reviewer = types.SubagentConfig(
       name="reviewer",
       description="Reviews one file for defects. Read-only. Returns a findings list.",
       capabilities=types.SubagentCapabilities(
           enabled_tools=[types.BuiltinTools.VIEW_FILE, types.BuiltinTools.SEARCH_DIR]),
   )
   config = LocalAgentConfig(
       subagents=[reviewer],
       capabilities=types.CapabilitiesConfig(
           enable_subagents=True, max_subagent_depth=1, allowed_subagents=["reviewer"]),
   )
   ```

   The root conversation is depth 0; `max_subagent_depth` is a session-wide ceiling; `allowed_subagents` scopes who may call whom, on `CapabilitiesConfig` for the root and on `SubagentCapabilities` per tier. Only tiers that delegate get `BuiltinTools.START_SUBAGENT`. Subagents run autonomously by default. A full coordinator script is in [references/api-map.md](references/api-map.md).

   **Check:** the subagent cannot call tools outside `enabled_tools`, and nesting stops at the configured depth.

6. **Bound spend and runtime.** `budget_config=types.BudgetConfig(max_model_calls=..., max_tool_calls=..., max_input_tokens=..., max_output_tokens=..., max_total_tokens=...)`; scope is cumulative (`BudgetScope.LIFETIME`) unless set to `FORWARD_LOOKING` for resumed sessions. Inspect `response.stop_reason` for `types.StopReason.MAX_TOOL_CALLS_EXCEEDED`, `MAX_TOTAL_TOKENS_EXCEEDED` and the other budget reasons. Retries default to 2 API retries and 4 malformed-output retries; tune with `retry_config=types.RetryConfig(api_retry=types.ModelAPIRetryConfig(...), model_output_retry=types.ModelOutputRetryConfig(...))`. Long sessions: `compaction_config=types.CompactionConfig(token_threshold=...)`.

   **Check:** a run with a tiny `max_tool_calls` ends with the matching stop reason and your code reports it instead of treating it as success.

7. **Observe and steer with hooks.** Decorators in `google.antigravity.hooks.hooks`: `on_session_start`, `on_session_end`, `pre_turn` and `pre_tool_call_decide` (return `types.HookResult(allow=...)`), `post_turn`, `post_tool_call`, `on_tool_error` (return a string the model sees, or `None`), `stop`, `on_interaction`, `on_compaction`; register with `hooks=[...]`. A `stop` hook returning `types.StopHookResult(decision=types.StopDecision.CONTINUE, reason="...")` resumes the loop; `reason` is mandatory, and you should check `data.continuation_count` to avoid loops. Enable SDK logs with `logging.getLogger("google.antigravity").setLevel(logging.INFO)`; catch `types.AntigravityValidationError` and `types.AntigravityConnectionError`.

   **Check:** an audit log written by `post_tool_call` has one entry per tool call.

8. **Return structured results and persist conversations.** `response_schema=<Pydantic model>` plus `await response.structured_output()` returns a dict, or `None` when parsing failed, so handle `None`. Resume later with `LocalAgentConfig(conversation_id=agent.conversation_id, save_dir=<same dir>)`. Put artifacts elsewhere with an absolute `app_data_dir`.

   **Check:** a test resumes a saved conversation and recalls an earlier fact; the `None` path is tested.

9. **Benchmark in isolation.** `LocalAgentConfig().eval()` applies a product-neutral preset: no image generation or subagents, daemon commands on, autonomous tool execution, and benchmark retries. Because tools run unattended, run evaluations in a container or VM (`sandbox-isolation`), record per-task results and `total_usage`, and grade with `agent-evals`.

   **Check:** every task has a result, a stop reason and token usage, and nothing ran outside the sandbox.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `policy.allow_all()` outside local experiments | `deny_all()` plus explicit allows and `ask_user` | Shell access is the blast radius |
| Trust `enable_sandbox` alone | Policies plus a verified sandbox or container | It is a silent no-op where unsupported |
| Hard-code a model ID | Leave `model` unset or read it from config | Defaults track supported models |
| `run_interactive_loop` in CI | `agent.chat()` with budgets | It blocks waiting for a human |
| Treat any finished turn as success | Check `stop_reason` and structured output | Budget halts look like normal endings |
| Give every subagent `START_SUBAGENT` | Only coordinating tiers; set `max_subagent_depth` | Unbounded fan-out and cost |
| Ignore `thoughts_token_count` | Track it in `total_usage` | Thinking can dominate token spend |

## Verification checklist

- [ ] Credentials come from the environment or a secret store; nothing is hard-coded.
- [ ] Policies are explicit; `run_command` is denied or gated; `workspaces` is set.
- [ ] Budgets are configured and every `stop_reason` is handled.
- [ ] Subagents have minimal `enabled_tools`, `allowed_subagents` and a depth ceiling.
- [ ] Hooks or logging record every tool call; structured output `None` is handled.
- [ ] Evaluation runs are sandboxed and record usage per task.

## Sources

Only these were used; read them for details not covered here:
`~/.gemini/config/plugins/google-antigravity-sdk/skills/google-antigravity-sdk/` (`SKILL.md`, `references/*.md`, `examples/getting_started/*.md`) and the built-in `antigravity_guide/references/sdk.md`. Public repository: `https://github.com/google-antigravity/antigravity-sdk-python`.

## Related

- Knowledge: `subagent-delegation`, `antigravity-customization`, `sandbox-isolation`, `agent-shield`, `agent-evals`, `llm-cost-routing`, `context-compaction`, `gemini-api`.
- Agents: `chief-of-staff` (orchestration design), `security-guard` (policy review), `test-engineer`.
- Workflows: `/orchestrate`, `/deep-work`, `/verify`.
