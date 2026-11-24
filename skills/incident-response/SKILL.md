---
name: incident-response
disable-model-invocation: true
description: >-
  Runs a live production incident: declaring and grading severity, assigning
  commander, operations, communications and scribe roles, mitigating before
  diagnosing (rollback, flag off, traffic shift, scale, failover), status
  updates on a fixed cadence and a UTC timeline that feeds the postmortem. Use
  when something is down or degraded, an alert fires with user impact, or
  someone says "we have an incident" or "prod is broken".
---

# Incident Response

Restore service first; find the root cause later. Run the incident as a small,
explicit organisation: one commander, clear roles, a written timeline and
updates on a clock. Every production change during the incident is proposed,
confirmed by the incident commander (the user), then executed and logged.

## When to use

- Users are affected now: errors, latency, data problems, a security event or a third-party outage.
- An SLO burn-rate alert or a customer report suggests real impact.
- An earlier fix did not hold and the incident has reopened.

## When not to use

- The incident is over and needs a write-up: use `/postmortem`.
- No user impact, and the bug can wait for normal work: use `/root-cause` or `/issue-triage`.
- Designing alerts, rotations or runbooks ahead of time: use `runbooks-oncall`.
- A suspected breach needs forensics and legal handling: follow the security policy and involve the `security-guard` agent; preserve evidence before mitigating.

## Workflow

1. **Declare and grade.** Say "this is an incident", pick a severity from the table below and open an incident-log artifact with the start time in UTC. When unsure, grade higher; downgrading is cheap.

   **Check:** The log has a severity, a one-line impact statement and a start time.

2. **Assign roles.** For SEV1 and SEV2, name each role explicitly, even if one person holds two.

   | Role | Owns |
   | :--- | :--- |
   | Incident commander (IC) | Decisions, priorities, approving changes; does not debug |
   | Operations lead | Investigation and executing mitigations |
   | Communications lead | Stakeholder and status-page updates on cadence |
   | Scribe | Timestamped timeline of facts, decisions and actions |

   The agent can act as scribe and operations assistant: delegate log and metric searches to the `sre-engineer` subagent and keep the timeline current. The user stays IC unless they hand over.

   **Check:** Every role has a named owner in the log.

3. **Assess impact fast (10 minutes maximum).** What is broken, for whom, since when, and what changed? Check recent deploys, config and flag changes, dependency status pages and traffic spikes.

   ```bash
   gcloud logging read 'severity>=ERROR' --freshness=30m --limit=50 --format=json
   gcloud run revisions list --service=api --region=REGION
   kubectl rollout history deployment/api
   git log --since="6 hours ago" --oneline
   ```

   **Check:** You have a ranked list of suspect changes with their timestamps against the impact start.

4. **Mitigate first.** Choose the fastest reversible action from the mitigation ladder below. Propose it to the IC with the expected effect and the risk, and run it only after an explicit yes.

   ```bash
   gcloud run services update-traffic api --region=REGION --to-revisions=api-00042-abc=100
   kubectl rollout undo deployment/api && kubectl rollout status deployment/api
   ```

   **Check:** The user-facing symptom metric (error rate, latency, success rate) is moving back to baseline.

5. **Communicate on a clock.** SEV1 every 30 minutes, SEV2 every 60 minutes, and on every state change. Use the template below. Say what you know, what you are doing and when the next update comes. Never guess at cause in external updates.

   **Check:** Each update in the log has a timestamp, and none is overdue.

6. **Verify recovery.** Watch the SLI for at least 15-30 minutes after mitigation, and check for side effects: queues draining, stuck jobs, data written while degraded.

   **Check:** The SLI is at baseline for the full watch window, and backlog metrics are trending to zero.

7. **Resolve and hand off.** Mark resolved, post a final update, list follow-ups (temporary mitigations to undo, data repair, monitoring gaps) and schedule the postmortem within five business days for SEV1 and SEV2.

   **Check:** The timeline artifact is complete and `/postmortem` has an owner and a date.

## Reference

### Severity levels

| Level | Definition | Response |
| :--- | :--- | :--- |
| SEV1 | Critical user path down for many users, data loss or corruption, active security breach | All hands, IC required, updates every 30 min, exec notice |
| SEV2 | Major feature degraded, or a subset of users fully blocked | IC required, updates every 60 min |
| SEV3 | Minor degradation with a workaround | On-call handles in hours, ticket |
| SEV4 | Cosmetic or internal-only | Normal backlog |

Adapt the definitions to the product's own SLOs and write them down before the next incident.

### Mitigation ladder (fastest and safest first)

| Action | When | Risk |
| :--- | :--- | :--- |
| Roll back the last deploy or config | Impact started after a change | Low, if the release had no one-way migration |
| Turn off a feature flag | New code path behind a flag | Very low |
| Shift traffic or fail over region | Zonal or regional problem | Medium: check capacity first |
| Scale out or raise limits | Saturation from load | Low; watch cost and downstream limits |
| Shed load: rate limit, disable non-critical features | Overload or retry storm | Some users degraded on purpose |
| Hotfix forward | No rollback possible | Highest: untested code under pressure |

### Status update template

```text
[SEV2][Investigating|Mitigating|Monitoring|Resolved] <service> <symptom>
Impact: <who is affected and how>, since <HH:MM UTC>.
Current action: <what we are doing now>.
Next update: <HH:MM UTC> or sooner on change.
```

### Timeline entry format

`HH:MM UTC - <who> - <fact | decision | action> - <evidence link>`. Record facts and decisions, not opinions. The scribe never edits earlier entries; corrections are new entries.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Debug root cause while users are down | Mitigate, then investigate | Recovery time is what users feel |
| Everyone changes things at once | All changes approved by the IC and logged | Parallel changes hide which one helped or hurt |
| Silence until it is fixed | Updates on a fixed clock, even with no news | Silence creates escalations and duplicate work |
| Roll back past a one-way migration | Check migration reversibility first | Old code against a new schema can corrupt data |
| Blame in channel | Facts and timeline only | Blame stops people sharing what they saw |
| Close without follow-ups | List temporary mitigations to undo and book `/postmortem` | Temporary fixes become permanent risks |

## Verification checklist

- [ ] Severity, impact statement and UTC start time were recorded at declaration.
- [ ] Roles were assigned for SEV1 and SEV2.
- [ ] Every production change had explicit IC approval and a timeline entry.
- [ ] Recovery was confirmed on the user-facing SLI over a watch window.
- [ ] Final update sent; follow-ups and postmortem owner recorded.

## Related

- Agents: `incident-commander`, `sre-engineer`, `security-guard`, `silent-failure-hunter`.
- Workflows: `/postmortem`, `/root-cause`, `/issue-triage`.
- Knowledge: `runbooks-oncall`, `observability-otel`, `feature-flags`, `backup-dr`, `chaos-engineering`, `cloud-run`, `kubernetes-gke`.
