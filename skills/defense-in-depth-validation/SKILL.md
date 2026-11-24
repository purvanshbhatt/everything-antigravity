---
name: defense-in-depth-validation
disable-model-invocation: true
description: >-
  Hardens code after a bad-data bug is root-caused by adding a check at every
  layer the data crosses: schema parsing at the entry point, invariants in
  domain types, context guards before destructive operations, database
  constraints and diagnostic logging at the failure point, each with its own
  test. Use after fixing a bug caused by invalid input, an empty path, a wrong
  environment or a missing ID.
---

# Defense-in-Depth Validation

One fixed code path does not stop the next caller from sending the same bad value. After the root cause is known, trace every layer the bad data passed through and give each layer a check that would have stopped it on its own. The aim is to make the whole class of bug structurally hard to repeat, while keeping each check cheap, loud and tested.

## When to use

- A bug was traced to bad data: an empty string, a null ID, a relative path, a negative amount, a production URL in a test.
- A destructive operation (delete, truncate, send, charge, migrate) ran with the wrong target.
- The same invalid value has caused more than one incident through different callers.
- Hardening a code path that handles money, files, credentials or tenant data.

## When not to use

- The cause is not yet known: run `/root-cause` first, then come back.
- Designing validation for a new form or API from scratch: `forms-validation` and `api-security`.
- Threat-driven security review of a whole feature: `threat-modeling` or `/security-scan`.
- Errors are being swallowed somewhere: delegate to the `silent-failure-hunter` subagent first.

## Workflow

1. **Trace the data path.** Starting from the root cause, list every layer the bad value crossed: where it entered (HTTP handler, CLI flag, queue message, file import, environment variable), each function that passed it on, and the sink where the damage happened (database write, file operation, external call). Use `grep_search` for the variable and the functions that receive it.

   **Check:** You have an ordered list of layers from entry to sink, with file and line for each.

2. **Decide the rule once.** Write the invalid condition as a single named predicate or schema, for example "workspace path is absolute, normalized and inside the workspace root". All layers reuse this definition, so the rule cannot drift between them.

   **Check:** The rule lives in one module, and every later layer imports it rather than restating it.

3. **Layer 1: reject at the entry point.** Parse untrusted input into a typed value with a schema (Zod, Valibot, Pydantic, JSON Schema, Bean Validation). Return a clear client error with the field name. Do not pass raw input deeper.

   **Check:** A test sends the original bad input to the entry point and gets a specific validation error, and nothing below the entry point runs.

4. **Layer 2: make invalid domain values unconstructable.** Give the value a type whose constructor or factory enforces the rule (`WorkspacePath`, `Money`, `TenantId`). Business functions accept the type, not a raw string or number.

   **Check:** A test calls the business function directly, bypassing the entry layer, and the bad value is still refused.

5. **Layer 3: guard the irreversible operation.** Immediately before the destructive or external action, check the context, not only the value: the environment, the target's location, the database name, the recipient domain. Refuse loudly when the context is wrong.

   **Check:** A test calls the sink directly with a wrong context (for example a path outside the temp directory during tests) and the operation is refused before anything changes.

6. **Layer 4: let storage enforce what it can.** Add `NOT NULL`, `CHECK`, foreign key and unique constraints for the rule where the database can express it. Treat schema changes on shared databases as migrations that need the user's confirmation (see `database-migrations`).

   **Check:** A direct insert of the bad value fails with a constraint error in a test database.

7. **Layer 5: make any escape diagnosable.** At the point where the original failure surfaced, add a log or error that names the rule, the offending value (or its shape, if sensitive), the request or job ID and the caller. Log once, at the layer that handles the error; inner layers throw typed errors without logging.

   **Check:** Triggering the failure produces exactly one log entry with enough context to find the caller, and no secrets.

8. **Test each layer in isolation, then end to end.** Each layer gets a test that bypasses the layers above it. Add one end-to-end test with the original bad input as the regression test.

   **Check:** Disabling any single layer still leaves at least one other test red, and the regression test fails on the old code.

## Example: an empty path that deleted the wrong directory

The bug: a job read `BUILD_DIR` from the environment, got an empty string, joined it with `"out"`, resolved it relative to the working directory and removed the repository's `out/` folder.

```ts
import path from 'node:path';
import os from 'node:os';
import { rm } from 'node:fs/promises';
import { InvalidPath, UnsafeOperation } from './errors'; // small Error subclasses carrying the rule and value

// Rule, defined once (layer 2): absolute, normalized, inside an allowed root.
export class WorkspacePath {
  private constructor(readonly value: string) {}
  static parse(raw: string | undefined, root: string): WorkspacePath {
    if (!raw || !raw.trim()) throw new InvalidPath('path is empty', raw);
    if (!path.isAbsolute(raw)) throw new InvalidPath('path must be absolute', raw);
    const resolved = path.resolve(raw);
    const rel = path.relative(path.resolve(root), resolved);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) throw new InvalidPath(`path must be inside ${root}`, raw);
    return new WorkspacePath(resolved);
  }
}

// Context guard at the sink (layer 3): in tests, only ever delete under the OS temp dir.
export async function removeTree(target: WorkspacePath): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    const rel = path.relative(os.tmpdir(), target.value);
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new UnsafeOperation(`refusing to delete ${target.value} outside the temp dir during tests`);
  }
  await rm(target.value, { recursive: true, force: true });
}
```

Layer 1 parses `BUILD_DIR` at startup with `WorkspacePath.parse` and exits with a message naming the variable. Layer 5 logs the job ID and the resolved path once, in the job runner that catches `UnsafeOperation`.

## Where checks belong

| Layer | Checks | Cost rule |
| :--- | :--- | :--- |
| Entry (API, CLI, queue, file, env) | Shape, types, ranges, required fields, size limits | Always; this is the trust boundary |
| Domain types | Invariants that define a valid value | Once at construction, then trusted |
| Business logic | Preconditions that depend on state (balance, ownership, status) | Where the decision is made |
| Sink guards | Environment, target location, recipient, tenant, dry-run flags | Before every irreversible action |
| Storage | Constraints the database can express | Always for core invariants |
| Diagnostics | Context at the failure point | Once per handled error |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Write the rule differently in each layer | Define it once and reuse it | Divergent copies disagree on edge cases |
| Log the error at every layer | Throw typed errors; log once where handled | Duplicate alerts hide the real count and the origin |
| Silently clamp or default bad values | Fail loudly with the rule and the value | Silent fixes turn crashes into data corruption |
| Validate every internal call with ad hoc checks | Validate at boundaries; use types inside | Noise slows code and readers without adding safety |
| Rely on the entry point alone | Guard the sink as well | New callers (jobs, scripts, tests) skip the entry point |
| Put secrets or full payloads in error messages | Log the field name, shape and IDs | Logs are widely readable and long-lived |

## Verification checklist

- [ ] Every layer between entry and sink was listed, with file and line.
- [ ] The rule is defined once and reused by each layer.
- [ ] Entry validation, domain type, sink guard and (where possible) storage constraint are in place.
- [ ] Each layer has a test that bypasses the layers above it.
- [ ] The original bad input is a regression test that failed before the change.
- [ ] One log entry with context, and no secrets, is produced when the guard fires.
- [ ] Schema changes on shared databases were confirmed with the user before running.

## Related

- Workflows: `/root-cause`, `/tdd`, `/security-scan`, `/code-review`.
- Knowledge: `forms-validation`, `api-security`, `database-design`, `database-migrations`, `threat-modeling`, `typescript-patterns`.
- Agents: `silent-failure-hunter`, `security-guard`.
