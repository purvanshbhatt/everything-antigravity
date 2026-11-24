---
name: api-design
description: >-
  Designs and reviews REST, gRPC and GraphQL APIs: resources, errors, pagination, idempotency, versioning and contract tests.
---

# API Design

An API is a contract you cannot take back once a client depends on it. Design
the contract first, lint it, diff it against the last release for breaking
changes, and test both sides against it.

## When to use

- New endpoint, resource, RPC or GraphQL type; "what should this API look like?"
- Reviewing a change that touches request or response shapes, error codes or auth.
- Choosing pagination, error format, versioning or idempotency strategy.
- Deciding REST vs gRPC vs GraphQL for a new surface.

## When not to use

- Internal module boundaries inside one process: use `software-architecture`.
- Retries, outbox and transactions behind the endpoint: use `backend-patterns`.
- Token formats, OAuth flows and session handling: use `auth-patterns`.
- Framework specifics: `python-fastapi`, `golang-services`, `frontend-react-nextjs` (route handlers).

## Workflow

1. **Pick the style.** REST (OpenAPI) for public and browser-facing APIs and broad tooling; gRPC for internal service-to-service with streaming and strict typing; GraphQL when many clients need different shapes of a connected graph. Don't mix styles for the same consumer without a reason.

   **Check:** The choice and its reason fit in one sentence of the design doc.

2. **Model resources and operations before URLs.** List the nouns, their identifiers, relationships and lifecycle states. Map operations to methods (table below). Non-CRUD actions become sub-resources (`POST /orders/{id}/cancellation`) or custom methods (`POST /orders/{id}:cancel`, Google AIP style); pick one convention per API.

   **Check:** Every operation maps to exactly one method and path, and no path contains a verb except a documented custom method.

3. **Write the contract first.** OpenAPI 3.1 for REST, `.proto` for gRPC, SDL for GraphQL. Include examples, error responses and auth requirements. Lint it:

   ```bash
   npx @stoplight/spectral-cli lint openapi.yaml      # or: npx @redocly/cli lint openapi.yaml
   buf lint                                           # protobuf
   ```

   **Check:** Linter passes with zero errors; every operation documents at least one 4xx response.

4. **Diff against the released contract on every PR.**

   ```bash
   oasdiff breaking base/openapi.yaml openapi.yaml --fail-on ERR
   buf breaking --against '.git#branch=main'
   npx @graphql-inspector/cli diff old.graphql new.graphql
   ```

   **Check:** CI fails on a breaking change unless the PR also bumps the major version.

5. **Generate, don't hand-write, the glue.** Server stubs or request validators and client SDKs come from the contract (openapi-generator, openapi-typescript, oapi-codegen, `buf generate`, graphql-codegen). Validate requests against the schema at the edge.

   **Check:** Changing a field in the contract produces a compile or test failure in the code that uses it.

6. **Add contract tests.** Provider-side: Schemathesis (`st run http://localhost:8000/openapi.json`) fuzzes every operation against the spec. Consumer-driven: Pact, with `can-i-deploy` gating releases. See `tdd-testing` for the test strategy.

   **Check:** A deliberately wrong response field makes a contract test fail.

7. **Review with the checklist below** and present the contract as an implementation-plan artifact before implementing handlers.

## Reference

### Methods and status codes

| Operation | Method and path | Success | Common errors |
| :--- | :--- | :--- | :--- |
| List | `GET /orders?cursor=&limit=` | 200 | 400 bad filter |
| Read | `GET /orders/{id}` | 200 (304 with ETag) | 404 |
| Create | `POST /orders` + `Idempotency-Key` | 201 + `Location` | 409 duplicate, 422 validation |
| Replace | `PUT /orders/{id}` + `If-Match` | 200 / 204 | 412 stale ETag, 428 missing `If-Match` |
| Partial update | `PATCH /orders/{id}` (`application/merge-patch+json`) | 200 | 422 |
| Delete | `DELETE /orders/{id}` | 204 (also on repeat) | 404 only if never existed is a policy choice |
| Long-running | `POST /exports` | 202 + `Location: /operations/{id}` | |

Auth: 401 when credentials are missing or invalid, 403 when authenticated but not allowed. Return 404 instead of 403 when revealing existence is itself a leak. 429 for rate limits with `Retry-After`. 5xx only for server faults, never for bad input.

### Errors: RFC 9457 problem details

```http
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json

{
  "type": "https://api.example.com/problems/validation-error",
  "title": "Request validation failed",
  "status": 422,
  "detail": "2 fields are invalid.",
  "instance": "/orders/req_01HV...",
  "errors": [{ "pointer": "/items/0/quantity", "detail": "must be >= 1" }]
}
```

`type` is a stable URI clients switch on; `title` does not change per occurrence; extension members (`errors`, `trace_id`) are allowed. Never leak stack traces or SQL in `detail`.

### Cursor pagination

- Response: `{ "data": [...], "next_cursor": "eyJpZCI6...", "has_more": true }`, or an RFC 8288 `Link: <...>; rel="next"` header.
- The cursor is opaque (base64 of the last row's sort key plus ID) and the query uses a keyset predicate: `WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT $3`.
- Sort must be total (append the unique ID). Cap `limit` (for example max 100) and document the default.
- Offset pagination only for small, admin-style lists where page jumping matters.

### Idempotency keys

- Clients send `Idempotency-Key: <uuid>` on non-idempotent `POST`s (pattern popularised by Stripe; an IETF draft standardises the header).
- Server stores `(key, principal, request_hash) -> status, response body` for 24 h or more. Same key and same body replays the stored response. Same key and a different body returns 422. A concurrent duplicate while the first is in flight returns 409.
- Store the key in the same transaction as the side effect, or the guarantee is fiction (see `backend-patterns`).

### Versioning and evolution

- Additive changes are safe: new optional fields, new endpoints, new enum values only if clients were told to tolerate unknown values.
- Breaking: removing or renaming fields, changing types or meaning, making optional fields required, tightening validation, changing defaults or error codes.
- REST: major version in the path (`/v1/`) or a dated header version; deprecate with the `Deprecation` and `Sunset` headers and a published timeline.
- gRPC and protobuf: never reuse or renumber fields; `reserved` removed numbers and names; enum zero value is `*_UNSPECIFIED`; new major version means a new package (`acme.orders.v2`). Details in [gRPC and GraphQL](references/grpc-graphql.md).

### Rate limiting

- Limit per principal (API key, user, tenant), not only per IP. Token bucket for bursts, sliding window for fairness.
- Return 429 with `Retry-After`. Advertise limits with `RateLimit-Policy` / `RateLimit` (IETF draft) or the de facto `X-RateLimit-*` headers; pick one and document it.
- Enforce at the gateway (Cloud Armor, API Gateway, Apigee, Envoy) and again in-app for expensive operations.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `200 OK` with `{"error": ...}` | Proper 4xx/5xx plus problem+json | Clients, caches, retries and monitoring all key off the status code |
| Offset pagination on large, changing tables | Keyset cursor | Offsets skip or duplicate rows under writes and get slower with depth |
| Expose database IDs and columns 1:1 | Model resources for clients; map in the adapter | The schema becomes frozen by every client |
| Retry-unsafe `POST` with no idempotency key | `Idempotency-Key` stored with the side effect | Network retries double-charge and double-create |
| Breaking change behind the same version | New version, or additive change plus deprecation window | Silent breakage of clients you don't control |
| GraphQL resolvers that query per parent | Per-request DataLoader batching | N+1 queries turn one request into hundreds |
| Hand-written client SDKs | Generated from the contract | Hand-written clients drift from the server |

## Verification checklist

- [ ] Contract file exists, lints clean and has examples for each operation.
- [ ] Breaking-change diff runs in CI against the last released contract.
- [ ] Every operation documents auth, success and at least one error response in problem+json.
- [ ] List endpoints are cursor-paginated with a capped `limit` and a total sort order.
- [ ] Unsafe `POST`s accept `Idempotency-Key`; replay and conflict cases are tested.
- [ ] Rate limits return 429 with `Retry-After`.
- [ ] Contract tests run against the provider (Schemathesis or Pact verification).

## Related

- Knowledge: `backend-patterns`, `auth-patterns`, `software-architecture`, `python-fastapi`, `golang-services`, `observability-otel`, `tdd-testing`.
- Workflows: `/blueprint`, `/code-review`, `/update-docs` (publish the reference docs), `/security-scan`.
- Agents: `code-architect`, `code-reviewer`, `security-guard`.
