---
name: sandbox-isolation
description: "Configure OS-level sandboxing, containerized tool execution, network egress controls, and least-privilege agent policies."
---

# Sandbox Isolation & Runtime Security

## Overview
Enforces strict containment boundaries for agent operations, ensuring file operations and terminal executions occur within restricted sandboxes.

## Isolation Mechanisms
1. **OS-Level Containers (Docker / Podman / bubblewrap)**:
   - Mount only target workspace folders; keep root filesystem read-only.
   - Drop all Linux capabilities except those strictly required for compilation/testing.
2. **Network Egress Filtering**:
   - Disallow outbound internet access during build and unit test runs unless explicitly authorized.
   - Enforce domain allowlists for API calls.
3. **Antigravity Sandbox Policy**:
   - Configure Antigravity's `enableTerminalSandbox: true` in user settings.
   - Restrict command execution to non-root user contexts with ephemeral scratch storage.
