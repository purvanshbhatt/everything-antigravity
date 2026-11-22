---
name: domain-driven-design
description: >-
  Applies domain-driven design pragmatically: event storming, ubiquitous
  language, core vs supporting vs generic subdomains, bounded contexts and
  context maps, aggregates sized around invariants, value objects, domain
  events, repositories and anti-corruption layers. Use when modelling a
  complex domain, choosing module or service boundaries, untangling an anemic
  or god model, or integrating a legacy or third-party system.
---

# Domain-Driven Design

DDD earns its cost where business rules are complex and change often. Its
strategic half (language, subdomains, bounded contexts) is useful almost
everywhere; its tactical half (aggregates, value objects, repositories) is
worth it only in the core domain. Model with domain experts, draw boundaries
where meaning changes, and size aggregates to the invariants they protect.

## When to use

- A domain with real rules (pricing, scheduling, claims, ledgers, logistics) that keep changing.
- Choosing module or service boundaries, or reviewing ones that leak.
- One `Customer` or `Order` class used everywhere with dozens of optional fields.
- Business logic scattered across controllers, SQL and UI ("anemic model").
- Integrating a legacy system or third-party API whose model you do not want to adopt.

## When not to use

- CRUD over forms with little behaviour: plain layered code and `database-design` suffice.
- Deployment topology and service extraction mechanics: use `microservices`.
- Message delivery, ordering and sagas: use `event-driven-architecture`.
- General architecture styles and quality attributes: use `software-architecture`.

## Workflow

1. **Explore with domain experts.** Run an event storming session (in person or on a shared board): domain events in past tense on a timeline, then the commands, actors, policies ("whenever X, then Y"), external systems, read models and hot spots of confusion. Capture the result as an artifact for review.

   **Check:** A domain expert can walk the timeline and agrees with the wording.

2. **Write the ubiquitous language.** A glossary per context: term, definition, examples, and terms to avoid. Use the same words in code, tests, APIs and conversation; rename code when the language changes.

   **Check:** Class, method and event names in the target module match glossary terms; `grep_search` finds no synonyms for the same concept.

3. **Classify subdomains.** Core (competitive advantage: invest, model richly, keep in-house), supporting (necessary, specific: simple code), generic (solved problems: buy or use SaaS, for example auth, billing, email).

   **Check:** Engineering investment is concentrated on the core subdomain.

4. **Draw bounded contexts where meaning changes.** "Customer" in Sales (a lead with a pipeline stage), Support (a requester with tickets) and Billing (an account with payment methods) are different models; give each its own context and keep them separate. A context is owned by one team and maps to a module or service.

   **Check:** No class is shared across contexts except small value types in an explicitly shared kernel.

5. **Map the relationships.** For each pair of interacting contexts, choose a pattern from the context map table below, and protect your model from external ones with an anti-corruption layer (a translator plus adapter at the boundary).

   **Check:** Every integration on the map names its pattern and the upstream and downstream sides.

6. **Design aggregates around invariants.** Group only what must be consistent in one transaction. Rules: protect true invariants inside one boundary, keep aggregates small, reference other aggregates by ID, modify one aggregate per transaction and use domain events with eventual consistency for the rest. Access state only through the root.

   **Check:** For each aggregate you can list the invariants it enforces; anything it holds without an invariant is a candidate to move out.

7. **Use value objects aggressively.** Immutable, compared by value, self-validating: `Money`, `EmailAddress`, `DateRange`, `Quantity`. They remove primitive obsession and centralize validation.

   **Check:** No raw `number` for money or raw `string` for validated identifiers crosses the domain boundary.

8. **Raise domain events and keep infrastructure out.** Aggregates record events (`OrderPlaced`); application services persist the aggregate through a repository (one per aggregate root), then dispatch events after commit, via an outbox for integration events. Domain code imports no ORM, HTTP or messaging libraries.

   **Check:** Domain unit tests run with no database, network or framework bootstrap.

9. **Revisit boundaries deliberately.** When a change repeatedly touches two contexts, or one aggregate causes lock contention, record the evidence and redraw with `/architecture-decision`.

   **Check:** Boundary changes have an ADR with the evidence that triggered them.

## Patterns

### Context map relationships

| Pattern | Meaning | Use when |
| :--- | :--- | :--- |
| Partnership | Two teams coordinate changes together | Tightly linked goals, good communication |
| Shared kernel | Small shared model, jointly owned | Tiny, stable overlap (for example `Money`) |
| Customer-supplier | Upstream plans for downstream needs | Downstream can influence upstream priorities |
| Conformist | Downstream adopts upstream model as is | Upstream will not change and its model is acceptable |
| Anti-corruption layer | Downstream translates upstream model | Legacy or third-party model would distort yours |
| Open host service and published language | Upstream offers a stable, documented protocol | Many consumers |
| Separate ways | No integration | Integration costs more than duplication |

### Aggregate with invariants (TypeScript)

```ts
type Money = Readonly<{ minor: bigint; currency: 'EUR' | 'USD' }>;

export class Order {                                   // aggregate root
  private readonly pending: DomainEvent[] = [];
  private constructor(
    readonly id: OrderId,
    private status: 'draft' | 'placed' | 'cancelled',
    private readonly lines: OrderLine[],
  ) {}

  addLine(productId: ProductId, qty: number, unitPrice: Money): void {
    if (this.status !== 'draft') throw new DomainError('Only draft orders can change');
    if (!Number.isInteger(qty) || qty < 1) throw new DomainError('Quantity must be a positive integer');
    this.lines.push({ productId, qty, unitPrice });
  }

  place(): void {
    if (this.lines.length === 0) throw new DomainError('An order needs at least one line');
    this.status = 'placed';
    this.pending.push({ type: 'OrderPlaced', orderId: this.id, occurredAt: new Date() });
  }

  pullEvents(): DomainEvent[] { return this.pending.splice(0); }
}
```

The `Customer` is referenced by ID only; changing a customer never loads or locks orders.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| One enterprise-wide `Customer` model | One model per bounded context | Every team's change breaks every other team |
| Giant aggregates (`Customer` holding all orders) | Small aggregates referencing by ID | Lock contention and loading huge graphs |
| Getters and setters with rules in services | Behaviour methods on the aggregate | Invariants get bypassed from a dozen places |
| Full tactical DDD for CRUD screens | Simple layered code | Ceremony with no rules to protect |
| Adopt a vendor's model directly in the core | Anti-corruption layer | Their changes and concepts leak into your domain |
| Modify two aggregates in one transaction | Domain event plus eventual consistency | Hidden coupling and wider locks |
| Model in isolation from experts | Event storming and a shared glossary | The model encodes developer guesses |

## Verification checklist

- [ ] A glossary exists per bounded context and matches the code.
- [ ] Subdomains are classified; generic ones are bought or kept simple.
- [ ] A context map names every integration pattern; external models enter through an ACL.
- [ ] Each aggregate lists its invariants and references others by ID.
- [ ] Domain tests run without infrastructure.
- [ ] Integration events leave via an outbox after commit.

## Related

- Knowledge: `software-architecture`, `microservices`, `event-driven-architecture`, `legacy-modernization`, `backend-patterns`, `database-design`.
- Workflows: `/architecture-decision`, `/write-spec`.
- Agents: `code-architect`, `backend-engineer`.
