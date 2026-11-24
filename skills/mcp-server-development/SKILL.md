---
name: mcp-server-development
description: >-
  Builds and debugs MCP servers and clients: tool design, schemas, transports, auth, testing and safe defaults.
---

# MCP Server Development

An MCP server is an API whose only reader is a model. It succeeds when the
model picks the right tool from its name and description, sends valid input on
the first try, and gets back a small, structured answer it can act on. Both
official SDKs shipped breaking v2 releases in 2026, so pin the generation
before writing code.

## When to use

- "Build an MCP server", "expose our API or database to the agent", "migrate off FastMCP", "the MCP tool doesn't show up".
- Wrapping an internal service so Antigravity, Gemini CLI and ADK agents can all use it.
- Moving a local stdio server to a shared Streamable HTTP deployment.

## When not to use

- Only registering an existing server: `antigravity-customization` (step 6).
- A tool used by one Python agent only: a plain function tool (`google-adk`, `antigravity-sdk-orchestrator`).
- Designing a REST API for human clients: `api-design`.

## Workflow

1. **Pin the SDK generation.**

   | | v2 (current) | v1 (legacy) |
   | :--- | :--- | :--- |
   | TypeScript | `@modelcontextprotocol/server` (+ `/stdio`), HTTP adapters `@modelcontextprotocol/node`, `express`, `hono`, `fastify`; spec 2026-07-28 | `@modelcontextprotocol/sdk`; fixes for at least six months after 2026-07-27 |
   | Python | `mcp` package: `from mcp.server import MCPServer` | `from mcp.server.fastmcp import FastMCP` (raises `ModuleNotFoundError` on v2) |

   ```bash
   npm install @modelcontextprotocol/server zod
   uv add "mcp[cli]"            # or: pip install "mcp[cli]"  (Python 3.11+)
   ```

   Maintaining a v1 server? Use [references/sdk-v1-v2.md](references/sdk-v1-v2.md) for the differences.

   **Check:** `npm ls @modelcontextprotocol/server` or `pip show mcp` prints a pinned version, and the import in step 3 or 4 works.

2. **Design the tool surface before writing code.**
   - Tools follow user workflows, not one-to-one REST endpoints. Aim for 5 to 15 per server; past about 20, hosts start filtering.
   - Names are `snake_case` verb-noun identifiers (`search_tickets`, `get_ticket`); some hosts require valid Python identifiers.
   - The description says what the tool does, when to use it, what it returns and its limits. It is the only documentation the model reads.
   - Inputs use narrow types, enums and required fields; prefer IDs over free text.
   - Outputs are structured (an `outputSchema` or typed return), paginated (`cursor`, `limit` defaulting to about 20) and truncated with a note, never megabytes of raw data.
   - Annotate behaviour: `readOnlyHint`, `destructiveHint`, `idempotentHint`.
   - Use resources for readable context addressed by URI, and prompts for reusable, user-invoked templates.

   **Check:** a table of name, purpose, inputs and side effects for every tool has been reviewed before implementation starts.

3. **Implement in TypeScript (v2).**

   ```ts
   import { McpServer } from "@modelcontextprotocol/server";
   import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
   import * as z from "zod/v4";

   const server = new McpServer({ name: "acme-tickets", version: "1.0.0" });

   server.registerTool(
     "get_ticket",
     {
       title: "Get ticket",
       description: "Fetch one ticket by ID (for example T-123). Read-only. Use search_tickets to find IDs.",
       inputSchema: z.object({ ticket_id: z.string().regex(/^T-\d+$/) }),
       outputSchema: z.object({ id: z.string(), title: z.string(), status: z.enum(["open", "closed"]) }),
       annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
     },
     async ({ ticket_id }) => {
       const t = await db.getTicket(ticket_id);
       if (!t) {
         return { content: [{ type: "text", text: `No ticket ${ticket_id}. Call search_tickets first.` }], isError: true };
       }
       const output = { id: t.id, title: t.title, status: t.status };
       return { content: [{ type: "text", text: JSON.stringify(output) }], structuredContent: output };
     },
   );

   await server.connect(new StdioServerTransport());
   console.error("acme-tickets ready");   // stderr only: stdout carries JSON-RPC
   ```

   **Check:** `npx tsc --noEmit` passes, and the Inspector (step 7) lists `get_ticket` with both schemas.

4. **Implement in Python (v2).**

   ```python
   from mcp.server import MCPServer
   from mcp.server.mcpserver.exceptions import ToolError
   from pydantic import BaseModel

   mcp = MCPServer("acme-tickets")

   class Ticket(BaseModel):
       id: str
       title: str
       status: str

   @mcp.tool()
   def get_ticket(ticket_id: str) -> Ticket:
       """Fetch one ticket by ID (for example T-123). Read-only. Use search_tickets to find IDs."""
       row = DB.get(ticket_id)
       if row is None:
           raise ToolError(f"No ticket {ticket_id}. Call search_tickets first.")
       return Ticket(**row)

   @mcp.resource("tickets://{ticket_id}")
   def ticket_body(ticket_id: str) -> str:
       """Full ticket body as markdown."""
       return DB.body(ticket_id)

   @mcp.prompt()
   def triage(ticket_id: str) -> str:
       """Template for triaging one ticket."""
       return f"Triage ticket {ticket_id}: classify severity and propose an owner."

   if __name__ == "__main__":
       mcp.run()   # stdio by default
   ```

   Typed returns become structured content. Inject `ctx: Context` (from `mcp.server.mcpserver`) for logging, progress and the authenticated client.

   **Check:** `uv run mcp dev server.py` opens the Inspector and all three primitives appear.

5. **Return errors the model can act on.** In Python, `ToolError` yields a result with `is_error=True` and your message; any other exception becomes a generic failure the model cannot learn from (the traceback goes to your log); `MCPError` is a JSON-RPC protocol error. In TypeScript, return `isError: true` with a message for expected failures, and let schema validation reject bad input. Every message says what went wrong and what to call or change next.

   **Check:** an invalid ID returns an error result whose text names the next step.

6. **Choose the transport.**
   - **stdio** (default): local and per-user; the host launches the process. Log only to stderr.
   - **Streamable HTTP**: shared or remote. TypeScript v2 builds a handler with `createMcpHandler(() => server)` and serves it through `@modelcontextprotocol/node` or a framework adapter at `/mcp`. Python: `mcp.run(transport="streamable-http", host="127.0.0.1", port=8000)`; add `stateless_http=True` to scale horizontally and `json_response=True` for plain JSON (no elicitation or sampling then). Code: [references/sdk-v1-v2.md](references/sdk-v1-v2.md).
   - **SSE**: legacy. Do not build on it; Antigravity does not support it.

   Bind to `127.0.0.1` in development. The TS v2 handler validates no `Host`, `Origin` or token, so add the SDK's localhost host and origin validation (DNS-rebinding defence) or real auth in front. Python v2 enables rebinding protection automatically for localhost binds.

   **Check:** the Inspector connects to `http://127.0.0.1:<port>/mcp`, and a request with a foreign `Origin` is rejected.

7. **Test at three levels.**
   - Unit-test handler logic as plain functions with `pytest` or `vitest`.
   - Exercise every tool interactively: `uv run mcp dev server.py` (Python) or `npx @modelcontextprotocol/inspector node build/index.js` (any stdio server; confirm the current Inspector package in the SDK docs). Try valid, invalid and edge inputs.
   - CI smoke against HTTP with the Python client:

     ```python
     from mcp import Client

     async def test_smoke() -> None:
         async with Client("http://127.0.0.1:8000/mcp") as client:
             result = await client.call_tool("get_ticket", {"ticket_id": "T-1"})
             assert result.structured_content["id"] == "T-1"
     ```

   **Check:** every tool was called at least once with valid and invalid input, and the smoke test passes in CI.

8. **Secure it.** Read secrets from environment variables set in the client config `env`, never from `args` (visible in process lists) or tool parameters (visible in transcripts). Remote servers follow the MCP authorization spec (OAuth; validate the token audience and never pass client tokens through to upstream APIs). Default to read-only tools; mark destructive ones and require confirmation upstream.

   **Check:** `eag shield --file mcp_config.json` and a review of tool inputs find no secrets; destructive tools carry `destructiveHint: true`.

9. **Register it and name it for a global namespace.**

   Antigravity (`~/.gemini/config/mcp_config.json`, or a plugin's `mcp_config.json`):

   ```json
   { "mcpServers": {
       "acme-tickets": { "command": "node", "args": ["C:/tools/acme-tickets/build/index.js"],
                         "env": { "ACME_TOKEN_FILE": "C:/Users/me/.acme/token" } },
       "acme-search": { "url": "https://mcp.example.com/mcp" } } }
   ```

   Keep `mcp_config.json` free of literal secrets: point the server at a token file or a secret manager. (Gemini CLI expands `$VAR` and `${VAR}` in `env`; do not assume other hosts do.)

   Gemini CLI (`~/.gemini/settings.json` or `.gemini/settings.json`): `command`/`args`/`env`/`cwd` for stdio; **`httpUrl` for Streamable HTTP** (`url` there means SSE); optional `includeTools`, `excludeTools`, `timeout` (ms), `trust` (keep `false`). Or: `gemini mcp add --transport http -s user acme-search https://mcp.example.com/mcp`.

   Name servers `<org>-<service>` in kebab-case: Antigravity names collide globally across user config and plugins, and Gemini CLI builds `mcp_<server>_<tool>` names whose policy parser splits on underscores.

   **Check:** both hosts list the tools, and a natural prompt triggers the right one.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `console.log` or `print` in a stdio server | Log to stderr | Stdout carries the JSON-RPC stream |
| Mirror every REST endpoint | Workflow-level tools | More tokens, worse tool selection |
| Return whole records or pages | Paginate, select fields, structure output | Context bloat and truncation |
| Put secrets in `args` or tool inputs | `env`, or OAuth for remote servers | Process lists and transcripts leak them |
| Bind `0.0.0.0` for local development | `127.0.0.1` plus Host/Origin checks | LAN exposure and DNS rebinding |
| Raise generic exceptions for user errors | `ToolError` or `isError` with a recovery hint | The model only learns "it failed" |
| Name the server `db` or `my_server` | `acme-db` | Global collisions; underscore parsing in Gemini CLI |
| Leave destructive tools unannotated | `destructiveHint: true` and confirmation | Hosts cannot warn the user |

## Verification checklist

- [ ] SDK generation pinned; no v1 imports in a v2 project.
- [ ] Tool table reviewed; names are snake_case identifiers; descriptions state when to use each tool.
- [ ] Every tool has an input schema, structured output, annotations and tested error paths.
- [ ] Nothing writes to stdout in stdio mode.
- [ ] HTTP servers bind locally or sit behind auth and Host/Origin validation.
- [ ] No secrets in args, tool inputs or logs.
- [ ] Registered and exercised in Antigravity and Gemini CLI with prefixed, kebab-case server names.

## Related

- Knowledge: `antigravity-customization`, `api-design`, `auth-patterns`, `security-audit`, `google-adk`, `gemini-api`, `docker-containers`.
- Agents: `typescript-reviewer`, `python-reviewer`, `security-guard`, `test-engineer`.
- Workflows: `/tdd`, `/verify`, `/security-scan`.
