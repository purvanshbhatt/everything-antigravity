---
trigger: glob
globs: "**/*.graphql, **/*.gql"
description: GraphQL schema and operation conventions
---

# GraphQL

## Tooling

- Validate the schema and operations with the project's tools (GraphQL ESLint, `graphql-inspector`, Apollo Rover, codegen) before finishing.
- Check schema changes for breakage against the main branch or the registry (`graphql-inspector diff`, `rover subgraph check`).
- Regenerate types and clients after changes (`graphql-codegen`, `gqlgen generate`, Strawberry or Hot Chocolate tooling). Never hand-edit generated files.

## Naming

- Types, interfaces, unions, enums and inputs in `PascalCase`; fields and arguments in `camelCase`; enum values in `UPPER_SNAKE_CASE`.
- Queries are nouns (`order`, `orders`); mutations are verb-first (`createOrder`, `cancelOrder`); subscriptions describe events (`orderUpdated`).
- Name every operation (`query OrderDetails { ... }`). No anonymous operations in application code.

## Schema design

- Design for client use cases, not database tables. Do not expose internal ids, join tables or storage details.
- Make fields non-null (`!`) only when the server can always return them, including on partial failure. A non-null field that errors nulls its parent; choose nullability deliberately.
- Use one `input` type per mutation (`createOrder(input: CreateOrderInput!)`) and a dedicated payload type that returns the changed object plus expected errors.
- Model expected domain errors in the schema (union results or `userErrors` fields); reserve top-level `errors` for unexpected failures.
- Paginate every list that can grow, with cursor connections (`first`, `after`, `edges`, `node`, `pageInfo`) or the project's established pattern. No unbounded lists.
- Use custom scalars for structured values (`DateTime` in ISO 8601 UTC, `URL`, `Email`) and document their format. Represent money as an object with amount in minor units and currency.
- Use interfaces and unions for polymorphism; implement the `Node` interface with global ids where the project uses Relay conventions.
- Document every type, field and argument with a description string.

## Evolution

- Additive changes are safe: new types, new nullable fields, new optional arguments, new enum values (if clients handle unknown values).
- Never remove or rename fields, change types, or make nullable fields non-null in place. Deprecate with `@deprecated(reason: "Use newField")`, track usage, then remove after clients migrate.
- Do not version the endpoint (`/v2/graphql`); evolve the schema.

## Operations (client side)

- Request only the fields the component needs. Use fragments colocated with components.
- Pass values as variables, never by string interpolation into the document.
- Use persisted or trusted documents in production where the server supports them.

## Security and performance

- Authorize in resolvers or the domain layer per object and per field, not only at the gateway. Never trust ids from the client for ownership.
- Enforce query depth and complexity limits, pagination maximums, and timeouts. Disable introspection in production unless the API is public by design.
- Batch and cache data loading per request (DataLoader or equivalent) to prevent N+1 queries.
- Return generic messages for unexpected errors; keep stack traces in server logs.
