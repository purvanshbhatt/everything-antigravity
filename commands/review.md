# /review - Senior Code Review & Regression Analysis

## Purpose
Executes a rigorous, line-by-line review of staged git diffs or designated files, identifying logic bugs, concurrency flaws, performance bottlenecks, and style deviations.

## Checklist
1. Verify edge conditions: empty collections, nulls, division by zero, network timeouts.
2. Check error handling: no generic `except: pass` or swallowed exceptions.
3. Review performance: no nested loops over database calls ($O(N)$ query loops).
4. Enforce format: provide location, severity, problem description, and exact copy-pasteable fix.
