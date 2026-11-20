# gRPC / protobuf and GraphQL details

## Protobuf evolution rules

| Change | Safe? | Notes |
| :--- | :--- | :--- |
| Add a field with a new number | Yes | Old readers ignore it; old writers leave it at its default |
| Remove a field | Only with `reserved` | `reserved 4; reserved "legacy_status";` stops reuse |
| Rename a field | Wire-safe, JSON-breaking | JSON mapping and generated code use the name |
| Change a field number | No | It is a different field on the wire |
| Change type | Almost never | A few wire-compatible pairs exist (`int32`/`int64`/`uint32`...) but semantics break; add a new field instead |
| `optional` to `repeated` or back | No | Different encoding expectations |
| Add enum value | Yes, if clients handle unknown values | Proto3 keeps unknown values; switch statements need a default branch |
| Remove enum value | Reserve it | `reserved 3; reserved "STATE_LEGACY";` |
| Move field into a `oneof` | No | Changes presence semantics |

Conventions (Google AIP and buf `STANDARD` lint rules):

```proto
syntax = "proto3";
package acme.orders.v1;               // major version in the package

service OrderService {
  rpc GetOrder(GetOrderRequest) returns (Order);
  rpc ListOrders(ListOrdersRequest) returns (ListOrdersResponse);
}

message ListOrdersRequest {
  int32 page_size = 1;                // server caps it
  string page_token = 2;              // opaque cursor
  string filter = 3;
}

message ListOrdersResponse {
  repeated Order orders = 1;
  string next_page_token = 2;         // empty when no more pages
}

enum OrderState {
  ORDER_STATE_UNSPECIFIED = 0;        // zero value means "not set"
  ORDER_STATE_OPEN = 1;
  ORDER_STATE_CLOSED = 2;
}
```

Commands:

```bash
buf lint
buf breaking --against '.git#branch=main'          # or --against buf.build/<org>/<module>
buf generate
```

gRPC status codes: `INVALID_ARGUMENT` (bad input), `NOT_FOUND`, `ALREADY_EXISTS`, `FAILED_PRECONDITION` (state conflict), `PERMISSION_DENIED`, `UNAUTHENTICATED`, `RESOURCE_EXHAUSTED` (rate limit), `UNAVAILABLE` (retryable), `DEADLINE_EXCEEDED`. Attach `google.rpc.ErrorInfo` / `BadRequest` details for machine-readable causes. Always set deadlines on the client and propagate them.

## GraphQL schema design

- Nullability: fields are nullable by default for a reason. A non-null field that fails nulls its parent, potentially the whole response. Make fields non-null only when the server can always produce them.
- Mutations take a single `input` object and return a payload type (`createOrder(input: CreateOrderInput!): CreateOrderPayload!`) with the result plus typed user errors, so you can add fields later.
- Pagination: Relay connection spec (`edges { node cursor }`, `pageInfo { hasNextPage endCursor }`) with `first`/`after`.
- Evolution: add fields freely; deprecate with `@deprecated(reason: "Use totalAmount")`; remove only after usage telemetry shows zero callers.
- Breaking-change check: `npx @graphql-inspector/cli diff old.graphql new.graphql`.

## N+1 and DataLoader

A resolver like `Order.customer` that runs one query per order turns a list of 100 orders into 101 queries. Batch per request:

```ts
import DataLoader from 'dataloader';

// Create loaders per request (in the context factory), never globally:
// a global loader caches across users and leaks data.
export function createLoaders(db: Db) {
  return {
    customerById: new DataLoader<string, Customer | null>(async (ids) => {
      const rows = await db.customers.findMany({ where: { id: { in: [...ids] } } });
      const byId = new Map(rows.map((r) => [r.id, r]));
      return ids.map((id) => byId.get(id) ?? null);   // same order and length as ids
    }),
  };
}

const resolvers = {
  Order: { customer: (order, _args, ctx) => ctx.loaders.customerById.load(order.customerId) },
};
```

Python: `strawberry.dataloader.DataLoader` or `aiodataloader`; Go: `graph-gophers/dataloader` or gqlgen's dataloaden pattern.

Verify: log or count SQL queries per GraphQL request in a test and assert an upper bound.

## GraphQL hardening

- Depth and complexity limits (for example graphql-depth-limit, or cost analysis in your server).
- Persisted (allow-listed) queries for first-party clients; disable arbitrary queries in production if all clients are first-party.
- Disable introspection in production only if it is not a public API; it is not a security boundary by itself.
- Authorise in resolvers or a field-level directive, never only at the gateway: every field is an entry point.
- Batch-attack protection: limit aliases and batched operations per request.
