---
name: fresh-context-loop
disable-model-invocation: true
description: >-
  Runs an autonomous build loop in which every iteration starts from a fresh
  context: it reads a backlog file and a progress log, implements the
  highest-priority unfinished story, runs typecheck and tests, commits on green
  and records what it learned, until every story passes or a hard iteration cap
  is hit. Works on a dedicated branch or worktree and never pushes. Use for a
  backlog of small, testable stories. Invoke with /fresh-context-loop.
---

# Fresh Context Loop

Long single sessions degrade: early decisions get compacted away and the agent starts contradicting itself. This loop avoids that by handing each story to a brand-new agent context whose only memory is on disk: a backlog file, a progress log and the git history. Each iteration reads those files, finishes one story, writes the files back and exits.

## When to use

- A backlog of roughly 5 to 30 small stories, each provable by automated checks (tests, typecheck, lint).
- The user says "work through this list", "keep going until all of these pass", "run it in a loop" or "let it run overnight".
- A long feature whose total work would overflow the useful context of one conversation.
- Mechanical but varied work: endpoint by endpoint, component by component, module by module.

## When not to use

- Fewer than about three stories, or a story that needs design judgment: `/feature-dev` or `/deep-work`.
- Work that fans out into parallel shards and merges inside one session: `/orchestrate`.
- Stories without automated acceptance checks: write the plan and tests first with `/blueprint` and `/tdd`.
- Anything that touches production, shared databases or deployments. The loop never runs unattended there.

## Workflow

1. **Set the guardrails before any code.** Agree with the user on the following and write them into `.loop/config.md`:
   - an isolated workspace: a dedicated branch (`git switch -c loop/<name>`) or, better, a worktree (`git worktree add ../<repo>-loop -b loop/<name>`);
   - a hard iteration cap (default 10) and a time or spend budget;
   - the gate commands every iteration must pass, for example `npm run typecheck && npm test`, `pytest -q`, `go vet ./... && go test ./...` or `cargo clippy -- -D warnings && cargo test`;
   - the paths the loop may change;
   - the fixed rules: never push, never rewrite history, never edit CI config, gate commands or test settings, never skip or delete tests.

   Add `.loop/run.log` to `.git/info/exclude` so driver output is never committed.

   **Check:** `git branch --show-current` prints the loop branch, the gates pass on the starting commit, and the user approved the caps.

2. **Write the backlog.** Create `.loop/backlog.json` with one entry per story, using the schema under Reference. Each story fits one iteration (one sitting, roughly 200 changed lines at most), lists acceptance criteria as commands or observable results, and names its dependencies. Ask the user to review the order and sizing, and split anything the sizing table flags.

   **Check:** Every story has `"passes": false`, at least one machine-checkable criterion and no dependency cycle.

3. **Write the iteration contract.** Create `.loop/iteration.md`, the only instructions a fresh iteration receives. Start from the template in [references/iteration-contract.md](references/iteration-contract.md): read the loop files and recent history, pick one eligible story, implement it test first, run the gates, commit code and loop files together on green, mark the story blocked after repeated failure, and end with exactly one status line (`LOOP-STATUS: DONE <id>`, `LOOP-STATUS: BLOCKED <id>` or `LOOP-STATUS: COMPLETE`).

   **Check:** Someone with no other context could run one iteration from `iteration.md` alone.

4. **Run one iteration attended.** Execute the contract once while the user watches, then inspect the result:

   ```bash
   git log -1 --stat
   git diff HEAD~1 -- .loop/backlog.json
   tail -n 20 .loop/progress.md
   ```

   ```powershell
   git log -1 --stat
   git diff HEAD~1 -- .loop/backlog.json
   Get-Content .loop/progress.md -Tail 20
   ```

   If the iteration wandered, tighten the contract or split the story, and ask the user before discarding that iteration's work.

   **Check:** Exactly one story flipped to `"passes": true`, exactly one commit was added, and the progress entry records what changed and one learning.

5. **Run the loop.** Pick the driver:
   - **Antigravity, attended or semi-attended:** the main agent is only the driver. For each iteration it delegates to a fresh subagent that has write tools, with the brief "Follow `.loop/iteration.md` exactly and reply with its final status line only", then reads back the status line and `git log -1 --oneline`. The main context grows by about one line per iteration.
   - **Gemini CLI, unattended:** a shell loop starts one non-interactive session per iteration. Bash and PowerShell drivers are in [references/iteration-contract.md](references/iteration-contract.md). Non-interactive sessions need an approval mode that permits file edits and the gate commands: choose the narrowest one `gemini --help` lists, and run inside the worktree or a sandbox (see `sandbox-isolation`).

   **Check:** The driver stops on `COMPLETE`, at the iteration cap, after two `BLOCKED` results in a row, or when a status line is missing.

6. **Audit every iteration.** After each iteration (or each batch when unattended), confirm: one new commit; gates still green at `HEAD`; only allowed paths changed (`git diff --stat HEAD~1`); no tests skipped or deleted (audit commands under Reference). If any check fails, stop the loop and report. Never let the next iteration build on a bad commit.

   **Check:** Every loop commit passed the audit, or the loop stopped at the first one that did not.

7. **Close out.** On the full branch diff, run `/verify full` and `/code-review`, or delegate the review to the `code-reviewer` subagent when the diff is large. Report to the user: stories done, stories blocked with their reasons, notable learnings from `progress.md` and the review findings. Offer `/pr-ready`; push or open a PR only after the user says yes. Remove the worktree with `git worktree remove` only after the user confirms the branch is merged or no longer needed.

   **Check:** The report gives every story's final state, and nothing was pushed without consent.

## Reference

### Backlog schema

```json
{
  "project": "billing-api",
  "stories": [
    {
      "id": "S3",
      "priority": 1,
      "title": "Reject invoices with a negative line total",
      "criteria": [
        "pytest tests/test_invoices.py::test_negative_total_rejected passes",
        "POST /invoices with a negative line total returns 422"
      ],
      "dependsOn": ["S1"],
      "passes": false,
      "blocked": null
    }
  ]
}
```

### Progress log entry

```markdown
## 2026-11-23 14:05 · S3 · DONE · a1b2c3d
- Changed: validation in `invoices/schema.py`; test in `tests/test_invoices.py`.
- Learned: money fields are `Decimal`; compare with `Decimal("0")`, never `0.0`.
- For the next iteration: S4 edits the same schema; reuse `NonNegativeMoney`.
```

### Story sizing

| Signal | Action |
| :--- | :--- |
| Criteria need more than three commands | Split the story |
| Touches more than about five files or two modules | Split by module |
| Title starts with "investigate", "decide" or "design" | Not a loop story; resolve it with the user first |
| Needs an external service or a credential | Stub it, or keep it out of the loop |

### Stop conditions

| Condition | Driver action |
| :--- | :--- |
| `LOOP-STATUS: COMPLETE` | Stop and go to step 7 |
| Iteration cap or budget reached | Stop and report the remaining stories |
| Two `BLOCKED` results in a row | Stop and show both reasons to the user |
| No status line in the output | Stop; the iteration crashed or ignored the contract |
| Audit fails (red gates, extra paths, weakened tests) | Stop at once; do not continue on that commit |

### Weakened-test audit

```bash
git diff HEAD~1 | grep -nE '^\+.*(\.skip\(|\.only\(|xit\(|@pytest\.mark\.skip|t\.Skip\(|#\[ignore\])'
git diff HEAD~1 --diff-filter=D --name-only | grep -iE 'test|spec'
```

```powershell
git diff HEAD~1 | Select-String -Pattern '^\+.*(\.skip\(|\.only\(|xit\(|@pytest\.mark\.skip|t\.Skip\(|#\[ignore\])'
git diff HEAD~1 --diff-filter=D --name-only | Select-String -Pattern 'test|spec'
```

Any hit stops the loop until the user has reviewed it.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Let one long context work through the whole backlog | A fresh context per story, with state on disk | Long contexts drift and lose early decisions |
| Write stories without machine-checkable criteria | Commands or observable results in every story | The loop cannot tell done from plausible |
| Run on `main` or another shared branch | A dedicated branch or worktree | A bad iteration lands where others build |
| Start without an iteration cap | A hard cap plus a budget | A stuck loop spends money retrying the same failure |
| Let iterations edit tests or gates to get green | Audit for skipped and deleted tests | Green by weakening is a hidden regression |
| Keep looping after a failed audit | Stop at the first bad commit | Later iterations stack on the defect |
| Push or merge automatically at the end | `/pr-ready` after the user agrees | Unreviewed autonomous code reaches other people |
| Log only "done" in the progress file | Record changes, learnings and hand-off notes | The next fresh context has nothing else to go on |

## Verification checklist

- [ ] The loop ran on a dedicated branch or worktree with an agreed iteration cap and budget.
- [ ] Every story had machine-checkable criteria and fit one iteration.
- [ ] One attended iteration was inspected before the loop ran.
- [ ] Each loop commit holds exactly one story and passed the gates and the weakened-test audit.
- [ ] The final branch passed `/verify full` and `/code-review`.
- [ ] Nothing was pushed, merged or deleted without the user's explicit yes.

## Related

- Workflows: `/orchestrate`, `/feature-dev`, `/blueprint`, `/tdd`, `/verify`, `/code-review`, `/pr-ready`, `/checkpoint`.
- Knowledge: `subagent-delegation`, `sandbox-isolation`, `git-workflow`, `context-compaction`.
- Agents: `code-reviewer`, `test-engineer`.
