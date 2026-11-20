# ADK multi-agent patterns

Checked against `https://adk.dev` in November 2026 (ADK 2.x docs). Lines
marked "verify" come from ADK 1.x and were not re-checked; confirm them in
your installed version (for example
`python -c "from google.adk.tools.agent_tool import AgentTool"`) or the API
reference before relying on them.

## Coordinator with sub-agents (ADK 2.x)

```python
from google.adk import Agent

weather_agent = Agent(
    name="weather_checker",
    mode="single_turn",          # no user interaction; returns automatically
    tools=[get_weather, geocode_address],
)
flight_agent = Agent(
    name="flight_booker",
    mode="task",                 # may ask the user questions; must be a leaf
    input_schema=FlightInput,
    output_schema=FlightResult,
    tools=[search_flights, book_flight],
)
root_agent = Agent(
    name="travel_planner",       # never set mode on the root
    sub_agents=[weather_agent, flight_agent],
)
```

Declaring `sub_agents` injects delegation tools named after each sub-agent.
In `chat` mode, control returns to the parent through `transfer_to_agent`;
`task` and `single_turn` agents return on their own (task agents via
`finish_task`). Task mode is disabled inside graph workflows in ADK Python
2.0.0.

## Agent as a tool (verify)

```python
from google.adk.tools.agent_tool import AgentTool

summarizer = Agent(name="summarizer", instruction="Summarize the given text in 3 bullets.")
root_agent = Agent(name="analyst", tools=[AgentTool(agent=summarizer)])
```

Use this when the parent must keep the conversation and only needs the
specialist's result; use `sub_agents` when the specialist should take over.

## Pipeline through state (template workflow)

```python
from google.adk.agents.llm_agent import LlmAgent
from google.adk.agents.sequential_agent import SequentialAgent

writer = LlmAgent(
    name="writer", model=MODEL,
    instruction="Write a release note for the change described by the user.",
    output_key="draft",                      # state["draft"]
)
editor = LlmAgent(
    name="editor", model=MODEL,
    instruction="Tighten this draft to under 80 words:\n\n{draft}",
    output_key="final_note",
)
root_agent = SequentialAgent(name="release_notes", sub_agents=[writer, editor])
```

`SequentialAgent`, `ParallelAgent` and `LoopAgent` are template workflows,
deprecated in favour of graph workflows but still documented. For loops,
`LoopAgent(max_iterations=...)` stops at the cap or when a tool sets
`tool_context.actions.escalate = True` (verify). Parallel branches must write
distinct `output_key`s.

## Graph workflows (ADK 2.x)

The docs import `Agent`, `Workflow` and `Event` from `google.adk`. A workflow
is built from `edges`, starting at `"START"`, chaining agents and plain
functions; a function node receives the previous node's output as
`node_input`, and a router node returns `Event(route=...)` to pick a branch
(for example `"BUG": handle_bug`). Read `https://adk.dev/graphs/` for the
full constructor, data handling, human input, retries and timeouts before
writing one; the API is new and the docs are the source of truth.

## Callback reference

| Callback | Signature (keyword names must match) | Return non-None to |
| :--- | :--- | :--- |
| `before_agent_callback` | `(callback_context)` | Skip the agent; `types.Content` becomes its reply |
| `after_agent_callback` | `(callback_context)` | Append an extra `types.Content` event |
| `before_model_callback` | `(callback_context, llm_request)` | Skip the model; return an `LlmResponse` |
| `after_model_callback` | `(callback_context, llm_response)` | Replace the `LlmResponse` |
| `before_tool_callback` | `(tool, args, tool_context)` | Skip the tool; the `dict` becomes its result |
| `after_tool_callback` | `(tool, args, tool_context, tool_response)` | Replace the tool result `dict` |

Imports: `CallbackContext` from `google.adk.agents.callback_context`;
`LlmRequest`, `LlmResponse` from `google.adk.models`; `BaseTool` from
`google.adk.tools.base_tool`; `ToolContext` from `google.adk.tools.tool_context`.
The model and tool callbacks belong to LLM agents; agent callbacks exist on
every agent.

## Evaluation files

- `*.test.json`: one session (possibly multi-turn) per file; fast unit-style checks.
- `*.evalset.json`: many sessions; integration tests, optional user-simulation scenarios.
- Create both from real runs in the `adk web` Eval tab rather than writing
  the schema by hand, then edit expected tool calls and responses.
- Run a subset: `adk eval my_agent path/to/set.evalset.json:eval_1,eval_2`.
- Some LLM-judged criteria call the Gen AI Evaluation Service and need
  `GOOGLE_API_KEY` or Google Cloud credentials.
