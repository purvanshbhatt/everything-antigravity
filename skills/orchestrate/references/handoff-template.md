# Handoff Document Template

Write one per completed stage of a sequential pipeline, save it in the
conversation's artifact directory, and give the next stage this document plus its
brief. Keep it under about 80 lines. Facts only; no narration.

```markdown
# Handoff: <stage name> -> <next stage> (<unit-id>, <YYYY-MM-DD HH:MM>)

## Outcome
<1-3 sentences: what this stage produced and whether it met its "done when">

## Status
- Done when: <condition from the brief> -> MET | NOT MET (<why>)
- Gates: `<command>` -> <n passed, n failed> (re-run by the orchestrator: yes | no)

## Files changed
| File | Change | Owner |
| :--- | :--- | :--- |
| `src/billing/invoice.ts` | added `prorate()` | implementer |

## Decisions
- <decision>, because <reason>. Rejected: <alternative>.

## Evidence
- <command and its key output line, or file:line references>

## Known issues and risks
- <issue>, severity <BLOCKER | MAJOR | MINOR>, suggested owner <stage or agent>

## For the next stage
- Must do: <bounded list>
- Must not touch: <files or areas>
- Read first: <2-5 file paths>
- Open questions: <questions that need the user or the orchestrator>
```

## Rules

- The orchestrator, not the producing subagent, fills in "re-run by the orchestrator".
- "Known issues" must include anything the stage saw but did not fix; silence is read as "none".
- If a stage's outcome is NOT MET, the orchestrator decides whether to retry (once), re-scope, or escalate; the next stage does not start on an unmet handoff.
- Never put secret values in a handoff; name the env var instead.
