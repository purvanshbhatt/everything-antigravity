---
name: antigravity-sdk-orchestrator
description: "Build, configure, and orchestrate autonomous AI agents using the Google Antigravity Python SDK, tools, and lifecycle hooks."
---

# Google Antigravity SDK Orchestrator

## Overview
Develop and deploy autonomous agents using Google Antigravity (`google-antigravity` package), Gemini 1.5 / 2.0 models, tool bindings, and state persistence.

## SDK Architecture & Patterns
1. **Agent Setup**:
   ```python
   from antigravity import LocalAgentConfig, Agent

   config = LocalAgentConfig(
       model="gemini-2.0-flash",
       agent_behavior="autonomous",
       max_subagent_depth=3
   )
   async with Agent(config) as agent:
       response = await agent.run("Implement feature X with full TDD")
   ```
2. **Custom Tool Binding**:
   - Register Python functions as agent tools with clean typing and docstrings.
   - Antigravity automatically transforms function signatures into JSON Schema tool declarations.
3. **Lifecycle Hooks**:
   - Intercept pre-turn and post-turn events to audit operations, track token budgets, and log telemetry.
4. **Error Recovery & Exponential Backoff**:
   - Handle transient network errors and rate limits gracefully using configured retry policies.
