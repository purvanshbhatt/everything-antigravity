# /learn - Continuous Instinct Learning & Memory Persistence

## Purpose
The `/learn` command captures winning patterns, validated optimizations, and domain heuristics from completed tasks, persisting them as reusable instincts and local skills.

## Execution Sequence
1. **Insight Extraction**:
   - Analyze recent execution steps, test results, bug resolutions, and performance gains.
   - Extract recurring project conventions (naming patterns, framework nuances, environment traps).
2. **Instinct Formulation**:
   - Synthesize extracted insights into concise, actionable engineering rules.
   - Format: `[Context/Trigger] -> [Action/Standard] -> [Reason/Benefit]`.
3. **Memory & Rule Persistence**:
   - Append distilled rules to relevant topic files in `rules/` (e.g. `rules/engineering.md`, `rules/token-optimization.md`).
   - If a new specialized capability emerged, scaffold a new skill using the standard `SKILL.md` format.
4. **Context Keeper (`ck`) Sync**:
   - Update repository checkpoint in `commands/checkpoint.md` so subsequent agent sessions immediately inherit recorded learnings.
