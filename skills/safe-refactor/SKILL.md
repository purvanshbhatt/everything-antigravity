---
name: safe-refactor
description: "Refactor legacy or complex codebases safely with characterization tests, micro-commits, and zero behavioral regressions."
---

# Safe Refactoring & Code Modernization

## Overview
Techniques for safely transforming code structure, improving maintainability, and paying down technical debt without altering external runtime behavior.

## Safe Refactoring Protocol
1. **Bracket with Tests**: Before touching production code, verify that comprehensive characterization tests cover existing behaviors (including quirky edge cases).
2. **Small Atomic Transformations**:
   - Extract Method / Extract Class.
   - Rename Symbol for semantic clarity.
   - Replace Primitive with Value Object.
   - Introduce Parameter Object.
3. **Verify at Each Step**: Run the full test suite after each atomic transformation. If a test breaks, undo immediately and understand why.
4. **Preserve Public API Contracts**: Deprecate legacy interfaces gracefully with shims rather than breaking downstream callers.
