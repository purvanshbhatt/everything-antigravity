# Interactions API recipes (Python and TypeScript)

Verified against the Gemini API docs at `aistudio.google.com/docs` in November
2026. The JS SDK uses the same snake_case request fields as Python for this API
(`system_instruction`, `generation_config`, `previous_interaction_id`,
`output_text`). Re-check field names against your installed SDK before shipping.

## Contents

- [Request shape](#request-shape)
- [Multi-turn: stateful and stateless](#multi-turn-stateful-and-stateless)
- [Function calling loop](#function-calling-loop)
- [Streaming](#streaming)
- [Multimodal input](#multimodal-input)
- [Google Search grounding and citations](#google-search-grounding-and-citations)
- [Safety settings](#safety-settings)
- [Usage fields](#usage-fields)

## Request shape

| Field | Purpose |
| :--- | :--- |
| `model` | Model or agent ID (from `models.list()`) |
| `input` | A string, or a list of typed items (`text`, `image`, `audio`, `function_result`, `user_input` steps, ...) |
| `system_instruction` | Plain string |
| `generation_config` | `max_output_tokens`, `thinking_level`, `thinking_summaries` (`auto`/`none`), `tool_choice` (`auto`/`any`/`none`/`validated`, or `{"allowed_tools": {"mode": "any", "tools": [...]}}`) |
| `response_format` | `{"type": "text", "mime_type": "application/json", "schema": <JSON Schema>}` |
| `tools` | `{"type": "function", ...}`, `{"type": "google_search"}`, ... |
| `safety_settings` | `[{"type": "<category>", "threshold": "<level>"}]` |
| `stream` | `True` for server events |
| `store` | Default on; `False` for stateless use (incompatible with `background` and `previous_interaction_id`) |
| `previous_interaction_id` | Continue a stored conversation |
| `background` | Long-running tasks; poll `interactions.get` until the status is terminal |

Response: `interaction.id`, `interaction.steps` (types include `user_input`,
`model_output`, `thought`, `function_call`, `function_result`,
`google_search_call`, `google_search_result`), `interaction.output_text` (joins
the trailing text blocks), `interaction.usage`.

## Multi-turn: stateful and stateless

```python
turn1 = client.interactions.create(model=MODEL, input="I have 2 dogs.")
turn2 = client.interactions.create(
    model=MODEL, input="How many paws?", previous_interaction_id=turn1.id)
```

Stateless (you own history; nothing is retained server-side):

```python
history = [{"type": "user_input", "content": [{"type": "text", "text": "I have 2 dogs."}]}]
r1 = client.interactions.create(model=MODEL, store=False, input=history)
history.extend(step.model_dump() for step in r1.steps)   # keep thought/function_call steps unchanged
history.append({"type": "user_input", "content": [{"type": "text", "text": "How many paws?"}]})
r2 = client.interactions.create(model=MODEL, store=False, input=history)
```

## Function calling loop

```python
import json
from google import genai

class ToolError(Exception):
    """Raised by a tool handler for failures the model should see."""

client = genai.Client()
TOOLS = [{
    "type": "function",
    "name": "get_order_status",
    "description": "Look up the shipping status of one order by its ID.",
    "parameters": {
        "type": "object",
        "properties": {"order_id": {"type": "string", "description": "Order ID such as A-1042"}},
        "required": ["order_id"],
    },
}]

def get_order_status(args: dict) -> dict:
    return {"order_id": args["order_id"], "status": "shipped"}

HANDLERS = {"get_order_status": get_order_status}

def run(prompt: str, model: str, max_turns: int = 8) -> str:
    interaction = client.interactions.create(model=model, input=prompt, tools=TOOLS)
    for _ in range(max_turns):
        calls = [s for s in interaction.steps if s.type == "function_call"]
        if not calls:
            return interaction.output_text
        results = []
        for call in calls:                       # parallel calls arrive together
            try:
                payload = HANDLERS[call.name](call.arguments)
            except (ToolError, KeyError, ValueError) as exc:
                payload = {"error": f"{type(exc).__name__}: {exc}"}
            results.append({"type": "function_result", "name": call.name, "call_id": call.id,
                            "result": [{"type": "text", "text": json.dumps(payload)}]})
        interaction = client.interactions.create(
            model=model, input=results, tools=TOOLS,   # tools are not remembered: resend
            previous_interaction_id=interaction.id)
    raise RuntimeError(f"tool loop exceeded {max_turns} turns")
```

```ts
import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({});
type Handler = (args: Record<string, unknown>) => unknown;
const handlers: Record<string, Handler> = {
  get_order_status: (a) => ({ order_id: a.order_id, status: "shipped" }),
};

export async function run(prompt: string, model: string, tools: unknown[], maxTurns = 8): Promise<string> {
  let interaction = await client.interactions.create({ model, input: prompt, tools });
  for (let turn = 0; turn < maxTurns; turn++) {
    const calls = interaction.steps.filter((s: any) => s.type === "function_call");
    if (calls.length === 0) return interaction.output_text;
    const input = calls.map((c: any) => {
      let payload: unknown;
      try {
        const h = handlers[c.name];
        payload = h ? h(c.arguments) : { error: `unknown tool ${c.name}` };
      } catch (err) {
        payload = { error: err instanceof Error ? err.message : String(err) };
      }
      return { type: "function_result", name: c.name, call_id: c.id,
               result: [{ type: "text", text: JSON.stringify(payload) }] };
    });
    interaction = await client.interactions.create({
      model, input, tools, previous_interaction_id: interaction.id,
    });
  }
  throw new Error(`tool loop exceeded ${maxTurns} turns`);
}
```

Past roughly 20 to 30 tools, the docs suggest tool retrieval instead of sending
every declaration. Combining `response_format` with tools is in preview and
limited to Gemini 4 and Gemini 3 models.

## Streaming

```python
stream = client.interactions.create(model=MODEL, input=prompt, stream=True)
for event in stream:
    if event.event_type == "step.delta" and event.delta.type == "text":
        print(event.delta.text, end="", flush=True)
    elif event.event_type == "interaction.completed":
        usage = event.interaction.usage
    elif event.event_type == "error":
        raise RuntimeError(f"stream error: {event}")
```

Event types: `interaction.created`, `interaction.status_update`, `step.start`,
`step.delta`, `step.stop`, `interaction.completed`, `error`. Delta types include
`text`, `arguments_delta` (tool arguments stream incrementally) and
`thought_summary`. Structured output streams as concatenable partial JSON.

## Multimodal input

```python
with open("photo.jpg", "rb") as f:
    image_bytes = f.read()
interaction = client.interactions.create(model=MODEL, input=[
    {"type": "text", "text": "Describe this image."},
    {"type": "image", "mime_type": "image/jpeg", "data": image_bytes},   # JS: base64 string
])

audio = client.files.upload(file="call.mp3")      # JS: files.upload({ file, config: { mimeType } })
interaction = client.interactions.create(model=MODEL, input=[
    {"type": "text", "text": "Summarize this call."},
    {"type": "audio", "uri": audio.uri, "mime_type": audio.mime_type},
])
```

Video and document item type names, and token costs per second of video, are
listed in the image, audio, video and document guides; check them there.

## Google Search grounding and citations

```python
interaction = client.interactions.create(
    model=MODEL, input="Who won Euro 2024?", tools=[{"type": "google_search"}])
for step in interaction.steps:
    if step.type == "model_output":
        for block in step.content:
            if block.type == "text":
                for a in block.annotations or []:
                    if a.type == "url_citation":
                        print(block.text[a.start_index:a.end_index], "->", a.title, a.url)
```

`google_search_call` steps list the queries; `google_search_result` steps carry
`search_suggestions` HTML. Display rules are in the "Grounding with Google
Search" terms. One migration example uses `uri` instead of `url` on
annotations; check your SDK's type.

## Safety settings

```python
safety_settings=[{"type": "dangerous_content", "threshold": "block_medium_and_above"}]
```

Categories: `harassment`, `hate_speech`, `sexually_explicit`,
`dangerous_content`, `jailbreak`. Thresholds: `off`, `block_only_high`,
`block_medium_and_above`, `block_low_and_above`. Unset categories default to
off on Gemini 2.5 and later. A block fails the request with HTTP 400 and error
code `safety` (input blocks may report `jailbreak`, `prohibited_content` or
`blocklist`); background interactions get `status` `failed`; streams emit an
`error` event.

## Usage fields

`total_input_tokens`, `total_output_tokens`, `total_thought_tokens`,
`total_cached_tokens`, `total_tool_use_tokens`, `total_tokens`. Thought tokens
are billed with output. Gemini 4 shares one 1,048,576-token window across input,
thinking and output, and caps synchronous output at 65,536 tokens by default.
