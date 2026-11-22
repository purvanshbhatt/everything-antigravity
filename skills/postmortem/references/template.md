# Postmortem template

Save as `docs/postmortems/YYYY-MM-DD-<slug>.md` (or the project's
convention). All times in UTC. Use roles, not names, in the narrative.

```markdown
# Postmortem: <short description of the user-visible failure>

| Field | Value |
| :--- | :--- |
| Incident ID | <id> |
| Severity | SEV1 / SEV2 / SEV3 |
| Status | Draft / In review / Final |
| Date of incident | YYYY-MM-DD |
| Authors | <roles or names> |
| Reviewers | <responders and owners> |
| Incident commander | <role or name> |

## Summary
<Three to five sentences: what users experienced, for how long, the cause in
one line, and how it was resolved.>

## Impact
| Measure | Value | Method / source |
| :--- | :--- | :--- |
| Duration of impact | HH:MM (start-end UTC) | |
| Users / tenants affected | | |
| Failed requests / error rate | | |
| Data lost or corrupted | | |
| SLO error budget consumed | | |
| Support tickets | | |

## Key times
| Metric | Value |
| :--- | :--- |
| Time to detect (impact start to detection) | |
| Time to mitigate (detection to mitigation) | |
| Time to resolve (impact start to all-clear) | |
| Detected by | Alert <name> / customer report / engineer |

## Timeline (UTC)
| Time | Event | Source |
| :--- | :--- | :--- |
| 2026-11-20 14:02 | Deploy of <service> <version> begins | CI deploy log |
| 14:09 | Error rate on /checkout exceeds 5% | Dashboard <link> |
| 14:17 | Alert <name> pages on-call | Pager history |
| ... | ... | ... |

## Causes
**Trigger:** <the event that started the incident>

**Root cause(s):** <why the system was vulnerable to the trigger>

**Contributing factors:**
- <what made it worse, slower to detect or slower to fix>

<Optional causal tree or five-whys chain.>

## Resolution and recovery
<What was done to mitigate and fully recover; any data repair performed and
how it was verified.>

## Lessons
**What went well**
- 
**What went poorly**
- 
**Where we got lucky**
- 

## Action items
| # | Action | Type (prevent / detect / mitigate / process) | Owner | Priority | Due | Tracking |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | | | | | | <issue link> |

## Follow-up
Action-item review date: YYYY-MM-DD.

## Supporting evidence
- <links to dashboards, logs, chat export, deploy records>
```
