---
name: tdd-testing
description: "Execute Test-Driven Development (TDD), unit, integration, and fuzz testing with strict verification discipline."
---

# Test-Driven Development (TDD) & Quality Assurance

## Overview
Rigorous methodologies for developing software through automated test cycles, regression proofing, and deterministic testing harnesses.

## The TDD Red-Green-Refactor Cycle
1. **Red**: Write a minimal test specifying the desired behavior or reproducing the reported bug. Run the test and confirm that it fails for the expected reason.
2. **Green**: Write the simplest possible implementation that makes the test pass. Avoid speculative generalizations.
3. **Refactor**: Clean up the implementation, improve readability, extract helpers, and ensure all tests remain green.

## Rules of Engagement
- **Never Weaken Tests to Pass**: If an existing test fails after a change, treat it as a signal of a regression. Do not alter assertions or skip tests to make a build look clean.
- **Isolate External I/O**: Use mocks, fakes, or in-memory fixtures for network calls, external APIs, and clock dependencies.
- **Edge Case Coverage**: Explicitly test empty collections, negative numbers, boundary thresholds, malformed JSON, and unexpected exceptions.
