---
name: code-review
disable-model-invocation: true
description: >-
  Reviews a diff, branch, pull request or set of files for correctness,
  security, performance and maintainability defects, and returns ranked
  findings with exact patches. Use when the user asks for a review, before
  opening or merging a PR, or after a large or risky edit. Invoke with /code-review.
---

# Code Review

Find the defects that would hurt in production, prove each one, and hand back
patches that can be applied as-is. A review that lists twenty style nits and
misses one data-loss bug has failed.

## When to use

- The user says "review", "check my changes", "is this safe to merge", or "look over this PR".
- Before `/pr-ready`, and as the last step of `/feature-dev`.
- After a large refactor, a dependency upgrade, or any change to auth, payments, migrations or concurrency.

## When not to use

- Formatting or lint-only feedback: run the project's formatter and linter instead.
- A full security assessment of a whole codebase: use `/security-scan`.
- Finding why something is broken: use `/root-cause`. Review judges a change; it doesn't debug one.

## Workflow

1. **Establish the change set.** Prefer the narrowest scope that covers the request.

   ```bash
   git status --short
   git diff --stat                      # unstaged
   git diff --staged --stat             # staged
   git merge-base HEAD origin/main      # then: git diff <base>...HEAD --stat for a branch review
   ```

   If the user named files or a PR, review exactly those. For PRs, `gh pr diff <n>` when `gh` is available.

   **Check:** You can state the list of changed files and the approximate lines changed.

2. **Load intent before judging code.** Read the PR description, linked issue, commit messages (`git log --oneline <base>..HEAD`) and any implementation-plan artifact. Write down the acceptance criteria in one or two lines; every finding is judged against them.

   **Check:** You can say what the change is supposed to do and what it must not break.

3. **Triage by risk, then read in that order.** Data writes, migrations, auth and permission checks, money, concurrency, external input parsing, and deletion paths come first. Tests, docs and renames come last. For large diffs (more than ~800 lines or 25 files), split the files into groups and delegate each group to the `code-reviewer` subagent with the acceptance criteria. Then merge and deduplicate the findings yourself.

   **Check:** Every high-risk file has been read in full, not just its diff hunk. Read surrounding callers with `grep_search` when a signature or contract changed.

4. **Hunt systematically.** Walk each risky hunk through the defect checklist below, and trace at least one caller and one callee for every changed function signature.

5. **Prove before you report.** For each suspected defect, either point to the exact line and input that triggers it, or write and run a failing test or snippet. Drop anything you cannot substantiate, or file it as a `QUESTION`, not a bug.

   **Check:** Each `BLOCKER` or `MAJOR` finding has a concrete trigger (an input, state or sequence).

6. **Run the project's own gates** if they're cheap: type-check, lint and the tests touching the changed code (see `/verify` for per-ecosystem commands). A red gate becomes a finding.

7. **Write the report** using the output format below. Lead with the verdict. Order findings by severity, then by confidence.

## Defect checklist

| Area | Look for |
| :--- | :--- |
| Correctness | Off-by-one, inverted conditions, unhandled `null`/`undefined`/`None`, wrong default, integer overflow, float money math, timezone and DST assumptions, mutation of shared or default arguments |
| Error handling | Swallowed exceptions, `catch` that logs and continues into corrupt state, missing `await`, unhandled promise rejections, retries without idempotency |
| Concurrency | Check-then-act races, missing transactions or locks, non-atomic read-modify-write, goroutine/task leaks, unbounded parallelism |
| Data and migrations | Destructive migrations without a backfill or rollback, `NOT NULL` added without a default on large tables, N+1 queries, missing indexes on new filters, unbounded `SELECT` |
| Security | Injection (SQL, shell, path, template), missing authz check on new endpoints, IDOR, secrets in code or logs, SSRF via user URLs, unsafe deserialization, weakened CORS or CSP |
| API contracts | Breaking response or schema changes without versioning, changed error codes, removed fields still used by clients |
| Performance | Work inside hot loops, sync I/O on request paths, quadratic algorithms on user-sized input, missing pagination or caching where the old code had it |
| Tests | New behaviour without tests, assertions weakened or deleted to pass, snapshot churn hiding regressions, tests that can't fail |
| Maintainability | Dead code, duplicated logic that will drift, misleading names, comments that contradict the code |

## Output format

```markdown
## Verdict: REQUEST CHANGES | APPROVE WITH NITS | APPROVE
<one-sentence summary of the change and the main risk>

### Findings
1. **[BLOCKER] Short title** — `path/to/file.ts:42`
   - **Problem:** what is wrong and the concrete trigger (input/state/sequence).
   - **Impact:** what breaks, for whom, how badly.
   - **Fix:**
     ```ts
     // exact replacement code
     ```
2. **[MAJOR] ...**
3. **[MINOR] ...**
4. **[NIT] ...** (max 5 nits; drop the rest)
5. **[QUESTION] ...** (something you could not prove either way)

### Gates
- typecheck: pass | fail (`command`) · lint: ... · tests: X passed, Y failed (`command`)

### Not reviewed
- <files or areas skipped and why>
```

Severity scale:

- **BLOCKER:** data loss, a security hole, a crash on a common path, or a broken build. Must fix before merge.
- **MAJOR:** wrong behaviour on a realistic path, or a missing test for new logic.
- **MINOR:** edge-case bug or clear maintainability debt.
- **NIT:** taste or style. Never more than five.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Review only the diff hunks | Open the full function and its callers | Most real bugs live at the boundary between changed and unchanged code |
| Report "might be a race condition" | Name the interleaving that breaks it, or file it as a QUESTION | Unprovable findings erode trust and waste the author's time |
| Paste a 40-item list | Rank, merge duplicates, cap nits at 5 | Authors fix the top of the list and ignore the rest |
| Suggest a rewrite | Give the smallest patch that fixes the defect | Large rewrites in review stall merges and add new risk |
| Approve because the tests pass | Check that the tests can fail and actually cover the new branches | Green tests that never exercise the change prove nothing |
| Edit the code yourself mid-review | Report, then offer to apply fixes after the user agrees | A review must be a stable artifact the author can respond to |

## Verification checklist

- [ ] Acceptance criteria were written down before findings.
- [ ] Every high-risk file was read in full, with callers checked for changed signatures.
- [ ] Each BLOCKER and MAJOR has a file:line, a concrete trigger and an exact fix.
- [ ] Project gates were run, or the report says why not.
- [ ] Nits are capped at five, and the verdict matches the worst finding.
- [ ] A "Not reviewed" section lists anything skipped.

## Related

- Agents: `code-reviewer` (parallel shard reviews), `security-guard` (deep security pass), plus the language reviewers `typescript-reviewer`, `python-reviewer` and `go-reviewer`.
- Workflows: `/verify` (gates), `/security-scan`, `/pr-ready`, `/root-cause`.
- Knowledge: `security-audit`, `tdd-testing`, `safe-refactor`.
