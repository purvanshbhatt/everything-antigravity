---
name: grpc-services
description: >-
  Designs and operates gRPC services: proto3 API design, backward-compatible
  evolution checked with buf, unary and streaming RPCs, deadlines and
  cancellation, status codes and rich error details, retry service config,
  interceptors, health checks, HTTP/2 load balancing, and REST or browser
  access through gateways. Use when writing .proto files, adding a gRPC
  service, or debugging DEADLINE_EXCEEDED, UNAVAILABLE or uneven load.
---

# gRPC Services

gRPC gives typed contracts and efficient transport, but a contract is only as
stable as the proto discipline behind it, and long-lived HTTP/2 connections
defeat naive load balancing. This skill covers proto design and evolution,
deadlines, errors, retries and day-two operations.

## When to use

- Writing or reviewing `.proto` files, or adding RPCs to an existing service.
- Internal service-to-service APIs where latency, streaming or strict typing matter.
- `DEADLINE_EXCEEDED` cascades, one pod taking all traffic, or clients breaking after a proto change.
- Exposing a gRPC service to browsers or REST clients.

## When not to use

- Public APIs for third parties that expect JSON over HTTP: design REST with `api-design` (or transcode, step 8).
- Flexible client-driven reads across many entities: use `graphql-servers`.
- Asynchronous fan-out between services: use `event-driven-architecture` and `message-queues`.
- Generating and publishing client libraries: use `sdk-generation`.

## Workflow

1. **Lay out versioned packages.** One directory per package version, for example `proto/acme/orders/v1/orders.proto` with `package acme.orders.v1;`. Add a `buf.yaml`, then run `buf lint` and `buf format -w`. Follow the Google API Improvement Proposals (aip.dev) for resource-oriented methods (Get, List, Create, Update, Delete: AIP-131 to AIP-135).

   **Check:** `buf lint` passes and every package path matches its directory.

2. **Design messages for evolution.** Give every RPC its own request and response message (`GetOrderRequest`, `GetOrderResponse`), even when small, and never return a bare primitive or `google.protobuf.Empty` you may later need to extend. Start enums with `ORDER_STATUS_UNSPECIFIED = 0`. Use well-known types: `google.protobuf.Timestamp`, `Duration`, and `FieldMask` for partial updates. Paginate with `page_size`, `page_token` and `next_page_token` (AIP-158). Represent money as `google.type.Money` or integer minor units, never `double`.

   **Check:** No two RPCs share a request message, and no money field is a float.

3. **Gate breaking changes in CI.** Run `buf breaking --against '.git#branch=main'`. Never reuse or renumber a field; when deleting one, add `reserved 4;` and `reserved "legacy_note";`. Changing a field's type, moving it into or out of a `oneof`, or renaming the package breaks the wire format; renaming a field keeps the wire format but breaks JSON mapping and generated code.

   **Check:** CI fails on a deliberately renumbered field in a scratch branch.

4. **Set a deadline on every call.** Derive the deadline from the caller's remaining budget and pass the incoming context to downstream calls so cancellation propagates. Go: `ctx, cancel := context.WithTimeout(ctx, 800*time.Millisecond); defer cancel()`. Java: `stub.withDeadlineAfter(800, TimeUnit.MILLISECONDS)`. Python: `stub.GetOrder(req, timeout=0.8)`. Servers check cancellation inside long loops.

   **Check:** `grep_search` for stub invocations on request paths finds none without a deadline or timeout.

5. **Return precise status codes.** Use the table below, and attach `google.rpc.Status` details (`BadRequest` field violations, `ErrorInfo` with reason and domain, `RetryInfo`) instead of encoding data in message strings.

   **Check:** A validation failure returns `INVALID_ARGUMENT` with field violations, not `INTERNAL`.

6. **Retry declaratively, at one layer.** Configure retries in the client service config, and retry only idempotent methods or methods that accept a request ID. If a service mesh already retries, do not retry in application code as well.

   ```json
   { "methodConfig": [{
       "name": [{ "service": "acme.orders.v1.OrderService" }],
       "timeout": "1s",
       "retryPolicy": { "maxAttempts": 3, "initialBackoff": "0.1s", "maxBackoff": "1s",
                        "backoffMultiplier": 2, "retryableStatusCodes": ["UNAVAILABLE"] } }] }
   ```

   **Check:** Each call path has exactly one documented retry layer.

7. **Put cross-cutting concerns in interceptors.** Authentication (validate `authorization` metadata or the mTLS peer identity), OpenTelemetry tracing and metrics, structured logs with method and status, panic or exception recovery, and message-size limits. Keep business logic out of interceptors.

   **Check:** One trace spans client and server and records the method name and status code.

8. **Make it operable and reachable.** Implement `grpc.health.v1.Health` and use Kubernetes native gRPC probes or `grpc_health_probe`. Enable server reflection outside production so `grpcurl` works:

   ```bash
   grpcurl -plaintext localhost:50051 list
   grpcurl -plaintext -d '{"name":"orders/42"}' localhost:50051 acme.orders.v1.OrderService/GetOrder
   ```

   Windows PowerShell 5.1 strips inner quotes when calling native tools: escape them (`'{\"name\":\"orders/42\"}'`) or use PowerShell 7.3 or later. For browsers use Connect or gRPC-Web; for REST use grpc-gateway (`google.api.http` annotations) or Envoy JSON transcoding.

   **Check:** The health probe fails when a critical dependency is down, and `grpcurl` reaches every method in staging.

9. **Balance per request, not per connection.** HTTP/2 multiplexes RPCs over one long-lived connection, so an L4 load balancer pins each client to one backend. Use an L7 proxy (Envoy, a service mesh, a Google Cloud Application Load Balancer) or client-side `round_robin` against a headless Kubernetes Service, and set a maximum connection age on servers (`MaxConnectionAge` in grpc-go, `GRPC_ARG_MAX_CONNECTION_AGE_MS` in C-core languages) so clients re-resolve. On Cloud Run, enable end-to-end HTTP/2 (`gcloud run deploy --use-http2`) for streaming RPCs.

   **Check:** Under load, per-replica request rates are within about 20% of each other.

## Reference

### Status codes

| Situation | Code | Retry? |
| :--- | :--- | :--- |
| Malformed or invalid request | `INVALID_ARGUMENT` | No |
| Resource missing | `NOT_FOUND` | No |
| Create collides with existing resource | `ALREADY_EXISTS` | No |
| Current state forbids the operation | `FAILED_PRECONDITION` | No, fix state first |
| Concurrency conflict (etag mismatch, aborted transaction) | `ABORTED` | Yes, the whole read-modify-write |
| Missing or invalid credentials | `UNAUTHENTICATED` | After refreshing credentials |
| Authenticated but not allowed | `PERMISSION_DENIED` | No |
| Quota or rate limit | `RESOURCE_EXHAUSTED` | With backoff |
| Transient outage | `UNAVAILABLE` | Yes |
| Deadline passed | `DEADLINE_EXCEEDED` | Only if budget remains |
| Bug or broken invariant | `INTERNAL` | No |

### Streaming

Server streaming suits feeds and large result sets, client streaming suits uploads, and bidirectional streaming suits interactive sessions. Long streams need keepalive settings, resume tokens so a client can reconnect mid-stream, and chunking: most implementations cap received messages at 4 MB by default.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Reuse one request message across RPCs | One request/response pair per RPC | One RPC can't evolve without breaking the other |
| Delete a field and reuse its number | `reserved` the number and the name | Old clients silently decode the wrong data |
| Call without a deadline | Deadline from the caller's budget | Hung calls pile up and exhaust threads and connections |
| Return `INTERNAL` for everything | Precise codes plus error details | Clients can't tell retry from fix-your-input |
| L4 load balancer in front of gRPC | L7 proxy or client-side load balancing | One replica receives all requests |
| Retry in the app, the client config and the mesh | One retry layer | Retries multiply into storms |
| 50 MB unary messages | Chunked streams or signed URLs to object storage | Memory spikes and size-limit failures |

## Verification checklist

- [ ] `buf lint` and `buf breaking` run in CI against the main branch.
- [ ] Every RPC has dedicated request and response messages; removed fields are reserved.
- [ ] Every client call sets a deadline; servers propagate context downstream.
- [ ] Status codes follow the table, with error details for validation failures.
- [ ] One retry layer, limited to idempotent methods and retryable codes.
- [ ] Health service, probes, tracing interceptors and load balancing are verified under load.

## Related

- Knowledge: `api-design`, `microservices`, `sdk-generation`, `contract-testing`, `observability-otel`, `golang-services`, `kubernetes-gke`, `cloud-run`.
- Agents: `backend-engineer`, `go-reviewer`, `code-architect`.
