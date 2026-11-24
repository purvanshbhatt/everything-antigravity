---
name: event-driven-architecture
disable-model-invocation: true
description: >-
  Designs event-driven systems: commands vs events vs queries, notification vs
  state-transfer payloads, CloudEvents envelopes and schema evolution,
  per-key ordering, transactional outbox, idempotent consumers, choreographed
  and orchestrated sagas with compensations, tracing and replay. Use when
  introducing async messaging between services, designing domain events, or
  debugging duplicate, lost or out-of-order events.
---

# Event-Driven Architecture

Events decouple producers from consumers in time and knowledge, and in return
you inherit duplicates, reordering, eventual consistency and schemas you can
never take back. This skill is the design procedure: what to publish, how to
version it, how to deliver it reliably, and how to coordinate multi-step work.

## When to use

- Services need to react to each other's state changes without synchronous calls.
- Designing domain or integration events, or a schema for a topic.
- A business process spans services (order, payment, shipping) and needs failure handling.
- Bugs: duplicate side effects, events lost on crash, stale state from out-of-order delivery.

## When not to use

- Broker selection and subscription settings: use `message-queues` (and `pubsub-eventarc` on Google Cloud).
- Windowed aggregation over streams: use `stream-processing`.
- One-off background work inside a single service: use `background-jobs`.
- Discovering the domain model itself: use `domain-driven-design` first.

## Workflow

1. **Discover the business facts.** Walk the process with a domain expert (a light event storming) and list events in past tense (`OrderPlaced`, `PaymentCaptured`), the commands that cause them, and the policies that react ("when PaymentCaptured, reserve stock"). Record them in an implementation-plan artifact for review.

   **Check:** Each event is a fact a domain expert recognizes, not a storage echo such as `OrderRowUpdated`.

2. **Classify every message.** Commands go to one owner, may be rejected and are named imperatively (`ReserveStock`). Events are immutable facts with zero or more subscribers. Queries return data and never travel over a topic.

   **Check:** No "event" is named in the imperative, and no command is broadcast to many handlers.

3. **Choose the payload style per event.** A notification event carries IDs and the type, and consumers fetch current state; it is small but couples consumers to the producer's API. An event-carried state transfer includes the fields consumers need, so they can keep local read models. Keep internal domain events separate from published integration events, which are a public contract with an owner.

   **Check:** Every published event has a named owner, a schema and a documented payload style.

4. **Fix the envelope and schema rules.** Use CloudEvents attributes (`id`, `source`, `type`, `subject`, `time`, `specversion`; Eventarc speaks CloudEvents natively). Store schemas (Avro, Protobuf or JSON Schema) in a registry such as Pub/Sub schemas or a schema registry, or in the repo with a CI compatibility check. Allowed evolution: add optional fields. Anything else gets a new type (`com.acme.order.placed.v2`) and is dual-published while consumers migrate.

   **Check:** CI rejects a schema change that removes or retypes a field.

5. **Scope ordering to the entity.** Global ordering kills throughput; order per aggregate by using its ID as the ordering or partition key. Carry the aggregate `version` in every event so consumers ignore stale updates: `UPDATE orders_view SET ... WHERE id = $1 AND version < $2`.

   **Check:** A test that delivers version 3 before version 2 ends in version 3 state.

6. **Publish reliably.** Never write the database and then publish in two steps. Write an outbox row in the same transaction and relay it, or use change data capture (Debezium, Datastream). Delivery becomes at-least-once by design.

   **Check:** Killing the process between commit and publish loses nothing; the relay publishes on restart.

7. **Consume idempotently.** In the same transaction as the side effect, insert `(consumer_name, event_id)` into a table with a unique constraint and skip on conflict. Acknowledge only after commit. After N failed attempts, route to a dead-letter queue that has an owner and an alert.

   **Check:** A test delivers the same event twice and observes one effect.

8. **Coordinate multi-step processes with sagas.** Choreography (services react to each other's events) suits two or three steps. Beyond that, or when you need a single place to see progress, orchestrate with Google Cloud Workflows, Temporal or a state-machine table. Every step needs a compensating action; place the irreversible step (charging a card, shipping) as late as possible.

   **Check:** For each step, the saga diagram shows which compensations run when that step fails.

9. **Make flows traceable and replayable.** Propagate W3C `traceparent` in message attributes, plus a `correlationId` (the business flow) and a `causationId` (the parent message). Retain events long enough to replay (Pub/Sub seek to a timestamp or snapshot, Kafka offset reset), and keep consumers replay-safe. Replaying into production consumers is outward-facing: confirm scope and target with the user first.

   **Check:** You can follow one order across every service in the trace view, and a replay into a staging consumer reproduces identical state.

## Patterns

### Event envelope (CloudEvents, JSON)

```json
{
  "specversion": "1.0",
  "id": "8f2c1e9a-3b7d-4c55-9a51-0d2f6e7b1c42",
  "source": "//orders.acme.internal/orders",
  "type": "com.acme.order.placed.v1",
  "subject": "orders/42",
  "time": "2026-11-22T10:15:00Z",
  "datacontenttype": "application/json",
  "data": { "orderId": "42", "customerId": "c-7", "totalMinor": 4599, "currency": "EUR", "version": 1 }
}
```

### Choreography vs orchestration

| | Choreography | Orchestration |
| :--- | :--- | :--- |
| Control | Each service reacts to events | A coordinator issues commands and tracks state |
| Good for | Few steps, stable flows, high autonomy | Many steps, timeouts, human approvals, audits |
| Risk | Cyclic dependencies; nobody sees the whole flow | Coordinator becomes a god service if it holds domain logic |
| Tools | Topics and subscriptions | Workflows, Temporal, Step Functions, a saga table |

### Delivery guarantees in practice

At-most-once loses data; at-least-once duplicates it. "Exactly-once" features (Kafka transactions, Pub/Sub exactly-once delivery) cover the broker hop only, not your database or third-party calls, so idempotent consumers remain mandatory. Verify each broker's current guarantees against its docs.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `commit()` then `publish()` | Transactional outbox or CDC | A crash between the two loses the event |
| Disguise RPC as events (`SendEmailRequested` aimed at one service) | Send a command to the owner | Hidden coupling with none of the benefits |
| Demand global ordering | Per-aggregate keys plus version checks | One partition caps throughput |
| Consumers read the producer's database | Fat events or the producer's API | A shared schema couples deploys |
| Put whole aggregates and PII in events | Only the fields consumers need; PII by reference | Events live in logs, replicas and DLQs indefinitely |
| Assume exactly-once | Idempotent consumers keyed by event ID | Redelivery happens on every broker |
| Retry poison messages forever | Bounded attempts, then a DLQ with an alert | One bad message stalls an ordered key |

## Verification checklist

- [ ] Every event is past tense, owned, schematized and versioned; CI checks compatibility.
- [ ] Producers use an outbox or CDC; no dual writes remain.
- [ ] Consumers are idempotent, with duplicate and out-of-order tests.
- [ ] DLQs exist, have owners and alert on depth.
- [ ] Sagas define compensations for every step, with the irreversible step last.
- [ ] Trace context and correlation IDs flow through message attributes.

## Related

- Knowledge: `message-queues`, `pubsub-eventarc`, `domain-driven-design`, `backend-patterns`, `microservices`, `stream-processing`, `webhooks`.
- Workflows: `/architecture-decision`, `/write-spec`.
- Agents: `code-architect`, `backend-engineer`, `silent-failure-hunter`.
