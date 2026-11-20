---
name: software-architecture
description: >-
  Guides structural design decisions: Clean and Hexagonal architecture, DDD
  tactical patterns, modular monolith versus microservices, machine-enforced
  dependency rules (dependency-cruiser, import-linter, ArchUnit), ADRs and
  fitness functions. Use when the user asks how to structure a system or
  module, whether to split a service, how to stop layers leaking, or to record
  an architecture decision.
---

# Software Architecture

Choose the simplest structure that keeps the expensive-to-change decisions
reversible, then make the rules executable so they survive the next hundred
commits. An architecture that exists only in a diagram is already violated.

## When to use

- "How should I structure this service/module?", "where does this logic belong?", "should this be a microservice?"
- Domain logic is tangled with HTTP handlers, ORM models or SDK calls and is hard to test.
- A decision with long-lived consequences (datastore, sync vs async, service boundary) needs an ADR.
- Layer or module boundaries keep getting violated and need automated enforcement.

## When not to use

- Endpoint shapes, status codes and versioning: use `api-design`.
- Transactions, outbox, retries and caching inside one service: use `backend-patterns`.
- Table, index and migration design: use `database-design` or the `database-architect` agent.
- Planning a concrete feature end to end: use `/blueprint` (it calls into this skill for structure).

## Workflow

1. **Map what exists before proposing anything.** Use `list_dir` and `find_by_name` for the module layout, `grep_search` for imports that cross layers (for example `from .*infrastructure` inside `domain/`). For a large repo, delegate the survey to the `codebase-explorer` subagent and ask for a dependency summary, not file dumps.

   **Check:** You can name the deployable units, the main modules and the three worst boundary violations with file paths.

2. **Name the drivers.** Write down the quality attributes that actually constrain the design (team count, deploy independence, latency budget, consistency needs, compliance, expected scale in 12 months). Rank them; architecture is trade-offs between these, not a style choice.

   **Check:** The top three drivers are written down with a number or a concrete scenario each ("p95 < 200 ms at 500 rps", "two teams ship weekly without coordination").

3. **Pick the macro shape with the decision matrix below.** Default to a modular monolith. Choose services only when a row in the matrix forces it.

   **Check:** The choice cites at least one driver from step 2.

4. **Draw the boundaries.** Split by business capability (bounded context), not by technical layer. Inside each module apply ports and adapters: domain at the centre, application services orchestrating use cases, adapters at the edge. See [enforcement and templates](references/enforcement-and-templates.md) for layouts in TypeScript, Python, Go and Java.

   **Check:** Each module has one public entry point (index, `__init__`, package API), and no domain file imports a framework, ORM or SDK.

5. **Make the dependency rule executable.** Add dependency-cruiser, import-linter, ArchUnit or Go `internal/` packages (configs in the reference file) and wire the check into CI. Start with the rules the current code already satisfies, then ratchet.

   **Check:** The check runs locally and fails when you add a deliberate violating import.

6. **Record the decision.** Write an ADR in `docs/adr/NNNN-short-title.md` using the template in the reference file. Present it as an Antigravity implementation-plan artifact for user review before any structural change lands.

   **Check:** The ADR states the rejected options and the consequences you accept.

7. **Add fitness functions for the drivers.** Each top driver gets an automated check (dependency rule, latency threshold in a load test, bundle-size budget, no-cycles rule). Run them in CI.

   **Check:** Every driver from step 2 maps to at least one automated check or an explicit "manual review" note in the ADR.

## Decision matrix: modular monolith or microservices

| Force | Modular monolith | Microservices |
| :--- | :--- | :--- |
| Teams | 1-3 teams, shared release cadence | Many teams that must deploy independently |
| Domain understanding | Boundaries still moving | Boundaries stable for 6+ months |
| Consistency | Needs ACID across capabilities | Eventual consistency acceptable between contexts |
| Scaling profile | Uniform load | One capability needs 10x the resources or a different runtime |
| Ops maturity | No on-call per service, no distributed tracing | CI/CD per service, tracing, SLOs, platform team |
| Failure isolation | Shared fate acceptable | A crash in A must not take down B |
| Latency | Calls are in-process (ns) | Network hops (ms) and partial failure are affordable |

Rule of thumb: if you cannot draw the module boundaries cleanly inside one deployable, splitting it into services produces a distributed monolith. Extract a service from a well-bounded module, never from a tangle.

## DDD tactical patterns

| Pattern | Use it for | Rules that matter |
| :--- | :--- | :--- |
| Entity | Thing with identity and lifecycle (`Order`) | Equality by ID; methods enforce invariants, no public setters |
| Value object | Measured or descriptive value (`Money`, `EmailAddress`) | Immutable, equality by value, validated in the constructor |
| Aggregate | Consistency boundary (`Order` + `OrderLines`) | One aggregate per transaction; reference other aggregates by ID; keep small |
| Repository | Load/save an aggregate root | One per aggregate root; interface in domain, implementation in adapter |
| Domain event | Something that happened (`OrderPlaced`) | Past tense, immutable, published after commit (outbox) |
| Domain service | Logic that spans aggregates and has no natural owner | Stateless; not a dumping ground for anaemic entities |
| Application service | One use case (`PlaceOrder`) | Owns the transaction, calls domain, no business rules |
| Anti-corruption layer | Integrating a legacy or third-party model | Translate at the edge so foreign concepts never enter the domain |

Use DDD tactical patterns where the business rules are rich. For CRUD screens, a thin transaction script is the better design.

## Ports and adapters in one example

```ts
// domain/ports.ts: the domain owns the interface
export interface PaymentGateway {
  charge(orderId: OrderId, amount: Money): Promise<ChargeResult>;
}

// application/place-order.ts: the use case depends only on ports
export class PlaceOrder {
  constructor(private orders: OrderRepository, private payments: PaymentGateway) {}
  async execute(cmd: PlaceOrderCommand): Promise<OrderId> {
    const order = Order.create(cmd.customerId, cmd.lines); // invariants live here
    await this.payments.charge(order.id, order.total());
    await this.orders.save(order);
    return order.id;
  }
}

// adapters/stripe-payment-gateway.ts implements PaymentGateway with the SDK.
// main.ts (composition root) is the only file that knows both sides.
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Split into microservices on day one | Modular monolith with enforced module boundaries | You pay network, consistency and ops costs before you know the boundaries |
| Layer folders at the top (`controllers/`, `services/`, `models/`) | Feature or capability folders, layers inside each | Changes cut across every top-level folder; ownership is unclear |
| Domain entities that are ORM models | Separate persistence models mapped in the adapter, or ORM mapping kept out of domain types | Schema changes ripple into business rules and tests need a database |
| Interfaces for everything | Ports only at real boundaries (I/O, third parties, things you will swap or fake) | Indirection with one implementation and no test seam is noise |
| Shared database between services | One owner per table; others use the owner's API or events | Shared tables couple deploys and make schema changes impossible |
| Architecture rules in a wiki | dependency-cruiser, import-linter or ArchUnit in CI | Unenforced rules decay within weeks |
| ADRs written after the fact to justify a choice | ADR proposed before the change, with rejected options | The value is in the trade-off discussion, not the record |

## Verification checklist

- [ ] Drivers are written down and ranked, each with a number or scenario.
- [ ] The macro-shape choice cites the matrix row that forced it.
- [ ] Domain code imports no framework, ORM, HTTP or cloud SDK packages.
- [ ] A dependency-rule check runs in CI and was shown to fail on a deliberate violation.
- [ ] An ADR exists for each irreversible decision, with status, context, options and consequences.
- [ ] Each top driver has a fitness function or an explicit manual-review note.

## Related

- Knowledge: `api-design`, `backend-patterns`, `database-design`, `safe-refactor`, `documentation-writing`, `golang-services`, `python-fastapi`.
- Workflows: `/blueprint` (feature plans), `/codebase-onboard` (mapping an unfamiliar repo), `/refactor-clean`.
- Agents: `code-architect` (design proposals and ADR drafts), `planner`, `codebase-explorer` (dependency survey), `database-architect`.
