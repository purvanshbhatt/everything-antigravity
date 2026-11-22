---
name: legacy-modernization
description: >-
  Modernizes legacy systems incrementally: mapping hidden consumers,
  characterization tests, seams and branch by abstraction, the
  strangler fig pattern behind a routing facade, anti-corruption layers,
  shadow traffic and parallel runs, data migration with CDC and
  reconciliation, and the rewrite-versus-refactor decision. Use when replacing
  or re-platforming an old system, moving a monolith to the cloud, or when a
  team proposes a full rewrite.
---

# Legacy Modernization

Replace a legacy system one slice at a time while it keeps running: pin its
behaviour with tests, put a facade in front, move traffic and data slice by
slice with a rollback at every step, and delete the old path only when nothing
uses it. Cutovers, data migrations and decommissioning each need the user's
explicit yes.

## When to use

- An old system blocks delivery, is costly to run, or depends on unsupported tech or skills.
- Moving a monolith or on-prem application to Google Cloud.
- Someone proposes "let's just rewrite it".
- Extracting one capability from a monolith into a new service.

## When not to use

- Upgrading a framework or major version inside the same codebase: use `/framework-migration`.
- A local refactor of one module: use `safe-refactor`.
- Deciding which debt to pay first: use `tech-debt`.
- Schema changes inside one database: use `database-migrations`.

## Workflow

1. **Map the system.** Delegate a read-only survey to the `codebase-explorer` subagent: entry points, batch jobs, integrations, database tables and who reads them (reports, other teams, spreadsheets), configuration and scheduled tasks. Supplement with production logs and traffic to find what is actually used. Use `/explain-code` for the gnarliest modules.

   **Check:** An artifact lists every inbound and outbound interface and every consumer of the data, with usage volume.

2. **State the goal and the exit criteria.** Why modernize (cost, velocity, risk, compliance), which metrics prove success, and what "done" means (old system switched off). Record the decision with `/architecture-decision`.

   **Check:** The user has agreed the goal, metrics, and the decision between the options in the matrix below.

3. **Pin behaviour.** Write characterization tests around the area to move: feed recorded or representative inputs and assert the current outputs, bugs included. Record real traffic samples where possible.

   **Check:** Characterization tests pass against the legacy code and cover the slice's main paths.

4. **Insert a seam or facade with no behaviour change.** At the edge, route all traffic through a facade (load balancer URL map, API gateway or reverse proxy). In code, use branch by abstraction: introduce an interface, make the legacy implementation its first implementation, and switch callers to it.

   **Check:** All traffic flows through the facade, and tests and metrics are unchanged.

5. **Build the first slice.** Choose a thin vertical slice that is valuable and low risk. Translate legacy concepts in an anti-corruption layer so the new model does not inherit legacy names and quirks.

   **Check:** The new slice passes the same characterization tests as the legacy path.

6. **Shadow, compare, then cut over.** Send a copy of traffic to the new path (read-only operations first), compare responses and log differences without affecting users. When the difference rate is acceptably low and explained, ask the user to approve the cutover, then move traffic gradually behind a flag or routing weight.

   **Check:** Difference rate and SLIs meet the agreed threshold before and during the cutover, and rollback is one routing change.

7. **Migrate the data.** Keep one writer per entity at a time. Sync with change data capture (Datastream, Database Migration Service or Debezium; verify supported sources against current docs) or an outbox, run reconciliation checks (counts, checksums, business totals), and cut over writes in a planned window with the user's approval.

   **Check:** Reconciliation shows zero unexplained differences for a full business cycle (for example a day or a month-end).

8. **Decommission.** Remove the old route, code, jobs and credentials once traffic and data consumers are zero. Archive data per retention rules. Deleting databases or infrastructure needs explicit consent.

   **Check:** Monitoring shows zero calls to the old path for an agreed period before deletion.

Repeat steps 3 to 8 per slice.

## Patterns

### Rewrite or refactor

| Situation | Choose |
| :--- | :--- |
| Code works, tests possible, team understands it | Refactor in place |
| Platform or language is dead, behaviour is still right | Re-platform slice by slice (strangler) |
| Domain model is wrong and blocks the business | Strangler with new model behind an anti-corruption layer |
| Small, well-specified, low-risk system | Rewrite can be acceptable, with characterization tests and a parallel run |
| "The code is ugly" is the main reason | Refactor; a rewrite rarely pays back |

### Characterization test (golden master)

```python
import json
import pathlib
import pytest
from legacy.pricing import quote   # untouched legacy code

GOLDEN = pathlib.Path("tests/golden")
CASES = json.loads((GOLDEN / "quote_inputs.json").read_text())

@pytest.mark.parametrize("case", CASES, ids=lambda c: c["id"])
def test_quote_matches_recorded_output(case):
    expected = json.loads((GOLDEN / f"{case['id']}.json").read_text())
    assert quote(**case["input"]) == expected
```

Generate the golden files once from the current code, review a sample with the domain owner, and commit them. When a difference is a known legacy bug, document it and decide explicitly whether to keep it.

### Parallel run

Call both implementations, return the legacy result to the user, and log a structured diff (inputs hash, field-level differences) for the new one. Only for read-only or idempotent operations; never let both paths write.

### Strangler routing on Google Cloud

Put an external Application Load Balancer or API Gateway in front: a URL map sends `/orders/*` to the new Cloud Run service and everything else to the legacy backend. Moving a path back is a single routing change.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Big-bang rewrite with a launch date | Strangler slices with rollback | Rewrites miss hidden behaviour and slip for years |
| Start without characterization tests | Pin current behaviour first | You cannot tell a regression from a fix |
| Dual writes from application code | One writer plus CDC or outbox | Partial failures leave the stores inconsistent |
| Copy the legacy data model into the new service | Anti-corruption layer and a new model | You rebuild the legacy system in a new language |
| Leave the old path running forever | Decommission criteria and dates | Running both doubles cost and confusion |
| Miss hidden consumers (reports, other teams) | Survey database readers and logs | Switching off breaks people you did not know existed |

## Verification checklist

- [ ] Interfaces and data consumers mapped from code and production evidence.
- [ ] Goal, metrics and strategy agreed and recorded as an ADR.
- [ ] Characterization tests cover each slice before it moves.
- [ ] Shadow comparison met the agreed threshold before cutover.
- [ ] Data reconciled with zero unexplained differences over a business cycle.
- [ ] Cutovers, data migrations and deletions had explicit user approval, each with a rollback.

## Related

- Agents: `migration-specialist`, `codebase-explorer`, `code-architect`, `database-architect`.
- Workflows: `/framework-migration`, `/architecture-decision`, `/explain-code`, `/write-spec`.
- Knowledge: `safe-refactor`, `tech-debt`, `database-migrations`, `microservices`, `domain-driven-design`, `contract-testing`, `feature-flags`.
