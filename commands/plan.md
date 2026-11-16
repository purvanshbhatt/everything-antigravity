# /plan - Structured Engineering Architecture & Strategy Planning

## Purpose
The `/plan` command executes disciplined pre-implementation planning following the ECC loop: `plan -> test -> implement -> review -> verify -> remember -> improve`.

## Execution Sequence
1. **Scope Definition & Constraints**:
   - Extract exact requirements and operational boundaries from the task prompt.
   - Clarify ambiguous requirements or verify with user before modifying critical code.
2. **Architecture & Dependency Mapping**:
   - Identify affected modules, interfaces, schema boundaries, and third-party dependencies.
   - Design contracts (APIs, types, data schemas) prior to drafting implementation logic.
3. **Risk & Failure Mode Analysis**:
   - Enumerate boundary conditions, security risks (credentials, prompt injection, command injection), and performance bottlenecks.
   - Establish mitigation strategies and circuit breakers.
4. **Step-by-Step Implementation Roadmap**:
   - Break work down into atomic, testable increments with explicit stop conditions.
   - Specify automated unit/integration test cases that must pass at each gate.
5. **Review Gate**:
   - Confirm architecture alignment with Lead Code Architect (`agents/code-architect.md`) and Security Guard (`agents/security-guard.md`).
