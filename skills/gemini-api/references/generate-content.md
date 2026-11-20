# Legacy generateContent surface

`generateContent` is legacy but supported. Keep existing integrations working,
and use it where the Interactions API has no equivalent yet: the Batch API and
explicit context caching. Snippets follow the `google-genai` reference
(`googleapis.github.io/python-genai`) and the Batch API guide; items marked
"verify" were not re-checked in November 2026.

## Mapping to the Interactions API

| generateContent | Interactions API |
| :--- | :--- |
| `client.models.generate_content(model, contents, config)` | `client.interactions.create(model, input, ...)` |
| `response.text` | `interaction.output_text` |
| `candidates[].content.parts` | `interaction.steps` |
| `GenerateContentConfig(system_instruction=...)` | `system_instruction=` |
| `response_mime_type` + `response_schema` / `response_json_schema` | `response_format={"type": "text", "mime_type": ..., "schema": ...}` |
| `tools=[{"google_search": {}}]` (JS `{ googleSearch: {} }`) | `tools=[{"type": "google_search"}]` |
| `groundingMetadata.groundingSupports` | `annotations` on text blocks |
| `part.function_call` | `function_call` step (`id`, `name`, `arguments`) |
| `Part.from_function_response(name, response)` | `{"type": "function_result", "call_id", "name", "result"}` |
| `generate_content_stream` | `create(..., stream=True)` |
| `usage_metadata.prompt_token_count` / `candidates_token_count` / `total_token_count` | `usage.total_input_tokens` / `total_output_tokens` / `total_tokens` |
| Resend history or `client.chats.create` | `previous_interaction_id` |

## Config

```python
from google import genai
from google.genai import types

client = genai.Client()
resp = client.models.generate_content(
    model=MODEL,
    contents="Summarize: ...",
    config=types.GenerateContentConfig(
        system_instruction="You are concise.",
        max_output_tokens=512,
        response_mime_type="application/json",
        response_json_schema=Summary.model_json_schema(),   # or response_schema=Summary
        safety_settings=[types.SafetySetting(
            category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_ONLY_HIGH")],
    ),
)
print(resp.text)
```

Thinking (verify per model): Gemini 3 models take
`thinking_config=types.ThinkingConfig(thinking_level="low")`; Gemini 2.5 models
take `thinking_budget=<tokens>`; `include_thoughts=True` returns thought
summaries as parts with `part.thought` set.

## Function calling

Automatic (Python only): pass typed, documented functions as `tools=[fn]`; the
SDK runs them. Turn it off with
`automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)`
or cap it with `maximum_remote_calls=<n>`. Force a call with
`tool_config=types.ToolConfig(function_calling_config=types.FunctionCallingConfig(mode="ANY"))`.

Manual:

```python
decl = types.FunctionDeclaration(
    name="get_order_status", description="Look up one order.",
    parameters_json_schema={"type": "object", "properties": {"order_id": {"type": "string"}},
                            "required": ["order_id"]})
config = types.GenerateContentConfig(
    tools=[types.Tool(function_declarations=[decl])],
    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True))
contents = [types.Content(role="user", parts=[types.Part(text="Where is order A-1042?")])]
resp = client.models.generate_content(model=MODEL, contents=contents, config=config)
for _ in range(8):                                        # turn cap
    if not resp.function_calls:
        break
    contents.append(resp.candidates[0].content)           # keep the model turn unchanged (thought signatures)
    contents.append(types.Content(role="tool", parts=[
        types.Part.from_function_response(name=c.name, response={"result": HANDLERS[c.name](c.args)})
        for c in resp.function_calls]))
    resp = client.models.generate_content(model=MODEL, contents=contents, config=config)
print(resp.text)
```

## Explicit context caching (Gemini 3 and 2.5 only)

```python
cache = client.caches.create(
    model=MODEL,
    config=types.CreateCachedContentConfig(
        contents=[big_document], system_instruction="Answer from the document.",
        display_name="handbook-v3", ttl="3600s"))
resp = client.models.generate_content(
    model=MODEL, contents="What is the refund policy?",
    config=types.GenerateContentConfig(cached_content=cache.name))
```

Not supported on the Interactions API or Gemini 4 models; those rely on
implicit caching. Delete caches you no longer need; storage is billed per hour
(check the pricing page).

## Batch API (50% price, 24 h target)

```python
job = client.batches.create(
    model=MODEL,
    src=[{"contents": [{"parts": [{"text": "Classify: ..."}], "role": "user"}]}],
    config={"display_name": "nightly-classify"})
# Large jobs: upload JSONL of {"key": ..., "request": {...}} lines with
# client.files.upload(file="batch.jsonl", config=types.UploadFileConfig(mime_type="jsonl"))
# and pass src=uploaded.name.
DONE = {"JOB_STATE_SUCCEEDED", "JOB_STATE_FAILED", "JOB_STATE_CANCELLED", "JOB_STATE_EXPIRED"}
job = client.batches.get(name=job.name)    # poll with sleep until job.state.name in DONE
```

Inline requests must stay under 20 MB; input files up to 2 GB; jobs expire
after 48 hours; creation is not idempotent (resubmitting creates a second job).
Results: `job.dest.inlined_responses` or `client.files.download(file=job.dest.file_name)`.

## Errors

```python
from google.genai import errors
try:
    client.models.generate_content(model=MODEL, contents="hi")
except errors.APIError as e:
    log.warning("gemini error %s: %s", e.code, e.message)
```
