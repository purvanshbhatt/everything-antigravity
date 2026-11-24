---
name: graphql-servers
disable-model-invocation: true
description: >-
  Builds and reviews GraphQL servers: client-driven schema design,
  nullability, cursor connections, mutation payloads, per-request DataLoader
  batching, object-level authorization, depth and cost limits, trusted
  documents, error modelling, subscriptions and federated subgraphs. Use when
  designing a GraphQL schema, fixing N+1 resolvers, hardening a public GraphQL
  endpoint or splitting a graph across services.
---

# GraphQL Servers

A GraphQL endpoint lets clients compose arbitrary queries, so every field is an
entry point that a careless or hostile client can multiply. Design the schema
from real client operations, batch every resolver that does I/O, authorize per
object, and bound the cost of every operation before it ships.

## When to use

- Designing or reviewing a schema (SDL) or a schema change.
- Resolvers issue one query per list item (N+1), or latency grows with query nesting.
- Exposing a GraphQL endpoint to third parties or the public internet.
- Adding subscriptions, or composing several services into one graph (federation).

## When not to use

- Choosing between REST, gRPC and GraphQL, or HTTP conventions: use `api-design`.
- Internal service-to-service RPC with strict contracts: use `grpc-services`.
- Socket transport concerns (heartbeats, scaling connections): use `realtime-websockets`.
- A full API security assessment: use `api-security` with the `security-guard` subagent.

## Workflow

1. **Start from operations, not tables.** List the screens or integrations and the exact queries and mutations they need. Keep the SDL (`schema.graphql`) in the repo and generate types from it (GraphQL Code Generator, gqlgen, Strawberry) rather than hand-writing both sides.

   **Check:** Every new type and field traces to a named consumer; nothing exists "in case".

2. **Decide nullability deliberately.** Fields are nullable by default. A null in a non-null (`!`) field propagates to the nearest nullable parent, so one failing non-null leaf can blank a whole list. Make a field non-null only when it cannot fail independently. Use `ID!` for identifiers, enums for closed sets, and documented custom scalars (`DateTime`, `Money`).

   **Check:** For each `!` field you can answer "what does the client see when this resolver throws?"

3. **Shape lists and mutations.** Paginate every unbounded list with cursor connections (`first`/`after`, `edges { cursor node }`, `pageInfo { hasNextPage endCursor }`) and cap `first` (for example 100). Give each mutation one input and one payload: `createOrder(input: CreateOrderInput!): CreateOrderPayload!`, where the payload carries the result plus `userErrors { field message code }`.

   **Check:** No list field returns an unbounded array; no mutation takes more than one argument.

4. **Batch I/O with per-request DataLoaders.** Create loaders when building the request context, never as module globals, because a global loader caches one user's data for the next. The batch function must return results in the same order and length as its keys (example below).

   **Check:** With query logging on, a three-level nested query issues one database query per type per level, not one per parent.

5. **Authenticate in context, authorize in the domain.** Resolve the caller once per request. Enforce object-level checks in the service or loader layer (`canRead(user, order)`), not only in root resolvers, because nested fields reach the same objects by other paths. Removing a type from the schema is not access control.

   **Check:** A test fetches another tenant's object through a nested path (`viewer { team { orders } }`) and receives null or an error.

6. **Bound operation cost.** Enforce maximum depth, maximum aliases, a complexity or cost budget, a server timeout and a cap on batched operations per HTTP request. Options include GraphQL Armor, `graphql-depth-limit` plus `graphql-query-complexity` (JS), `extension.FixedComplexityLimit` (gqlgen), `QueryDepthLimiter` (Strawberry) and router-level limits. For first-party clients, ship trusted documents: an allowlist of operation hashes extracted at build time, with unknown operations rejected in production. Automatic persisted queries only save bandwidth; any client can register one. Disable introspection on private production endpoints, but never rely on that alone.

   **Check:** A 15-level nested query and a query with 500 aliases are both rejected before execution.

7. **Model errors.** Expected business outcomes (validation failure, not found, conflict) belong in the schema as payload `userErrors` or result unions. The top-level `errors` array is for unexpected failures: mask internal messages and attach a stable `extensions.code`.

   **Check:** No stack trace or SQL text reaches a client; clients branch on codes, never on message strings.

8. **Evolve without breaking clients.** Make additive changes. Remove a field only after `@deprecated(reason: "...")` and usage data show no remaining traffic. Gate CI on a schema diff: `graphql-inspector diff old.graphql new.graphql`, or `rover subgraph check` when a GraphOS registry is in use.

   **Check:** CI fails on a breaking change unless it is explicitly approved.

9. **Add subscriptions and federation only when needed.** Subscriptions: use the `graphql-ws` protocol (the older `subscriptions-transport-ws` is unmaintained) or GraphQL over SSE, and fan out through Pub/Sub or Redis so any instance can publish. Federation: each subgraph owns its types, marks entities with `@key(fields: "id")` and implements a reference resolver backed by a DataLoader; a router composes the supergraph. Verify the federation spec version against current docs.

   **Check:** An entity referenced by 50 parent objects causes one batched reference lookup per subgraph.

## Patterns

### Per-request DataLoader (TypeScript)

```ts
import DataLoader from 'dataloader';

export function createLoaders(db: Db) {
  return {
    userById: new DataLoader<string, User | null>(async (ids) => {
      const rows = await db.user.findMany({ where: { id: { in: [...ids] } } });
      const byId = new Map(rows.map((u) => [u.id, u]));
      return ids.map((id) => byId.get(id) ?? null); // same order and length as ids
    }),
  };
}

// Built per request, so cached values never cross users.
export const context = async ({ req }) => ({ user: await authenticate(req), loaders: createLoaders(db) });
// Resolver: Order: { customer: (order, _args, ctx) => ctx.loaders.userById.load(order.customerId) }
```

### Server and batching options

| Stack | Servers | Batching |
| :--- | :--- | :--- |
| Node/TS | Apollo Server, GraphQL Yoga, Mercurius | `dataloader` |
| Python | Strawberry, Ariadne | Strawberry `DataLoader`, aiodataloader |
| Go | gqlgen | dataloadgen, graph-gophers/dataloader |
| JVM | Spring for GraphQL, Netflix DGS, graphql-java | java-dataloader |
| .NET | Hot Chocolate | built-in DataLoader |
| Rust | async-graphql | built-in DataLoader |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Resolve each child with its own query | Per-request DataLoader | N+1 turns one request into hundreds of queries |
| Share one DataLoader across requests | Create loaders in the request context | The cache serves one user's data to another |
| Authorize only in root resolvers | Check per object in the domain or loader layer | Nested paths reach the same objects |
| Return raw arrays for collections | Connections with a capped `first` | Unbounded lists become outages as data grows |
| Throw for validation failures | Payload `userErrors` or result unions | Clients get typed, field-level errors |
| Mirror database tables as types | Model client concepts; hide storage | Every migration becomes a breaking schema change |
| Treat disabled introspection as security | Depth and cost limits plus trusted documents | Schemas leak through client bundles anyway |

## Verification checklist

- [ ] Every list field is paginated with a capped page size.
- [ ] DataLoaders are created per request, and query counts were measured on a nested query.
- [ ] Object-level authorization is tested through at least one nested path.
- [ ] Depth, alias, cost, batch and timeout limits are enforced and tested.
- [ ] Internal errors are masked; `extensions.code` values are stable and documented.
- [ ] A schema diff check runs in CI.

## Related

- Knowledge: `api-design`, `api-security`, `backend-patterns`, `realtime-websockets`, `microservices`, `contract-testing`, `sdk-generation`.
- Workflows: `/api-scaffold`, `/code-review`.
- Agents: `backend-engineer`, `code-architect`, `security-guard`.
