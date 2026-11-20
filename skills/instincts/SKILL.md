---
name: instincts
description: >-
  Reviews and evolves learned EAG instincts: lists them by confidence,
  reinforces or weakens each based on real outcomes, prunes those below 0.3
  after confirmation, promotes proven ones (confidence 0.85 or more, seen 3 or
  more times) into a project skill, and exports or imports them across
  machines. Use for periodic housekeeping or when injected instincts look
  stale or wrong. Invoke with /instincts.
---

# Instincts

Instincts only help if their confidence tracks reality. This skill closes the
loop: instincts that keep paying off get stronger and eventually graduate into
skills; instincts that misfire get weaker and are pruned. Only instincts at 0.7
or higher (top 6) are injected at session start, so ranking matters.

## When to use

- The user says "review my instincts", "what have you learned", "clean up instincts".
- An injected instinct was wrong or outdated this session (stack migrated, convention changed).
- After a milestone or every couple of weeks of active work, as housekeeping.
- Moving to a new machine, or sharing learned conventions with a teammate.

## When not to use

- Recording a new lesson: use `/instinct-capture`.
- Writing a skill from scratch or from git history: use `/skill-create` (this skill only promotes existing instincts).
- Auditing the whole Antigravity setup (plugins, rules budget, MCP): use `/harness-audit`.

## Workflow

Commands use `eag`. If it is not on `PATH`, run `node <plugin-root>/bin/eag.js <command>`
instead, where `<plugin-root>` is two levels above this SKILL.md.

1. **Inventory.**

   ```bash
   eag instincts list --min 0 --json
   ```

   Run from the repository root (or add `--project <repo-root>`). Present a table sorted by confidence: id, confidence, times seen, scope, trigger, action. Mark which ones are currently injected (0.7 or higher, top 6).

   **Check:** The user can see every instinct, including low-confidence ones.

2. **Judge each against outcomes.** Use evidence, not opinion: this conversation, recent summaries (`eag sessions list`, then open the relevant ones), and `git log --oneline -30`.

   | Outcome since it was recorded | Command |
   | :--- | :--- |
   | Followed it and it prevented a mistake or saved time | `eag instincts reinforce <id>` (+0.1) |
   | Followed it and it caused rework, or the user overrode it | `eag instincts weaken <id>` (-0.15) |
   | Contradicted by the current code or config (for example the repo moved from Jest to Vitest) | Weaken, and propose pruning or rewriting it with `/instinct-capture` |
   | No relevant occasion yet | Leave it unchanged |

   Ask before weakening anything the user explicitly asked you to remember.

   **Check:** Every changed instinct has a one-line justification that names its evidence.

3. **Merge duplicates.** For two instincts that teach the same lesson, reinforce the better-worded one and weaken the other until it falls below 0.3, so the next prune removes it. If neither wording is good, capture a clean replacement with `/instinct-capture` and weaken both originals.

   **Check:** No two remaining instincts share a trigger and action in meaning.

4. **Prune, with confirmation.** List the instincts below 0.3 from the JSON, show them to the user, and only after a yes:

   ```bash
   eag instincts prune --below 0.3
   ```

   Pruning deletes them; there is no undo unless you exported first (step 6).

   **Check:** `eag instincts list --min 0` no longer shows them, and nothing above 0.3 disappeared.

5. **Promote proven instincts into a skill.** Candidates need confidence 0.85 or higher, seen at least 3 times, no weakening in recent sessions, and a procedure-shaped action (several steps, commands, checks). A one-line constraint belongs in `AGENTS.md` or `GEMINI.md`, not in a skill.

   ```bash
   eag instincts promote <id> --skill <kebab-name>
   ```

   This scaffolds `<project>/.agents/skills/<kebab-name>/SKILL.md`. The name must be kebab-case and must not collide with Antigravity built-ins (`plan`, `learn`, `goal`, `boost`, `swarm`, `teamwork`, `grill-me`, `schedule`, `hooks`, `skills`, `plugin`, `agents`) or an installed skill. Then flesh the scaffold out to the EAG authoring standard: purpose, when to use and not, numbered workflow with `**Check:**` lines, patterns, anti-patterns, verification checklist, related. Follow `/skill-create` steps 5-7 for drafting, frontmatter validation and the fresh-agent test.

   **Check:** The new SKILL.md passes the `/skill-create` validation, and a fresh agent used it correctly. Ask the user whether to retire the source instinct (weaken it below 0.3 and prune) so the lesson is not injected twice.

6. **Export or import across machines.** There is no dedicated export command; use the JSON listing as the portable format.

   ```bash
   eag instincts list --min 0 --json > instincts-export.json
   ```

   ```powershell
   eag instincts list --min 0 --json | Out-File -Encoding utf8 instincts-export.json
   ```

   On the other machine, read the file and, for each instinct not already present there (deduplicate as in `/instinct-capture` step 4), recreate it with `eag instincts add --trigger ... --action ... --confidence <c> --scope <scope> --evidence "imported from <machine>, <date>"`. Cap imported confidence at 0.7 so it is re-earned in the new environment. Run `eag shield --file instincts-export.json` before sharing it with anyone, and do not commit it unless the user asks.

   **Check:** `eag instincts list` on the target shows the imported set with no duplicates.

7. **Report.** Summarize: reinforced, weakened, merged, pruned, promoted (with skill path), exported or imported, and the new top 6 that will be injected next session.

   **Check:** The user can see what changed and why.

## Reference

### Where a lesson belongs

| Lesson shape | Home | How |
| :--- | :--- | :--- |
| One trigger, one action, still being proven | Instinct | `/instinct-capture` |
| Proven, one-line, must always hold for this repo | Project rules (`AGENTS.md` or `GEMINI.md`) | Propose the line; edit only with consent |
| Proven, multi-step procedure with commands and checks | Project skill | `eag instincts promote`, then `/skill-create` steps 5-7 |
| Proven across all the user's projects | Global skill in `~/.gemini/config/skills/` | Promote, then move with consent |

### Confidence arithmetic

Reinforce adds 0.1 and weaken subtracts 0.15, both clamped to 0-1. From the
usual 0.6 start, one reinforcement reaches the injection threshold (0.7) and
three reach 0.9, past the promotion bar (which also needs "seen" at 3 or more).
Two weakenings bring 0.6 to about 0.3, right at the prune line; a third puts it
clearly below. The asymmetry is deliberate: misfires cost more than hits earn.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Reinforce every instinct during review | Reinforce only with a concrete outcome | Inflation pushes stale instincts into the six injected slots |
| Prune without showing the list | Show what falls below 0.3, then confirm | Pruning is permanent without an export |
| Promote a one-liner into a skill | Put it in project rules | A skill with no procedure is noise in the router |
| Leave the promoted instinct at 0.9 | Ask to retire it after the skill is verified | The same lesson is injected twice, wasting context |
| Import a colleague's instincts at their confidence | Cap at 0.7 and let them re-earn it | Their evidence came from a different environment |
| Edit the JSON files under `~/.gemini/eag/instincts/` by hand | Use the `eag instincts` commands | Hand edits can corrupt the store the hooks read |

## Verification checklist

- [ ] Every reinforce or weaken has named evidence.
- [ ] Duplicates were merged; no two instincts teach the same lesson.
- [ ] The prune list was shown and confirmed before `prune` ran.
- [ ] Promotions met the bar (0.85 or higher, seen 3 or more) and the scaffold was fleshed out and tested.
- [ ] Exports were scanned with `eag shield --file`; imports were capped at 0.7.
- [ ] The final report lists the new top 6 injected instincts.

## Related

- Workflows: `/instinct-capture`, `/skill-create`, `/harness-audit`, `/session-resume`.
- Knowledge: `antigravity-customization`, `prompt-engineering`, `agent-evals`.
