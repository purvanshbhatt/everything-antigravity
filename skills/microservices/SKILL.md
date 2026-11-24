---
name: microservices
disable-model-invocation: true
description: >-
  Decides whether and how to split a system into microservices: modular
  monolith first, boundaries from bounded contexts, per-service data
  ownership, sync vs async contracts, resilience, tracing, independent
  deployment and the strangler path. Use when planning a split, reviewing a
  service boundary, or fixing a distributed monolith with chatty calls, shared
  databases and lockstep releases.
---

# Microservices

Microservices trade in-process calls for network calls in exchange for
independent deployment and scaling. That trade only pays when teams and
workloads genuinely need independence; otherwise you get a distributed
monolith with every old problem plus latency, partial failure and harder
debugging. Decide first, then split along domain boundaries with data
ownership intact.

## When to use

- Someone proposes splitting a monolith, or adding a new service.
- Reviewing whether a service boundary is right (frequent cross-service changes, chatty calls).
- Shared databases between services, lockstep releases, cascading outages.
- Planning an incremental migration off a legacy system.

## When not to use

- Finding the boundaries in the domain: use `domain-driven-design` first.
- Overall architecture styles and quality attributes: use `software-architecture`.
- Wire protocol details: use `api-design`, `grpc-services` or `graphql-servers`.
- Retry, timeout and outbox code inside one service: use `backend-patterns`.

## Workflow

1. **Name the forcing function.** Write down the concrete problem a split solves: independent release cadence for separate teams, sharply different scaling or runtime needs, fault or compliance isolation. "Cleaner code" is a modularity problem, not a deployment problem. Record the decision with `/architecture-decision`.

   **Check:** The ADR names a measurable problem and why a modular monolith does not solve it.

2. **Modularize in place first.** One module per bounded context, each owning its tables, with cross-module calls only through a public interface. Enforce it in CI: dependency-cruiser (JS/TS), import-linter (Python), ArchUnit (JVM), `internal/` packages (Go).

   **Check:** The boundary checker runs in CI with zero violations for at least a few weeks before extraction.

3. **Choose the first extraction carefully.** Prefer a module with few inbound dependencies, clear data ownership and a real forcing function (for example, a CPU-heavy renderer). Do not start with the most entangled core.

   **Check:** You can list every caller of the module and every table it touches.

4. **Define contracts before moving code.** OpenAPI, protobuf or AsyncAPI files live in the repo, with consumer-driven contract tests and a written deprecation policy.

   **Check:** A breaking contract change fails CI for at least one consumer.

5. **Split the data.** The service owns its schema; other services get data through its API or its events and keep local read models. A staged path: separate schema in the same instance with no cross-schema joins, then a separate instance. Migrations on shared databases need explicit user confirmation.

   **Check:** No other service's credentials can read the new service's tables.

6. **Pick sync or async per interaction.** Synchronous HTTP or gRPC when the caller needs the answer to proceed; events for propagating state and triggering side effects. Keep synchronous chains to two or three hops; compose at a gateway or backend-for-frontend instead of deep call trees.

   **Check:** The longest synchronous call chain for each user-facing request is drawn and within budget.

7. **Engineer for partial failure.** Timeouts with deadline propagation, retries at one layer only, circuit breakers and bulkheads, fallbacks, and idempotency keys on mutating calls.

   **Check:** With one dependency returning errors or hanging, the caller degrades within its latency budget instead of queuing.

8. **Make it observable before go-live.** W3C trace context across HTTP, gRPC and message hops; correlation IDs in logs; RED metrics and an SLO per service; a catalog entry with owner and runbook.

   **Check:** One request can be followed end to end in the trace view.

9. **Deploy independently.** Each service has its own pipeline; changes are backward compatible (expand, migrate, contract); canary or traffic splitting is available. Production rollouts need user confirmation.

   **Check:** No release in the last month required deploying two services together.

10. **Strangle, then delete.** Route by path at the edge (load balancer URL maps, API gateway), shadow or compare traffic, cut over gradually, then delete the old code path.

    **Check:** The legacy code path for the extracted capability is removed, not just unused.

## Patterns

### Distributed monolith symptoms

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| Releases need coordination across services | Breaking contracts, shared domain libraries | Contract tests, versioning, move logic to the owner |
| Services share a database | No data ownership | One owner; others use its API or events |
| One request fans out to six or more services synchronously | Boundary cuts through a use case | Merge services or precompute a read model |
| Every feature touches four repos | Split by technical layer, not capability | Re-split around business capabilities |
| One outage takes everything down | No timeouts, breakers or bulkheads | Resilience patterns from step 7 |

### Google Cloud building blocks

- **Cloud Run** services with internal ingress; service-to-service calls use ID tokens whose audience is the receiving service URL, and callers hold `roles/run.invoker`.
- **GKE** with Cloud Service Mesh when you need mTLS, traffic policy and fine-grained routing across many services.
- **Pub/Sub** for events, **Workflows** for orchestrated sagas, **API Gateway** or **Apigee** at the edge.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Split a small team's app into ten services | Modular monolith with enforced boundaries | Ops cost grows faster than the team |
| One service per table or entity (`UserService`, `AddressService`) | One service per business capability | Entity services make every use case a distributed transaction |
| Share a database "for now" | Separate schemas with a single owner from day one | Shared tables become a permanent coupling |
| Shared library containing domain logic | Duplicate small things; own big things in one service | Library upgrades force lockstep releases |
| Synchronous call chains five deep | Async events, read models, or merged services | Latency and failure probability multiply per hop |
| Extract before tracing exists | Instrument first | You cannot debug what you cannot see |

## Verification checklist

- [ ] An ADR records the forcing function and the alternatives considered.
- [ ] Module boundaries were enforced in CI before extraction.
- [ ] Each service owns its data; no cross-service table access remains.
- [ ] Contracts are versioned and covered by consumer-driven contract tests.
- [ ] Timeouts, single-layer retries and breakers are in place and fault-tested.
- [ ] Traces, SLOs, owners and runbooks exist for every service.
- [ ] Services deploy independently; the strangled legacy path is deleted.

## Related

- Knowledge: `domain-driven-design`, `software-architecture`, `api-design`, `grpc-services`, `event-driven-architecture`, `contract-testing`, `legacy-modernization`, `observability-otel`, `cloud-run`, `kubernetes-gke`.
- Workflows: `/architecture-decision`, `/write-spec`.
- Agents: `code-architect`, `backend-engineer`, `sre-engineer`.
