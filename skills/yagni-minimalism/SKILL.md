---
name: yagni-minimalism
disable-model-invocation: true
description: >-
  Switches the session into minimal-solution mode until the user turns it off:
  before each change it tries deleting, reusing, configuring and the standard
  library before new code, adds no dependency, abstraction, flag or extension
  point nobody asked for, and re-reads each diff to strip speculative
  generality, never at the cost of correctness or security. Use when the user
  wants the simplest fix. Invoke with /yagni-minimalism.
---

# YAGNI Minimalism

A session mode, not a one-off task. While it is on, every change goes through a "smallest correct thing" filter: no code the current request does not need, no dependency the project can do without, and no structure built for a future nobody has asked for. The mode stays on across turns until the user switches it off.

## Switching

| The user says | Effect |
| :--- | :--- |
| `/yagni-minimalism` or `/yagni-minimalism on` | Mode on for the rest of the conversation; confirm in one line |
| `/yagni-minimalism off`, "normal mode" or "stop minimal mode" | Mode off; confirm in one line |
| `/yagni-minimalism status` | Report on or off and change nothing |
| `/yagni-minimalism persist` | Offer the workspace rule below so the mode survives new conversations; write it only after a yes |

If you are unsure whether the mode is still on, it is. An explicit user instruction beats the mode: when the user asks for an abstraction, a flag or a dependency, build it and state its cost once, in one line.

## When to use

- The user says "keep it simple", "smallest fix", "this is over-engineered", "no new dependencies" or "don't gold-plate".
- Scripts, internal tools, prototypes and early products, where speed of change matters more than extension points.
- A codebase already weighed down by wrappers, factories and options nobody uses.
- Working alongside a reviewer who keeps asking for less.

## When not to use

- Deleting existing dead code or duplication as a task of its own: `/refactor-clean`.
- Restructuring existing behaviour safely: `safe-refactor`.
- High-stakes, cross-cutting changes where rigor matters more than brevity: `/deep-work`. The two can run together; where they conflict, deep-work's gates win.
- Shaping a new feature from scratch: `/idea-to-design`, which has its own YAGNI pass.

## Workflow

1. **Turn the mode on and state the contract once.** Confirm in one line, for example: "Minimal mode on: smallest correct change, no new dependencies or abstractions without asking. Say `/yagni-minimalism off` to stop." Do not repeat the rules on later turns.

   **Check:** The user has seen the confirmation and the off switch.

2. **Before each change, climb the ladder.** Stop at the first rung that solves the request correctly.
   1. Is the change needed? Restate the request and confirm the change serves it.
   2. Can something be deleted instead? Removing a broken path, an unused option or a duplicate often fixes the problem.
   3. Does the project already have it? Use `grep_search` for an existing helper, component or pattern before writing a new one.
   4. Is it configuration? A setting or environment value the framework already supports.
   5. Does the standard library or platform do it? Prefer built-ins such as `fetch`, `URL`, `pathlib`, `datetime`, `encoding/json` or `std::fs` over a package.
   6. Is it a one- or two-line change at the call site?
   7. Only then: the smallest new code that does the job, placed in the file that uses it.

   **Check:** You can name the rung you stopped on and why each rung above it did not work.

3. **Apply the build limits while writing.**
   - No new dependency without asking. When asking, say what it replaces and roughly how large it is.
   - No new abstraction (interface, base class, factory, strategy, generic wrapper) before a third concrete use exists. Two similar blocks are fine.
   - No parameters, options or flags that no caller passes today.
   - No new file or layer when the code fits in an existing one.
   - No performance work without a measurement showing the need.
   - No comments that restate the code; keep comments that explain why.
   - Always keep: validation at trust boundaries, the error handling the request path needs, tests for the changed behaviour, security controls, accessibility and data-integrity checks. Minimal never means unsafe or untested.

   **Check:** Every added line serves the current request or one of the "always keep" items.

4. **Strip the diff before presenting it.** Re-read `git diff` (or the edit set) as a skeptical reviewer and remove unused imports and parameters, branches for states that cannot occur, wrappers that only forward calls, configuration nothing reads, defensive copies of data nothing mutates, and single-caller helpers that read better inline. Re-run the affected tests afterwards.

   **Check:** A second read finds nothing more to remove, and the tests still pass.

5. **Report in one or two lines.** Name the rung and the size, for example: "Reused `formatMoney` from `src/lib/format.ts`; +6 / -14 lines; no new dependencies." When the simplest path has a real cost (a known limit, a later migration, a performance ceiling), say so in one line so the user can choose otherwise.

   **Check:** The report names the rung, the line delta and any new dependencies (normally none), plus any real cost.

6. **Switch off on request.** Confirm in one line. Do not go back and expand earlier work unless asked.

   **Check:** Later turns no longer apply the ladder or the limits.

## Persisting the mode (optional)

Only when the user wants the mode to survive new conversations, and only after a yes, write this workspace rule to `.agents/rules/yagni-minimalism.md`. Deleting the file turns the mode off for good. An always-on rule is charged against the rules budget on every turn, so keep it this short.

```markdown
---
trigger: always_on
---

# Minimal-solution mode
- Solve each request with the smallest correct change: delete, reuse, configure or use the standard library before writing new code.
- Add no dependency, abstraction, option or extension point the request does not need; ask before adding a dependency.
- Never cut validation at trust boundaries, required error handling, tests, security or accessibility to save lines.
- Re-read the diff and strip speculative generality before presenting it.
```

## Examples

| Request | Over-built answer | Minimal answer |
| :--- | :--- | :--- |
| Parse an ISO date from a CLI flag | A date library plus a `DateParser` class | `datetime.fromisoformat(value)` or `new Date(value)` with a validity check |
| Retry one flaky HTTP call | A generic retry framework with pluggable policies | The HTTP client's built-in retry option, or a three-attempt loop with backoff in that one function |
| Hide a button from guests | A feature-flag service integration | A condition on the existing role check |
| Read one environment variable | A config module with schema and loaders | Read it once at startup and fail fast when it is missing |
| The same 8-line block appears twice | A shared abstract base class | Leave both; extract when a third copy appears |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Drop error handling to shrink the diff | Keep the handling the request path needs | Brevity that fails in production is not simple |
| Skip tests because the change is small | Test the changed behaviour | Small untested changes are the ones that regress quietly |
| Golf code into clever one-liners | Write short, plain, readable code | Minimal means less to understand, not fewer characters |
| Refuse an abstraction the user asked for | Build it and note the cost once | The user's explicit request beats the mode |
| Rewrite working code to be more minimal | Apply the ladder to new changes only | Unrequested churn is the opposite of minimal |
| Announce the mode on every turn | Confirm once at on and once at off | Repetition is exactly the filler the mode removes |

## Verification checklist

- [ ] The mode change was confirmed in one line when switched on and off.
- [ ] Each change names the ladder rung it stopped on.
- [ ] No dependency was added without the user's yes.
- [ ] No unused parameter, option, layer or single-implementation interface was added.
- [ ] Validation at trust boundaries, required error handling, tests and security controls are intact.
- [ ] Each diff was re-read and stripped, and the affected tests pass afterwards.
- [ ] Real costs of the simple path were stated.

## Related

- Workflows: `/refactor-clean`, `/deep-work`, `/idea-to-design`, `/code-review`, `/tdd`, `/dependency-upgrades`.
- Knowledge: `safe-refactor`, `tech-debt`, `antigravity-customization`.
