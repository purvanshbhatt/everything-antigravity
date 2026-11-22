---
trigger: glob
globs: "**/*.proto"
description: Protocol Buffers and gRPC schema conventions
---

# Protocol Buffers

## Tooling

- Use `proto3` (or Editions where the project has adopted them) consistently across a package.
- Lint and check compatibility with Buf: `buf lint` and `buf breaking --against <main branch or registry>` before finishing. Follow the project's `buf.yaml` rules.
- Format with `buf format -w` (or `clang-format` if the project uses it).
- Regenerate code with the project's command (`buf generate`, `protoc`, a make target) after every change. Never hand-edit generated files.

## Files and packages

- One package per directory; the directory path matches the package (`acme/billing/v1/` for `package acme.billing.v1;`).
- Put the major version in the package (`.v1`, `.v2`). Breaking changes go into a new versioned package, not the existing one.
- Set language options the project expects (`go_package`, `java_package`, `java_multiple_files`, `csharp_namespace`) consistently.
- File names are `lower_snake_case.proto`. Keep one service per file with its request and response messages nearby.

## Naming

- Messages, enums and services in `PascalCase`; fields in `lower_snake_case`; enum values in `UPPER_SNAKE_CASE` prefixed with the enum name (`ORDER_STATUS_PAID`).
- The first enum value is `<ENUM>_UNSPECIFIED = 0`. Never give zero a business meaning.
- RPCs are verbs (`GetOrder`, `ListOrders`, `CreateOrder`). Every RPC has its own request and response message (`GetOrderRequest`, `GetOrderResponse`), even if empty today. Do not use `google.protobuf.Empty` as a top-level request or response.
- Repeated fields use plural names. Units go in names (`timeout_ms`, `size_bytes`) or use well-known types.

## Evolution and compatibility

- Never change a field's number or type, and never reuse a number. Removed fields and names go into `reserved` (both the number and the name).
- Do not rename fields or enum values if JSON or text format is used anywhere; renames break those encodings.
- Adding fields, enum values, messages and RPCs is safe. Removing or changing them is breaking and needs a new version.
- Use `optional` when you must distinguish "not set" from the default value. Use `oneof` for mutually exclusive fields.
- Clients must handle unknown enum values; servers must tolerate unknown fields.

## Types and design

- Use well-known types: `google.protobuf.Timestamp` for instants, `Duration` for spans, `FieldMask` for partial updates, wrappers only when needed.
- Represent money with `google.type.Money` or integer minor units plus currency code, never `float` or `double`.
- Paginate list RPCs with `page_size`, `page_token` and `next_page_token`. Never return unbounded lists.
- Keep messages small and focused; do not embed whole database rows. Avoid deep nesting.
- Follow Google's AIP guidance for resource-oriented APIs where the project uses it (resource names, standard methods).

## gRPC behaviour

- Document every RPC and field with comments: meaning, units, validation and error cases. Comments become generated docs.
- Return canonical status codes (`INVALID_ARGUMENT`, `NOT_FOUND`, `ALREADY_EXISTS`, `PERMISSION_DENIED`, `UNAVAILABLE`) with rich error details where supported.
- Mark idempotent RPCs, accept a request id for retried mutations, and expect clients to set deadlines.
- Validate inputs server-side (for example protovalidate annotations) and never trust client-sent identity fields.
