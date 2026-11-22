# Spec template

Copy this into `docs/specs/YYYY-MM-DD-<slug>.md` (or the project's spec
location) and fill every section. Delete a section only if it truly does not
apply, and say why in one line.

```markdown
# <Title: the change, not the problem>

| Field | Value |
| :--- | :--- |
| Status | Draft / In review / Approved / Superseded |
| Author(s) | <names or roles> |
| Reviewers | <names or roles, with the area each owns> |
| Approver | <who decides> |
| Created / Updated | YYYY-MM-DD / YYYY-MM-DD |
| Links | <issue, PRD, ADRs, prior specs> |

## 1. Summary
<Three to five sentences: problem, proposal, main trade-off.>

## 2. Context and problem
<Why now. Who is affected. Evidence: metrics, incidents, user reports.>

## 3. Current state
<How it works today, with file paths. Diagram if helpful.>

## 4. Goals and non-goals
**Goals**
- G1: <outcome> - measured by <metric/target>
**Non-goals**
- NG1: <adjacent work deliberately excluded>

## 5. Proposed design
### 5.1 Contracts
<API signatures, request/response schemas, events, CLI flags, config keys.>
### 5.2 Data model and migration
<Tables/collections/fields; expand-and-contract steps; backfill plan.>
### 5.3 Components and flow
<Diagram (Mermaid or ASCII) and narrative of the main path.>
### 5.4 Failure modes
<What fails, how it is detected, retries/timeouts/idempotency, user impact.>

## 6. Cross-cutting concerns
| Concern | Impact and approach |
| :--- | :--- |
| Security and authz | |
| Privacy and data retention | |
| Observability (logs, metrics, traces, alerts) | |
| Performance and capacity | |
| Cost | |
| Accessibility and i18n (user-facing changes) | |
| Compatibility (clients, versions) | |

## 7. Alternatives considered
| Option | Pros | Cons | Verdict |
| :--- | :--- | :--- | :--- |
| A: <proposed> | | | Chosen |
| B: <alternative> | | | Rejected because <reason> |
| C: Do nothing | | | Rejected because <reason> |

## 8. Risks
| Risk | Likelihood | Impact | Mitigation |
| :--- | :--- | :--- | :--- |

## 9. Rollout and rollback
<Stages, flags, percentage ramps, migration order, go/no-go signals.
Rollback per stage, including what happens to data written by the new version.>

## 10. Test plan
<Unit, integration, contract, E2E, load, manual checks; which risks each covers.>

## 11. Open questions for reviewers
1. <Role>: <specific question>
2. <Role>: <specific question>

## 12. Decision log
| Date | Decision | By |
| :--- | :--- | :--- |
```
