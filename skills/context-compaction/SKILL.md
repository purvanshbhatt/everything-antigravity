---
name: context-compaction
description: >-
  Keeps long sessions sharp: when and how to compact, what to keep, handoff notes and session save and resume.
---

# Context Compaction

Context is working memory, not an archive. Every token of stale logs and
superseded plans competes with the facts that matter, and long sessions start
to forget decisions and repeat work. Compact on purpose at milestones: keep
decisions and evidence, drop raw material, and start fresh with a handoff when
compaction is no longer enough.

## When to use

- The session is long and the agent repeats searches, forgets a decision, or contradicts an earlier conclusion.
- A tool returned a huge build log, test run or file dump.
- A milestone was reached (exploration done, plan approved, feature verified) or the task is changing.
- Authoring skills or rules that must stay cheap to load.

## When not to use

- Persisting a whole session for later: `/session-save` and `/session-resume` (this skill writes the summary they store).
- Committing progress: `/checkpoint`.
- Cutting API spend inside an application: `llm-cost-routing`.
- Keeping noisy work out of context in the first place: `subagent-delegation`.

## Workflow

1. **Recognise the moment.** Compact after a milestone, after a large tool output, when the session nears about 75% of its context window, or when EAG's PreInvocation hook suggests it. Do not compact in the middle of debugging while you still need the raw error text.

   **Check:** you can name the milestone or trigger.

2. **Decide what stays.**

   | Keep verbatim | Keep as a one-line summary | Drop |
   | :--- | :--- | :--- |
   | Goal, acceptance criteria, user instructions, approvals and preferences | Decisions, each with its reason | Raw logs and full file dumps |
   | First occurrence of each exact error; failing test names | Ruled-out hypotheses ("not X, because Y") | Superseded plans and drafts |
   | Paths touched; commands that verify the work | Current state of each work item | Duplicate tool output, progress bars |
   | Commit hashes, PR numbers, URLs, IDs | Facts from docs, with their source path | Dead-end exploration details |
   | Open questions, blockers, next step | | Status chatter |

   Never compact away user constraints, security-relevant facts, or the label saying whether a claim was verified.

   **Check:** the summary answers what we are doing, what is done, what was decided, what is next, and how to verify it.

3. **Trim tool output at the source.** Filter before output enters the context.

   ```bash
   npm test 2>&1 | tail -n 60
   grep -nE "error|FAIL" build.log | head -n 50
   pytest -q --maxfail=1
   git diff --stat
   ```

   ```powershell
   npm test 2>&1 | Select-Object -Last 60
   Select-String -Path build.log -Pattern "error|FAIL" | Select-Object -First 50
   ```

   Prefer quiet reporters, read files by line range with `view_file` after a `grep_search`, and hand big log triage to a subagent that returns only the conclusion.

   **Check:** no single tool result in context runs to more than a few hundred lines.

4. **Clean logs with the EAG compactor.** Use `eag compact` (or `node <plugin-root>/bin/eag.js compact`):

   ```bash
   eag compact --file build.log                 # cleaned text, then a "Compacted: X → Y chars" line
   eag compact --file build.log --summary-only  # only the size reduction
   make build 2>&1 | eag compact                # from stdin
   ```

   ```powershell
   eag compact --file build.log --summary-only
   Get-Content build.log -Raw | eag compact
   ```

   What it does:
   - Strips ANSI escape and OSC sequences.
   - Turns bare carriage returns (progress bars) into separate lines.
   - Collapses runs of consecutive identical lines (compared after trimming trailing whitespace) into one line with a `[xN]` count.
   - Collapses three or more blank lines into one.

   What it does not do:
   - Remove repeats that are not adjacent.
   - Merge lines that differ only by timestamps, counters or percentages.
   - Summarise meaning. That part is still your job, or a subagent's.

   **Check:** `--summary-only` reports a reduction, and `grep` still finds every error line in the cleaned text.

5. **Write the milestone summary, then checkpoint.** Commit or snapshot with `/checkpoint`, then write:

   ```markdown
   ## Summary: <task> (<date>)
   Goal: <one line>          Acceptance: <criteria>
   Done (verified): - <item> (`<verify command>` passed)
   Decisions: - <decision> because <reason>
   Ruled out: - <hypothesis>: <evidence>
   In progress: - <item>: <state>; next step <...>
   Open questions / blockers: - <...>
   Files touched: <paths>
   Verify with: `<commands>`
   User preferences: - <...>
   ```

   Antigravity also compacts automatically past a threshold, replacing early turns with its own summary; writing yours first guarantees the facts you care about survive. Scrub secrets before the summary is saved anywhere (`eag shield --file summary.md`).

   **Check:** the summary is under about 400 words and someone could resume from it alone.

6. **Keep always-loaded context small.** Skills: only `name` and `description` load until activation, so keep `SKILL.md` at 4 to 12 KB and move tables, long examples and vendor matrices into `references/` with relative links. Rules: always-on and global rules share a 20,000-token budget and overflow is demoted to path pointers; keep `AGENTS.md` under 6 KB and other rules under 4 KB (24 KB hard cap), preferring `glob` or `model_decision` triggers over `always_on`. MCP: every connected server's tool list costs tokens, so disable unused servers and tools.

   **Check:** `eag doctor` reports the rule budget within limits, and `find skills -name SKILL.md -size +12k` (PowerShell: `Get-ChildItem skills -Recurse -Filter SKILL.md | Where-Object Length -gt 12KB`) returns nothing.

7. **Start fresh with a handoff when compaction is not enough.** Signs: confusion persists after compaction, the task changes, or most of the context is irrelevant history.
   1. Write the step 5 summary.
   2. Save it with `/session-save`, or `eag sessions save --title "<title>" < summary.md` (PowerShell: `Get-Content summary.md -Raw | eag sessions save --title "<title>"`; fallback `node <plugin-root>/bin/eag.js sessions save ...`).
   3. Open a new session. EAG's SessionStart hook injects the latest summary; `/session-resume` or `eag sessions latest` prints it on demand.
   4. Re-verify state before continuing: `git status`, then the summary's verify commands.

   **Check:** before doing any work, the new session restates the goal and next step correctly.

8. **Configure compaction in programmatic agents.** In the Antigravity SDK, set `compaction_config=types.CompactionConfig(token_threshold=...)` and log events with an `on_compaction` hook (`antigravity-sdk-orchestrator`). In your own Gemini apps, compact history at thresholds in large steps rather than every turn: each rewrite changes the prompt prefix and forfeits implicit caching.

   **Check:** compaction events are logged, and task success after compaction matches before.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Paste full build logs | Filter at the source, run the compactor, or delegate triage | Floods context and buries the error |
| Compact mid-debugging | Keep the first exact error verbatim until fixed | You can't search for what you paraphrased |
| Summarise without verification status | Label each item verified or unverified | False confidence after resume |
| Drop user constraints | Keep instructions and approvals verbatim | The agent violates them later |
| Re-read whole files | `grep_search`, then `view_file` by range | Duplicate tokens |
| Grow always-on rules | Skills with `references/`; trigger-scoped rules | Shared 20k budget; overflow is demoted |
| Compact every turn in an app | Compact at thresholds, in large steps | Breaks prefix caching |
| Resume and keep coding | `git status` plus the verify commands first | The summary may be stale |

## Verification checklist

- [ ] Compaction happened at a named milestone or trigger.
- [ ] Goal, acceptance criteria, user constraints, decisions and next step survived.
- [ ] Exact first-occurrence errors and verify commands are present.
- [ ] Logs were trimmed or compacted before entering context.
- [ ] Skill and rule files are within size budgets.
- [ ] Saved summaries were scrubbed of secrets; resumed sessions re-verified state.

## Related

- Workflows: `/checkpoint`, `/session-save`, `/session-resume`, `/deep-work`.
- Knowledge: `subagent-delegation`, `llm-cost-routing`, `antigravity-customization`, `antigravity-sdk-orchestrator`, `credential-sanitizer`.
- Agents: `chief-of-staff`, `codebase-explorer` (keeps exploration out of the main context).
