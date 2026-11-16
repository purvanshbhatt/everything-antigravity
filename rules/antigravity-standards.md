# Antigravity Standards & Conventions

1. **Native Directory Structure**: Respect user directories at `~/.gemini/antigravity/` and scratch paths at `~/.gemini/antigravity/scratch/`.
2. **Model Context Protocol (MCP)**: Wire tools and databases through MCP standards (`mcp.json`) to allow seamless multi-tool orchestration.
3. **Structured Tool Outputs**: Return machine-readable JSON or typed schemas from tools for dependable agent interoperability.
4. **Declarative Safety Policies**: Register pre-turn and post-turn hooks to enforce security boundaries across all subagent calls.
