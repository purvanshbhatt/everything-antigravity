# Antigravity SDK API map

A compact index of the configuration surface shown in the SDK's bundled
documentation. Names are exact; behaviour notes are paraphrased. If a field
you need is not here, read the bundled docs rather than guessing.

## Config classes

| Class | Purpose | Fields shown in the docs |
| :--- | :--- | :--- |
| `LocalAgentConfig` | Hosted Gemini (default) | `model`, `api_key`, `vertex`, `project`, `location`, `system_instructions`, `capabilities`, `policies`, `tools`, `mcp_servers`, `subagents`, `hooks`, `skills_paths`, `workspaces`, `response_schema`, `budget_config`, `retry_config`, `compaction_config`, `conversation_id`, `save_dir`, `app_data_dir` (absolute path), `env`, `endpoint`; method `.eval()` |
| `LiteRTAgentConfig` | On-device LiteRT models | `model_path`; lightweight preset applied automatically |
| `LocalOpenAIAgentConfig` | OpenAI-compatible local servers | Call `.lightweight()` |
| `types.CapabilitiesConfig` | Root capabilities | `agent_behavior`, `enable_subagents`, `max_subagent_depth`, `allowed_subagents`, `run_command_config` |
| `types.RunCommandConfig` | Shell tool | `enable_sandbox`, `enable_daemons` |
| `types.SubagentConfig` | A declared subagent | `name`, `description`, `capabilities` |
| `types.SubagentCapabilities` | Per-subagent limits | `enabled_tools`, `allowed_subagents`, `agent_behavior` |
| `types.AgentBehavior` | Execution style | `AUTONOMOUS` (default), `INTERACTIVE` (pairs with `BuiltinTools.ASK_QUESTION`) |
| `types.McpStdioServer` | Local MCP server | `name`, `command`, `args`, `enabled_tools` or `disabled_tools` |
| `types.McpStreamableHttpServer` | Remote MCP server | `name`, `url`, `headers`, `enabled_tools` or `disabled_tools` |
| `types.BudgetConfig` | Session limits | `max_model_calls`, `max_tool_calls`, `max_input_tokens` (net of cached), `max_output_tokens` (includes thinking), `max_total_tokens`; scope via `BudgetScope.LIFETIME` / `FORWARD_LOOKING` |
| `types.RetryConfig` | Retries | `api_retry=types.ModelAPIRetryConfig(max_retries, initial_sleep_duration_ms, exponential_multiplier, jitter_range)`, `model_output_retry=types.ModelOutputRetryConfig(max_retries)`; preset `RetryConfig.benchmark()` |
| `types.CompactionConfig` | History compaction | `token_threshold` |
| `types.GeminiModelOptions` | Endpoint options | `service_tier=types.ServiceTier.PRIORITY` (billed higher; may downgrade to `STANDARD`) used with `GeminiAPIEndpoint(options=...)` |

## Response and conversation

- `response = await agent.chat(prompt)`: `async for token in response`, `await response.text()`, `response.thoughts`, `response.tool_calls`, `await response.structured_output()`, `response.stop_reason`, `response.usage_metadata`.
- `agent.conversation_id`, `agent.conversation.total_usage` with `prompt_token_count`, `cached_content_token_count`, `candidates_token_count`, `thoughts_token_count`, `total_token_count`.
- Stop reasons include `UNSPECIFIED` (normal), `MAX_MODEL_CALLS_EXCEEDED`, `MAX_TOOL_CALLS_EXCEEDED`, `MAX_INPUT_TOKENS_EXCEEDED`, `MAX_OUTPUT_TOKENS_EXCEEDED`, `MAX_TOTAL_TOKENS_EXCEEDED`, `RESOURCE_EXHAUSTED`.

## Policies (`from google.antigravity.hooks import policy`)

`allow`, `deny`, `ask_user(..., handler=async fn(tool_call) -> bool)`, each
taking a tool name, `"server/*"`, `"*"`, or an MCP server config with an
optional tool-name list, plus `when=<predicate on args>` and `name=`.
Presets: `allow_all()`, `deny_all()`, `confirm_run_command()` (default),
`workspace_only(workspaces)` (added automatically when `workspaces` is set).
In `run_interactive_loop`, the default deny on `run_command` becomes a y/n prompt.

## Hooks (`from google.antigravity.hooks import hooks`)

| Decorator | Receives | Returns |
| :--- | :--- | :--- |
| `on_session_start`, `on_session_end` | nothing | nothing |
| `pre_turn` | prompt string | `types.HookResult(allow=...)` |
| `post_turn` | final response text | nothing |
| `pre_tool_call_decide` | `types.ToolCall` | `types.HookResult(allow=...)` |
| `post_tool_call` | tool result | nothing |
| `on_tool_error` | exception | string shown to the model, or `None` to propagate |
| `stop` | `types.StopArgs` (`continuation_count`, `response_text`) | `types.StopHookResult(decision=StopDecision.CONTINUE, reason=...)` or `ALLOW_STOP` |
| `on_interaction` | `types.AskQuestionInteractionSpec` | `types.QuestionHookResult(responses=[...])` |
| `on_compaction` | compaction event | nothing |

Class form for error recovery: subclass `hooks.OnToolErrorHook` and implement
`async def run(self, context, data) -> Optional[str]`.

## Coordinator example: parallel file review

```python
import asyncio
import pydantic
from google.antigravity import Agent, LocalAgentConfig, types
from google.antigravity.hooks import hooks, policy

class Finding(pydantic.BaseModel):
    file: str
    line: int
    severity: str
    problem: str

class Review(pydantic.BaseModel):
    findings: list[Finding]

@hooks.post_tool_call
async def audit(data) -> None:
    print("[audit]", data)

reviewer = types.SubagentConfig(
    name="reviewer",
    description="Reviews exactly one file for correctness and security defects. Read-only.",
    capabilities=types.SubagentCapabilities(
        enabled_tools=[types.BuiltinTools.VIEW_FILE, types.BuiltinTools.SEARCH_DIR]),
)

config = LocalAgentConfig(
    system_instructions=(
        "You coordinate code review. Start one reviewer subagent per file listed by the user, "
        "then merge and deduplicate their findings. Report only defects with a file and line."),
    workspaces=["/abs/path/to/repo"],
    subagents=[reviewer],
    capabilities=types.CapabilitiesConfig(
        enable_subagents=True, max_subagent_depth=1, allowed_subagents=["reviewer"]),
    policies=[policy.deny("run_command"), policy.allow("*")],
    response_schema=Review,
    budget_config=types.BudgetConfig(max_model_calls=40, max_tool_calls=120, max_total_tokens=400_000),
    hooks=[audit],
)

async def main(files: list[str]) -> None:
    async with Agent(config) as agent:
        response = await agent.chat("Review these files: " + ", ".join(files))
        review = await response.structured_output()
        if review is None or response.stop_reason != types.StopReason.UNSPECIFIED:
            raise SystemExit(f"review incomplete: stop_reason={response.stop_reason}")
        for f in review["findings"]:
            print(f'{f["severity"]:8} {f["file"]}:{f["line"]} {f["problem"]}')
        print(agent.conversation.total_usage)

asyncio.run(main(["src/auth.py", "src/payments.py"]))
```

Spot-check a sample of findings by opening the cited lines: subagent output can
be confidently wrong (see `subagent-delegation`).
