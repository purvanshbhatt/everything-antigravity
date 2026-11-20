---
name: safe-refactor
description: >-
  Changes code structure without changing behaviour: characterization and
  approval tests, a refactoring catalogue with safety ratings, strangler fig,
  parallel change, branch by abstraction, feature flags, micro-commits,
  codemods (jscodeshift, ts-morph, ast-grep, LibCST, gofmt -r, gopls) and ways
  to prove zero behaviour change. Use when refactoring legacy or risky code,
  renaming across a codebase, or migrating an API or library incrementally.
---

# Safe Refactoring

A refactoring is only safe if you can prove behaviour did not change. Pin the
current behaviour first, move in steps small enough to revert individually,
let tools do mechanical edits, and keep the build green after every step.

## When to use

- Restructuring legacy code with weak or no tests.
- Renames, moves and signature changes that touch many files.
- Migrating callers from an old API, library or module to a new one without a big-bang switch.
- Replacing a subsystem while it stays in production (strangler fig).

## When not to use

- Deleting dead code, unused exports and duplicate utilities: use `/refactor-clean`.
- Fixing a bug: write the failing test with `/tdd` first; do not mix bug fixes into a refactoring commit.
- Deciding the target structure: use `software-architecture` (this skill moves you there safely).
- Formatting-only changes: run the formatter in its own commit.

## Workflow

1. **Define the invariant and the boundary.** Write down what must not change (public API, outputs, side effects, performance budget) and the exact files in scope. Present the plan, including the step list, as an implementation-plan artifact if the change spans more than a few files.

   **Check:** The scope is a list of files or symbols, and the invariant is testable.

2. **Pin current behaviour with characterization tests.** Call the code with representative and edge inputs, record what it does today (including odd behaviour), and assert exactly that. For large outputs use approval or snapshot tests (ApprovalTests, Jest or Vitest snapshots, `syrupy` for pytest, `insta` for Rust). Weird behaviour gets a test named `characterizes_...` and a note, not a fix.

   **Check:** The characterization tests pass on the untouched code, and mutating a line in scope makes at least one fail (try one by hand or run a mutation tool on the scope).

3. **Choose the technique by blast radius** (table below). Callers you control: refactor directly with micro-commits. Callers you don't control or can't change at once: parallel change or branch by abstraction. Whole subsystem: strangler fig behind a facade or routing layer, with a feature flag for cutover.

   **Check:** You can say how to roll back each step.

4. **Let tools do mechanical edits.** Use the IDE or language server rename and move operations, or a codemod for repetitive patterns (see [codemods](references/codemods.md)). Review the codemod's dry-run output before writing.

   **Check:** The codemod diff touches only the intended pattern; spot-check five random hunks.

5. **Move in micro-commits.** One refactoring per commit, build and tests green after each, message prefixed `refactor:` and stating "no behaviour change". If a step turns red and the cause isn't obvious within a few minutes, revert the step and take a smaller one.

   **Check:** `git log --oneline` shows a sequence of small, single-purpose commits, each of which passed the test suite.

6. **Prove zero behaviour change.** Run the full suite plus characterization tests; diff the public API surface; compare outputs on recorded inputs; for hot paths, compare benchmarks. For strangler or parallel-run migrations, shadow-compare old and new results in production before switching reads.

   **Check:** Every item in the verification checklist below holds, with command output to show for it.

## Refactoring catalogue with safety ratings

| Refactoring | Safety with IDE or LSP in typed code | Safety by hand or in dynamic code | Watch for |
| :--- | :--- | :--- | :--- |
| Rename symbol | High | Medium | Reflection, string-based lookups, serialized names, public API |
| Extract function / variable | High | High | Changed evaluation order or short-circuiting |
| Inline function / variable | High | Medium | Side effects evaluated a different number of times |
| Move function / class | High | Medium | Import cycles, module side effects on import |
| Change signature (add parameter with default) | High | Medium | Positional callers, overloads, keyword-only args |
| Introduce parameter object | Medium | Medium | Mutation of the object by callees |
| Replace conditional with polymorphism | Medium | Low | Missing cases, default branch behaviour |
| Split phase / split loop | Medium | Medium | Loop-carried state, performance |
| Replace primitive with value object | Medium | Low | Equality, hashing, serialization |
| Change data structure or storage format | Low | Low | Persisted data, wire formats: use parallel change |

### Techniques for wide changes

| Technique | Steps | Use when |
| :--- | :--- | :--- |
| Parallel change (expand, migrate, contract) | Add the new form beside the old; migrate callers in batches; remove the old once usage is zero | Signature, schema or API changes with many callers |
| Branch by abstraction | Introduce an interface over the old implementation; build the new one behind it; flip; delete old | Replacing a library or component in place |
| Strangler fig | Route a slice of traffic or features to the new system through a facade; grow the slice; retire the old | Replacing a subsystem or service |
| Feature flag | Guard the new path with a flag (OpenFeature or your provider), default off; ramp; remove the flag | Any step where rollback must be instant |
| Shadow / parallel run | Run old and new, return old, log differences (GitHub's Scientist pattern) | Proving equivalence on real traffic |

Flags are debt: every flag gets an owner and a removal date when it is created.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Refactor and fix bugs in the same commit | Separate commits: characterize, refactor, then fix with its own test | A behaviour change hidden in a refactor cannot be reviewed or reverted cleanly |
| Big-bang rewrite on a long branch | Strangler fig or parallel change on trunk | Long branches drift, conflict and ship all risk at once |
| Find-and-replace across the repo with regex | LSP rename or an AST codemod | Text replacement hits comments, strings and unrelated symbols |
| Update characterization tests when they fail mid-refactor | Treat the failure as a behaviour change and revert the step | The tests are the only proof of safety |
| Remove the old API in the same release that adds the new one | Deprecate, migrate, measure zero usage, then remove | External callers break without warning |
| Leave feature flags forever | Removal date and owner at creation | Dead branches multiply test paths and confuse readers |

## Verification checklist

- [ ] Characterization tests existed and passed before the first structural edit.
- [ ] Every commit is a single refactoring with a green build and tests.
- [ ] Full test suite and characterization tests pass at the end, unchanged.
- [ ] Public API surface is unchanged, or the change follows parallel change with deprecation.
- [ ] Codemod output was dry-run reviewed and spot-checked.
- [ ] No behaviour changes or bug fixes are mixed into refactoring commits.
- [ ] Temporary flags, shims and adapters have an owner and a removal date.

## Related

- Workflows: `/refactor-clean`, `/tdd`, `/verify`, `/code-review`, `/checkpoint` (save state between steps).
- Knowledge: `tdd-testing`, `software-architecture`, `git-workflow`, `api-design` (deprecation and versioning).
- Agents: `refactor-cleaner`, `code-reviewer`, `test-engineer`, `typescript-reviewer`, `python-reviewer`, `go-reviewer`.
