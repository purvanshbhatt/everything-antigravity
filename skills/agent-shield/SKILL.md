---
name: agent-shield
description: "Real-time security guardrails, adversarial prompt injection defense, and dangerous action interception for Antigravity agents."
---

# AgentShield Security Guardrails

## Overview
AgentShield serves as the first line of defense for Google Antigravity agents, inspecting prompts, tool inputs, and terminal commands before execution.

## Defense Layers
1. **Adversarial Prompt Injection Detection**:
   - Analyzes incoming messages for override patterns: instruction negation, roleplay jailbreaks, boundary escalation attacks.
   - Quarantines suspicious inputs and falls back to safe default instructions.
2. **Terminal Command Interception**:
   - Blocks destructive shell sequences (`rm -rf /`, piping untrusted remote scripts to `sh`, partition writes).
   - Validates that commands run within authorized workspace directory bounds.
3. **Automated Tool Permission Checks**:
   - Enforces read-only permissions on sensitive host filesystem directories (`/etc`, `~/.ssh`, root system paths).

## Usage & Verification
Run the built-in scanner:
```bash
python3 src/agent_shield.py
```
Or via CLI:
```bash
python3 src/cli.py shield --file path/to/input.txt
```
