---
name: mutation-testing
disable-model-invocation: true
description: >-
  Measures whether tests actually catch bugs by injecting small faults with
  Stryker, mutmut, PIT or cargo-mutants, scoped to changed code first, then
  triages surviving mutants into equivalent, missing assertion or untested
  branch and writes targeted tests to kill the ones that matter. Use when
  coverage looks high but bugs still escape, before trusting a suite for a
  refactor, or to gate test quality in CI.
---

# Mutation Testing

Coverage says a line ran; mutation testing says whether any test would notice if that line were wrong. The tool makes many small edits to the code (flip `<` to `<=`, drop a call, return a constant), runs the tests against each one, and reports the mutants that survived. Survivors point at assertions that are missing or too weak.

## When to use

- Coverage is high, yet regressions still reach review or production.
- Before a large refactor, to confirm the suite will catch behaviour changes.
- Reviewing a PR whose tests look thin: run mutants on the changed files only.
- Setting a test-quality gate in CI that is harder to game than a coverage percentage.

## When not to use

- No tests exist yet, or the suite is red: write tests first with `/tdd` or find gaps with `/test-coverage`.
- The suite is flaky: mutation results will be noise until `flaky-test-triage` is done.
- Exploring unusual inputs for a pure function: use `property-based-testing`.
- The suite takes many minutes per run and cannot be scoped: speed it up first (`python-testing`, `golang-testing`, `rust-testing`).

## Workflow

1. **Check the preconditions.** The suite must be green, deterministic and reasonably fast, because the tool runs it once per mutant (with per-test coverage it runs only the tests that reach each mutant). Time one full run and note it.

   **Check:** Two consecutive runs are green and take about the same time.

2. **Pick the tool and the scope.** Start with the files changed against the main branch, or one module. A full-repository run comes later, on a schedule.

   | Stack | Tool | Changed-code run |
   | :--- | :--- | :--- |
   | JS / TS | Stryker (`@stryker-mutator/core` plus a runner plugin) | `npx stryker run --mutate "src/cart.ts,src/price.ts"` and `--incremental` |
   | C# | Stryker.NET | `dotnet stryker` with its `--since` option for changed code |
   | Python | mutmut | Set `paths_to_mutate` to the changed modules, then `mutmut run` |
   | Java / Kotlin (JVM) | PIT (pitest) | `mvn test-compile org.pitest:pitest-maven:scmMutationCoverage`, or `targetClasses` for one package |
   | Rust | cargo-mutants | `git diff origin/main > pr.diff`, then `cargo mutants --in-diff pr.diff` |
   | Go | gremlins or go-mutesting | Point the tool at one package directory |

   Build the changed-file list from Git:

   ```bash
   npx stryker run --mutate "$(git diff --name-only origin/main -- 'src/*.ts' ':!*.test.ts' | paste -sd, -)"
   ```

   ```powershell
   $files = (git diff --name-only origin/main -- 'src/*.ts' ':!*.test.ts') -join ','
   npx stryker run --mutate $files
   ```

   Setup snippets for each tool are in [tool setup](references/tool-setup.md).

   **Check:** The tool's dry run or `--list` mode shows a mutant count you can afford: mutants times the time of the tests that cover them fits your budget.

3. **Run it in the background and collect the report.** Start long runs with `run_command` in the background and keep working. Reports land in `reports/mutation/` (Stryker), `target/pit-reports/` (PIT), `mutants.out/` (cargo-mutants, with `missed.txt` and `caught.txt`), and `mutmut results` / `mutmut show <id>` for mutmut.

   **Check:** You have the score and the list of surviving and uncovered mutants, each with file, line and the exact change.

4. **Triage every survivor.** Read the mutated line and the tests that reached it, then put the mutant in exactly one class from the triage table below. Record the class and a one-line reason in a table in the walkthrough artifact.

   **Check:** Every survivor has a class and a reason; none is labelled equivalent without an argument for why no input can tell the difference.

5. **Kill the meaningful survivors.** For missing assertions and untested branches, write a test that checks the behaviour the mutant breaks: exact values, boundaries, error types and side effects. Name the test for the behaviour, not the mutant. Delegate batches to the `test-engineer` subagent with the survivor table and the files.

   **Check:** Re-running the tool on the same file reports those mutants as killed, and the new tests fail if you apply the mutant by hand.

6. **Resolve the rest honestly.** For equivalent mutants, either simplify the code so the redundant variant disappears, or suppress the mutant with the tool's comment and a reason. For mutants in dead code, delete the code. For low-value mutants (log text, metric names), exclude them by configuration rather than one by one.

   **Check:** Every suppression has a written reason, and `grep_search` for the suppression marker shows no bare suppressions.

7. **Gate it in CI.** On pull requests, run on changed files only with a break threshold. Run the full project on a schedule and ratchet the threshold up as the score improves. Never lower a threshold to make a build pass without the user's agreement.

   **Check:** A PR that adds untested logic fails the mutation job, and the scheduled job publishes the report.

## Triage table

| Class | What it looks like | Action |
| :--- | :--- | :--- |
| No coverage | No test executes the mutated line | Add a test for that path, or delete the code if it is unreachable |
| Missing assertion | Tests run the line but never check its result or side effect | Assert the exact value, state change or call |
| Weak assertion | `toBeTruthy()`, `is not None`, snapshot that ignores the field | Replace with an exact expectation |
| Untested boundary | `<` to `<=` survives; tests never use the edge value | Add cases at, just below and just above the boundary |
| Untested error path | Removing a `throw` or an error mapping survives | Assert the error type and message |
| Equivalent | No input can observe the difference (`i != n` versus `i < n` in a loop stepping by 1) | Simplify the code, or suppress with a reason |
| Redundant code | Removing the line changes nothing because something else already does the job | Delete the redundant code |
| Timeout | The mutant made a loop run forever | Usually counts as killed; confirm the timeout factor is sane |

**Score.** Mutation score = killed (including timeouts) divided by (all mutants minus equivalent and unviable ones). Do not chase 100%: some equivalents always remain, and the last few percent cost far more than they return. Typical gates start around 60% on changed code and ratchet up.

## Writing a killing test

```ts
// Survivor: `if (qty >= 10)` mutated to `if (qty > 10)` in bulkDiscount(); no test used qty = 10.
test('bulk discount starts at exactly ten units', () => {
  expect(bulkDiscount({ qty: 9, unitCents: 1000 })).toBe(0);
  expect(bulkDiscount({ qty: 10, unitCents: 1000 })).toBe(1000);   // 10% of 10 x 1000
});
```

The test describes a business rule (the discount starts at ten), which is why it kills the mutant. A test that only asserted "a discount exists for large orders" would let the mutant live.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Run the whole repository on every PR | Changed files or incremental mode on PRs; full runs on a schedule | Runtime grows with mutants times tests |
| Chase a 100% score | Set a realistic gate and ratchet it | Equivalent mutants make 100% impossible or wasteful |
| Write tests that target the mutation itself | Test the behaviour the mutant breaks | Mutant-shaped tests are brittle and explain nothing |
| Suppress survivors in bulk | Triage each one and record the reason | Suppressions hide the exact gaps the tool found |
| Run on a flaky suite | Fix flakiness first | Random failures "kill" mutants and inflate the score |
| Treat the score as a target for people | Use survivors as review input | A gamed score stops measuring anything |

## Verification checklist

- [ ] The suite was green and deterministic before the run, and its runtime was recorded.
- [ ] The run was scoped (changed files, one module or incremental) and its cost estimated.
- [ ] Every survivor was classified with a reason in the walkthrough.
- [ ] Meaningful survivors are killed by behaviour-named tests, confirmed by a re-run.
- [ ] Equivalent mutants were simplified away or suppressed with written reasons; dead code was deleted.
- [ ] The score before and after is reported, and any CI threshold change was agreed with the user.

## Related

- Workflows: `/test-coverage`, `/tdd`, `/verify`, `/code-review`.
- Knowledge: `property-based-testing`, `flaky-test-triage`, `tdd-testing`, `python-testing`, `rust-testing`, `java-modern`, `ci-cd-github-actions`.
- Agents: `test-engineer`.
