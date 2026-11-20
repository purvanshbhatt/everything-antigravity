# Model selection (snapshot: 2026-11-20)

This is a dated snapshot of the Gemini models page. It will go stale. Before
using any ID, run the list call from SKILL.md step 3 and check the
deprecations page. Never copy an ID from this file into code without that check.

## How to verify

```bash
# REST, key in a header (never in the URL)
curl -s -H "x-goog-api-key: $GEMINI_API_KEY" \
  https://generativelanguage.googleapis.com/v1beta/models
```

```powershell
Invoke-RestMethod -Headers @{ "x-goog-api-key" = $env:GEMINI_API_KEY } `
  -Uri "https://generativelanguage.googleapis.com/v1beta/models"
```

Also current: `https://aistudio.google.com/llms.txt` (docs index) and the
Gemini Docs MCP server at `https://gemini-api-docs-mcp.dev`.

## Snapshot by tier

| Tier | IDs on the models page (Nov 2026) | Use for |
| :--- | :--- | :--- |
| Frontier (Gemini 4, 1M context) | `gemini-4-carbon` (strongest reasoning), `gemini-4-neon`, `gemini-4-argon` (efficient reasoning), `gemini-4-hydrogen` (everyday coding and agentic work; recommended for new projects) | Hard multi-step reasoning, agents, code |
| Flash | `gemini-3.8-flash`, `gemini-3.6-flash` | Most product traffic, agent loops |
| Flash-Lite | `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite` | High-volume extraction, routing, classification |
| Embeddings | `gemini-embedding-2` (multimodal), `gemini-embedding-001` (text) | Search, RAG, clustering |
| Image | `gemini-3.1-flash-image`, `gemini-3-pro-image`, `gemini-3.1-flash-lite-image` | Generation and editing |
| Agents | `deep-research-preview-04-2026`, `antigravity-preview-09-2026` | Managed agents via the Interactions API |

Lifecycle notes on the page: `gemini-2.5-pro` and `gemini-2.5-flash` are
deprecated and reroute on 2026-12-01; several 2.0 and preview models are shut
down; preview models can be deprecated with two weeks' notice. Aliases such as
`gemini-flash-latest` (used in ADK samples) move without notice, so pin a
concrete ID in production and use aliases only in prototypes.

## Choosing

1. Start with the cheapest tier that passes your eval set (`agent-evals`).
2. Escalate per request, not per app (`llm-cost-routing` cascades).
3. Prefer `thinking_level` over a bigger model when the failure mode is
   shallow reasoning rather than missing knowledge.
4. Re-run the eval set before every model ID change, including alias moves.
