---
name: issue-triage
description: >-
  Triages bug reports and issues: collects the backlog, reproduces each
  report, classifies type and area, finds duplicates, assigns a justified
  priority, and rewrites confirmed bugs as actionable tickets with steps,
  evidence and acceptance criteria. Use when the user says "triage these
  issues", "is this a real bug", "clean up the backlog" or pastes a vague bug
  report. Invoke with /issue-triage.
---

# Issue Triage

Turn a pile of reports into a short, ranked list of reproducible, deduplicated
tickets that someone can pick up without asking a question. Triage decides what
happens next; it does not fix anything.

## When to use

- A new or vague report arrived: "it doesn't work", a screenshot only, a stack trace with no steps.
- The backlog has unlabelled, stale or duplicate issues and needs a pass.
- Before sprint planning or a release, to confirm what is actually broken and how badly.
- A support escalation must become an engineering ticket.

## When not to use

- Finding the root cause of a confirmed bug: use `/root-cause`.
- Fixing it: `/build-fix` for a red build, `/tdd` or `/feature-dev` for the change.
- Production is down now: follow `incident-response` first, triage afterwards.
- Security vulnerability reports: handle privately (`security-audit`, the project's SECURITY.md), never in a public thread.

## Workflow

1. **Collect the set.** Agree on scope: one issue, a label, or "everything untriaged". With the GitHub CLI:

   ```bash
   gh issue list --state open --search "no:label" --limit 100 --json number,title,createdAt,comments
   gh issue view 123 --comments
   ```

   For GitLab use `glab issue list`; for Jira or Linear use their MCP server or a CSV export. Track progress in a triage-table artifact (id, title, status).

   **Check:** Every in-scope issue appears exactly once in the table.

2. **Screen for missing information.** A triageable report has environment (version, OS, browser), steps, expected vs actual, and evidence (log, screenshot, request id). For each gap you cannot infer, draft a needs-info comment naming the exact fields required.

   **Check:** Each row is "complete" or has a drafted comment listing named gaps (never "please provide more details").

3. **Reproduce.** Use the smallest environment that matches the report: check out the reported version (`git checkout v1.4.2`) or the default branch, run the steps, capture output. Drive the Antigravity browser for UI bugs and keep screenshots. For many issues, delegate one reproduction per subagent with the issue text and expected/actual; each returns `REPRODUCED | NOT REPRODUCED | BLOCKED` plus evidence. Shrink to a minimal reproduction (fewest steps, smallest input).

   **Check:** Each issue has a repro status with evidence (output, failing test, screenshot path). "Works for me" states the exact environment tried.

4. **Classify.** Type: `bug`, `regression`, `feature`, `question`, `docs`, `chore`. Area: the owning module (locate it with `grep_search` on the error text or route). For regressions, find the introducing commit with `git bisect start <bad> <good>` and `git bisect run <test-command>`.

   **Check:** Every item has one type and one area; regressions name the first bad commit.

5. **Deduplicate.** Match on evidence, not wording: same error string, stack frame or endpoint.

   ```bash
   gh issue list --state all --search "\"cannot read properties of undefined\" in:title,body" --limit 20
   ```

   Keep the oldest issue with the best reproduction as canonical; link the rest to it.

   **Check:** Each duplicate names its canonical issue and the shared evidence.

6. **Prioritize.** Use the matrix below, then adjust: regression +1 level, data loss or security always P0/P1, workaround available -1 level.

   **Check:** Each item has a priority with a one-line justification.

7. **Write the ticket.** Rewrite each confirmed issue with the template below. Acceptance criteria must be testable.

8. **Apply changes only with consent.** Present the triage table and drafted comments as an artifact. Labels, comments, assignments and closures are visible to other people: get explicit user confirmation, then apply.

   ```bash
   gh issue edit 123 --add-label "bug,area:auth,P1"
   gh issue comment 123 --body-file triage-123.md
   gh issue close 456 --reason "not planned" --comment "Duplicate of #123"
   ```

   **Check:** `gh issue view <n>` shows the new state; nothing was changed without the user's go-ahead.

## Priority matrix

| Severity \ Reach | Most users | Some users | Few / edge case |
| :--- | :--- | :--- | :--- |
| Data loss, security, outage | P0 | P0 | P1 |
| Core flow broken, no workaround | P0 | P1 | P2 |
| Broken with workaround | P1 | P2 | P3 |
| Cosmetic or minor annoyance | P2 | P3 | P3 |

P0: drop current work. P1: this cycle. P2: planned. P3: backlog or `good first issue`.

## Ticket template

```markdown
**Summary:** <one sentence: what breaks, for whom>
**Environment:** <version/commit, OS, browser, flags>
**Steps to reproduce:**
1. ...
**Expected:** ...
**Actual:** ... (error text verbatim, request id)
**Evidence:** <log excerpt, failing test, first bad commit abc1234>
**Scope:** <who is affected, how often, workaround>
**Acceptance criteria:**
- [ ] <observable behaviour that proves the fix>
- [ ] A regression test covers the reproduction above
**Priority:** P1 (<justification>)  **Area:** auth  **Type:** regression
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Label from the title alone | Reproduce, or mark NOT REPRODUCED with the environment tried | Titles mislead; many "bugs" are config or version issues |
| Ask "can you provide more details?" | Ask for the specific missing field | Vague asks get vague answers or silence |
| Close as duplicate on similar wording | Match on frame, message or endpoint | False duplicates bury real bugs |
| Prioritize by who shouts loudest | Severity x reach matrix with written justification | Consistent priorities survive review |
| Bulk-close stale issues silently | Propose the list, state the reason, get approval | Closing is public and discourages reporters |
| Paste raw logs into public tickets | Redact tokens, emails and customer ids first | Trackers are often public or widely readable |

## Verification checklist

- [ ] Every in-scope issue has repro status, type, area, priority and justification.
- [ ] Duplicates point at a canonical issue with shared evidence.
- [ ] Confirmed bugs use the ticket template with testable acceptance criteria.
- [ ] Needs-info comments ask for named fields only.
- [ ] No label, comment or closure was applied without explicit user confirmation.
- [ ] Logs and screenshots in tickets are redacted.

## Related

- Workflows: `/root-cause`, `/build-fix`, `/tdd`, `/e2e`, `/release-management`.
- Knowledge: `open-source-maintenance`, `customer-support`, `incident-response`, `git-workflow`, `browser-automation`.
- Agents: `codebase-explorer`, `e2e-runner`, `product-manager`.
