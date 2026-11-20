# MCP SDK v1 vs v2 cheat sheet

v2 details come from the official SDK repositories and docs sites
(`ts.sdk.modelcontextprotocol.io/v2`, `py.sdk.modelcontextprotocol.io`) in
November 2026. v1 snippets come from the 2025 SDK docs and are here only for
maintaining existing servers. Confirm exact signatures in the API reference of
the version you pin.

## TypeScript

| Topic | v1 `@modelcontextprotocol/sdk` | v2 `@modelcontextprotocol/server` |
| :--- | :--- | :--- |
| Server class | `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"` | `import { McpServer } from "@modelcontextprotocol/server"` |
| stdio | `StdioServerTransport` from `.../server/stdio.js` | `StdioServerTransport` (or the `serveStdio` helper) from `@modelcontextprotocol/server/stdio` |
| `inputSchema` | Raw Zod shape: `{ a: z.number() }` | A schema object: `z.object({ a: z.number() })`; any Standard Schema library (Zod v4, Valibot, ArkType) |
| HTTP | `StreamableHTTPServerTransport` from `.../server/streamableHttp.js`, wired into Express | `createMcpHandler(() => server)` plus `@modelcontextprotocol/node`, `express`, `hono` or `fastify` adapters |

### v2 Streamable HTTP on plain Node

```ts
import { createServer } from "node:http";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";

const handler = createMcpHandler(() => {
  const server = new McpServer({ name: "acme-tickets", version: "1.0.0" });
  // server.registerTool(...)
  return server;                      // a fresh server per request: stateless by default
});

const nodeHandler = toNodeHandler(handler);
createServer((req, res) => nodeHandler(req, res)).listen(3000, "127.0.0.1");
// Clients call POST http://127.0.0.1:3000/mcp
```

The handler trusts its caller: it checks no `Host`, no `Origin` and no token.
On a loopback bind, compose the SDK's `localhostHostValidation` and
`localhostOriginValidation` in front of it (see the HTTP serving guide for the
exact composition), and add authorization before exposing it beyond localhost.
Sessions, resumability and scaling are covered in the "Sessions, state,
scaling" guide.

### v1 stdio server (legacy)

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "acme-tickets", version: "1.0.0" });
server.registerTool(
  "add",
  { title: "Add", description: "Add two numbers", inputSchema: { a: z.number(), b: z.number() } },
  async ({ a, b }) => ({ content: [{ type: "text", text: String(a + b) }] }),
);
await server.connect(new StdioServerTransport());
```

## Python

| Topic | v1 | v2 |
| :--- | :--- | :--- |
| Class | `from mcp.server.fastmcp import FastMCP` | `from mcp.server import MCPServer` (also `mcp.server.mcpserver`) |
| Context | `ctx: Context`, `ctx.fastmcp`, `get_context()` | `ctx: Context` from `mcp.server.mcpserver`; `ctx.mcp_server`; `get_context()` removed; logging helpers take `data` |
| Default name | `FastMCP` | `mcp-server` (pass a name) |
| Constructor | Many positional settings | `name` positional; everything else by keyword |
| Host, port, transport options | Constructor or `mcp.settings` | `run()` and the app methods (`host`, `port`, `streamable_http_path`, `stateless_http`, `json_response`, `transport_security`, ...) |
| Env config | `MCP_*` variables, `.env` | Not read any more |
| Tool errors | Exceptions become `isError` | `ToolError` (from `mcp.server.mcpserver.exceptions`) for model-visible errors; `MCPError` becomes a JSON-RPC error |
| Decorators | `@mcp.tool()`, `@mcp.resource()`, `@mcp.prompt()` | Same arguments and handler signatures |

### v2 run options

```python
mcp.run()                                             # stdio
mcp.run(transport="streamable-http", host="127.0.0.1", port=8000)   # /mcp by default
mcp.run(transport="streamable-http", stateless_http=True)           # no session tracking
```

- `json_response=True` answers each POST with one JSON body; calls that need
  the client mid-request (elicitation, sampling) then fail.
- DNS-rebinding protection turns on automatically for `127.0.0.1`,
  `localhost` and `::1` when no `transport_security` is passed.
- CLI: `mcp dev server.py` (Inspector), `mcp run server.py`, `mcp version`.
- Assigning a removed setting such as `mcp.settings.port = 9000` raises
  `ValueError`.

### v1 server (legacy)

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("acme-tickets")

@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two numbers."""
    return a + b

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

## Migration checklist

- [ ] Replace imports (`fastmcp` to `MCPServer`; `sdk/server/*.js` to `@modelcontextprotocol/server`).
- [ ] TS: wrap raw Zod shapes in `z.object(...)`.
- [ ] Python: move host, port and transport options from the constructor to `run()`.
- [ ] Python: raise `ToolError` where the model should see the message.
- [ ] Re-run the Inspector against every tool and update host configs if the endpoint path changed.
