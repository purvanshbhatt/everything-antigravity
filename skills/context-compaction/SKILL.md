---
name: context-compaction
description: "Compact conversation history, deduplicate logs, strip terminal escape sequences, and extract architectural facts to conserve tokens."
---

# Context Compaction & Token Optimization

## Overview
Techniques and tools for managing long-running agent sessions, optimizing model prompt caches, and minimizing token consumption without losing critical facts.

## Compaction Mechanics
1. **ANSI & Formatting Cleanup**:
   - Strip terminal color codes (`\x1b[...]`), progress bar redraws, and verbose cursor control sequences.
2. **Repetitive Trace Deduplication**:
   - Collapse repeating compiler warnings and log polling outputs into concise frequency summaries (`... repeated 42 times ...`).
3. **Fact Extraction**:
   - Extract and retain absolute file paths, git commit hashes, error codes, and configuration parameters.
4. **Execution via EAG CLI**:
   ```bash
   python3 src/cli.py compact --file build.log --summary-only
   ```
