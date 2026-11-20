# Worked delegation briefs

## 1. Exploration (read-only, one agent)

```text
Delegate to: codebase-explorer
Goal:        Find every code path that writes to the `orders.status` column.
Why:         We are adding an audit trail and must hook every writer.
Known:       ORM models live in src/models/; src/models/order.py defines Order.status.
Ruled out:   No raw SQL in src/api/ (searched for "UPDATE orders").
Scope:       src/, scripts/, migrations/        Out of scope: tests/, vendored code
Constraints: Read-only. No commands except searches.
Budget:      30 tool calls. If exceeded, return what you have with Result: BLOCKED.
Return:      Result line; Evidence list of file:line with the writing statement;
             Not checked section.
Done when:   Every assignment to status, bulk update and raw SQL write is listed.
```

Verify: open two cited lines and one file the agent marked "no writes".

## 2. Parallel review (fan-out, same contract)

```text
Delegate to: code-reviewer (one per shard, launched together)
Shard A:     src/auth/**        Shard B: src/payments/**        Shard C: src/api/**
Goal:        Find correctness and security defects introduced by this branch.
Why:         Pre-merge gate for PR 1234.
Known:       Diff base is origin/main; acceptance criteria are in docs/plan.md.
Constraints: Read-only. Review only files in your shard; read callers elsewhere if needed.
Budget:      40 tool calls per shard.
Return:      Verdict line, then findings as
             [BLOCKER|MAJOR|MINOR] path:line - problem - trigger - fix.
             At most 15 findings. "Not reviewed" section.
```

Merge: deduplicate by `path:line`, rank by severity, reproduce every BLOCKER
before reporting it.

## 3. Bounded fix with verification (one writer)

```text
Delegate to: build-error-resolver
Goal:        Make `npm run build` pass on this branch.
Known:       Failure started after upgrading zod to v4; errors are in src/schemas/.
Ruled out:   Lockfile is consistent (`npm ci` succeeds).
Scope:       May edit src/schemas/** only. Do not change package.json or tests.
Budget:      25 tool calls or 3 build attempts.
Return:      Result line; Changes list (file, change, why);
             final `npm run build` output tail (last 20 lines).
Done when:   Build exits 0 with no new type suppressions (no `any`, no ts-ignore).
```

Verify: run `npm run build` and the schema tests yourself, and read the diff:
fixes that silence the type checker are not fixes.

## 4. Unanchored second opinion

```text
Delegate to: code-architect
Goal:        Assess whether src/sync/queue.ts can lose messages under concurrent workers.
Constraints: Read-only. Do not assume any particular bug exists.
Return:      Either a concrete interleaving that loses a message (steps and lines),
             or "no loss found" with the invariants you checked.
```

Note what is missing: your own theory. Compare its answer with yours only after
it returns.
