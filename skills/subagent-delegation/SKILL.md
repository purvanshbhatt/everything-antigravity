---
name: subagent-delegation
description: "Coordinate hierarchical parent-subagent topologies, bound execution depth, and isolate deep context investigations from main thread."
---

# Subagent Delegation & Hierarchical Topologies

## Overview
Architect multi-tier agent hierarchies where a parent coordinator delegates deep, noisy investigations or multi-file edits to isolated subagents, protecting the parent context window.

## Delegation Rules
1. **Context Isolation**:
   - Subagents explore directories, read verbose documentation, and run compile-check loops in their own context thread.
   - The subagent sends back only high-signal final reports (what changed, verification results, known risks) to the parent.
2. **Bounded Depth**:
   - Limit nested subagent depth (default: $\le 3$) to prevent infinite delegation loops.
3. **No Interim Chitchat**:
   - Subagents do not send status spam; they perform their mission and return their findings upon completion.
