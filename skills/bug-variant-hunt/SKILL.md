---
name: bug-variant-hunt
disable-model-invocation: true
description: >-
  Takes one confirmed bug or vulnerability, abstracts it into a source, sink and
  missing-guard pattern, sweeps the codebase for siblings with grep, Semgrep or
  CodeQL, then proves or refutes every hit with evidence and ranks confirmed
  variants by reachability and impact. Use after a fix lands, when asking
  "where else does this happen", or before closing an incident. Invoke with
  /bug-variant-hunt.
---

# Bug Variant Hunt

A bug that was written once was usually written several times: copied, generated from the same template, or produced by the same misunderstanding of an API. This workflow turns one confirmed defect into a search pattern, sweeps for its siblings and returns a ledger in which every candidate is either proven or refuted. The output is evidence, not a list of grep hits.

## When to use

- A bug or security finding was just fixed and the user asks "are there more like this?" or "where else do we do this?".
- A postmortem or security advisory needs a statement that the class of bug is gone, not only the instance.
- A scanner or reviewer found one instance of a risky API misuse (unsanitized path join, missing authz check, unchecked return value, unbounded allocation).
- Before backporting a fix to other services or branches that share code.

## When not to use

- No confirmed seed bug yet, only a symptom: run `/root-cause` first.
- A broad security sweep with no particular pattern in mind: `/security-scan` or `security-audit`.
- Writing or tuning scanner rules for CI as the main goal: `static-analysis`.
- Reviewing a single diff for defects: `/code-review`.
- Testing a live system you do not own or lack written permission to test: stop; see `web-pentest-authorized`.

## Workflow

1. **Pin the seed.** Collect the seed bug's file and line, the fixing commit or patch, the repro or failing test, and the impact. Write a seed card in the variant ledger (template below):
   - **Source:** where the bad value or state comes from (request parameter, file content, environment, another service).
   - **Sink:** the operation that misbehaves when it receives that value (file open, SQL, shell, deserializer, allocation, authz decision).
   - **Missing guard:** the check, normalization or invariant whose absence made it a bug.
   - **Preconditions:** auth level, feature flags, configuration.

   **Check:** A teammate could take any code snippet and decide from the card alone whether it matches the bug.

2. **Generalize in tiers.** Write the pattern at three levels and search from narrow to broad:
   - *Exact:* the same function or call shape as the seed.
   - *Structural:* the same sink reached through other wrappers, aliases or helper functions.
   - *Semantic:* any code that lets this kind of source reach this kind of sink without the guard, whatever the API.

   List the sinks by name for each language in the repo, and list the guards that make a hit safe, so triage can be quick.

   **Check:** Each tier has at least one concrete query, and the guard list is explicit.

3. **Set the scope.** Decide what to sweep: the current repo, sibling services that share code, vendored copies, older release branches that still ship. Exclude generated code and fixtures unless they ship. Look for copies in history, because copied code often keeps the bug:

   ```bash
   git log -S "parseUploadPath(" --oneline --all       # commits that added or removed the call
   git grep -n "parseUploadPath(" origin/release/2.x    # search another branch without checking it out
   ```

   For a large or multi-repo sweep, delegate each scope to a `codebase-explorer` subagent with the seed card and the tier queries, and ask for raw hits with `file:line` only.

   **Check:** The scope is written in the ledger, including what was excluded and why.

4. **Build queries and prove they find the seed.** Start with text search, then move to structure.

   ```bash
   git grep -nE "path\.join\([^)]*req\.(params|query|body)" -- "*.ts" "*.js"
   rg -n --type py "open\(.*request\."
   ast-grep -p 'exec($CMD)' -l js
   semgrep scan --config rules/variant.yaml --json --output variants.json
   ```

   For a Semgrep rule, add a test file with `# ruleid: <id>` on lines that must match and `# ok: <id>` on lines that must not, then run `semgrep --test rules/`. For data-flow problems that cross files, a CodeQL taint query fits better:

   ```bash
   codeql database create cq-db --language=javascript --source-root .
   codeql database analyze cq-db queries/variant.ql --format=sarif-latest --output=variants.sarif
   ```

   Run every query against the pre-fix revision (`git worktree add ../seed-prefix <fix-sha>^`) and remove that worktree afterwards with `git worktree remove ../seed-prefix`.

   **Check:** Each query matches the seed on the pre-fix revision and does not match it after the fix. A query that misses the seed is wrong and must be fixed before you trust its silence.

5. **Triage every hit by reading code.** For each candidate, open the code with `view_file`, trace backwards from the sink to an entry point, and look for the guard on that path. Classify it:
   - **Confirmed:** reachable from a real entry point, no guard on the path, impact understood.
   - **Refuted:** guard present (cite `file:line`), input is constant or trusted, or the code is unreachable (cite why).
   - **Needs runtime:** static reading cannot decide. Say what experiment would decide it.

   Record every candidate in the ledger, including refuted ones, so nobody re-checks them later.

   **Check:** No hit is left unclassified, and every refutation cites a line or a reason.

6. **Prove the confirmed variants.** Write a failing test per variant (or one parametrized test) that drives the real entry point with a crafted input, in a local or test environment only. Never send probes to production or third-party systems. If a test is impractical, capture a debugger trace or log output that shows the bad value reaching the sink.

   **Check:** Each confirmed variant has a test or trace that fails on current code, and the ledger links to it.

7. **Rank by impact.** Score each confirmed variant on reachability and consequence using the table below, then order the ledger. Note preconditions that lower risk (admin-only, feature flag off by default).

   **Check:** The ranking can be defended from the ledger alone, without re-reading the code.

8. **Fix the class, not just the instances.** Prefer moving the guard to one choke point (a safe wrapper, a validated type, a framework middleware) over patching each call site. Apply the fix test-first with `/tdd`. Add the variant query to CI so the pattern cannot return (see `static-analysis`). For security variants, ask the user before filing anything public; route them through the project's private disclosure or security advisory process.

   **Check:** All variant tests pass, the CI rule runs green on the fixed tree and red on the pre-fix revision, and `/verify` passes.

9. **Report.** Deliver the ledger as a walkthrough artifact: seed card, scope, queries, the confirmed variants ranked with evidence, the refuted list, open "needs runtime" items, and the fix and prevention.

   **Check:** The report states the number of hits, confirmed, refuted and open, and those numbers add up.

## Variant ledger template

```markdown
# Variant hunt: <seed title>
## Seed
- Location / fix: src/upload.ts:88 · fixed in <sha>
- Source: request path parameter `name`
- Sink: fs.createReadStream(path.join(root, name))
- Missing guard: resolve then check the result stays under root
- Preconditions: authenticated user
## Scope
- Swept: this repo (main, release/2.x), shared-lib. Excluded: test fixtures (not shipped)
## Queries
| Tier | Tool | Query or rule | Finds seed pre-fix? |
| :--- | :--- | :--- | :--- |
## Candidates
| # | Location | Status | Evidence | Reach | Impact | Rank |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| V1 | src/export.ts:41 | confirmed | test export.spec.ts::"rejects ../" | remote, auth | file read | 1 |
| V2 | src/avatar.ts:17 | refuted | guard at src/avatar.ts:12 (basename) | - | - | - |
## Fix and prevention
```

## Ranking guide

| Reachability | Weight | Consequence | Weight |
| :--- | :--- | :--- | :--- |
| Remote, unauthenticated | 4 | Code execution, auth bypass, cross-tenant data | 4 |
| Remote, any authenticated user | 3 | Data read or write beyond the user's rights | 3 |
| Privileged user or internal caller only | 2 | Denial of service, data corruption in own scope | 2 |
| Local, build-time or test-only | 1 | Incorrect output, log noise | 1 |

Rank by the product of the two weights; break ties by how easy the input is to craft.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Report raw grep hits as findings | Classify every hit with evidence | Unproven hits waste reviewers' time and erode trust |
| Trust a query that returns nothing | Prove it matches the seed on the pre-fix revision | A silent broken query looks like a clean codebase |
| Drop refuted candidates from the report | Keep them with the reason | Someone will re-check them next quarter |
| Search only for the exact call | Search structural and semantic tiers too | Variants hide behind wrappers and helpers |
| Patch each call site separately | Move the guard to one choke point | The next copy of the code gets the guard for free |
| Probe production to confirm | Reproduce locally or in a test environment | Unauthorized testing causes harm and legal risk |
| Open public issues for security variants | Use private disclosure, with the user's consent | Public issues hand attackers a map |

## Verification checklist

- [ ] The seed card names source, sink, missing guard and preconditions.
- [ ] Every query was shown to match the seed on the pre-fix revision.
- [ ] Scope and exclusions are written down.
- [ ] Every hit is confirmed, refuted with a cited reason, or marked "needs runtime" with the deciding experiment.
- [ ] Each confirmed variant has a failing test or trace, and all now pass after the fix.
- [ ] A CI rule or test guards against the pattern returning.
- [ ] Temporary worktrees are removed and nothing public was filed without the user's consent.

## Related

- Workflows: `/root-cause`, `/tdd`, `/verify`, `/security-scan`, `/code-review`, `/threat-modeling`, `/postmortem`.
- Knowledge: `static-analysis`, `security-audit`, `web-pentest-authorized`, `git-workflow`.
- Agents: `codebase-explorer` (breadth sweeps), `security-guard` (exploitability review), `silent-failure-hunter` (swallowed-error variants).
