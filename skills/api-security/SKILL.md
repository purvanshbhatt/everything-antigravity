---
name: api-security
description: >-
  Secures HTTP, GraphQL and gRPC APIs against the OWASP API Security Top 10:
  object- and property-level authorization, authentication and token checks,
  rate and resource limits, schema-enforced input validation, SSRF, inventory
  and safe consumption of third-party APIs, with authz-matrix tests. Use when
  building or reviewing an API, adding endpoints, or hardening a public or
  partner API.
---

# API Security

APIs fail on authorization far more often than on injection. Check access to
every object and every field on the server, bound every resource a caller can
consume, and let a schema reject anything you did not expect.

## When to use

- Designing or reviewing endpoints, resolvers or RPC methods.
- Opening an API to partners, mobile clients or the public internet.
- A pentest or bug report mentions IDOR/BOLA, mass assignment or rate limiting.
- Adding an API gateway, API keys or OAuth scopes.

## When not to use

- Resource modelling, versioning and error formats: use `api-design`.
- Login, sessions and token issuance design: use `auth-patterns`.
- Whole-application audit across all layers: use `security-audit`.
- Live testing of a deployed API: use `web-pentest-authorized`.

## Workflow

1. **Inventory every API surface.** List routes, GraphQL operations, gRPC methods, webhooks and versions, including internal and deprecated ones. Use `grep_search` on route decorators and router registrations; compare with the OpenAPI/proto/GraphQL schema and gateway config.

   **Check:** Every deployed endpoint appears in the spec, with owner, auth requirement and data classification. Undocumented endpoints are findings.

2. **Enforce object-level authorization.** Every handler that takes an ID must load the object scoped by the caller (owner, tenant, role), in the data-access layer, not only at the router.

   ```python
   order = db.orders.get(id=order_id, tenant_id=ctx.tenant_id)   # scoped lookup
   if order is None:
       raise NotFound()          # 404, not 403, so IDs cannot be enumerated
   if not policy.can(ctx.user, "order:refund", order):
       raise Forbidden()
   ```

   **Check:** `grep_search` finds no unscoped lookups (`get(id=` without tenant/owner) in handlers.

3. **Enforce property-level authorization.** Bind request bodies to explicit DTOs with an allowlist of writable fields; serialize responses through explicit output schemas. Never pass the raw request into an ORM update or return raw model objects.

   **Check:** Sending `role`, `tenant_id`, `price` or `is_admin` in an update body has no effect; responses contain no internal fields.

4. **Enforce function-level authorization.** Admin and internal operations get separate routes and checks, deny by default. GraphQL: authorize in resolvers or a directive, per field where data sensitivity differs.

   **Check:** The authz matrix test (below) passes for every role.

5. **Verify authentication correctly.** Validate JWT signature with a pinned algorithm, `exp`, `nbf`, `iss` and `aud`; reject unsigned tokens; keep access tokens short-lived. API keys: hash at rest, scope per key, rotate, and identify the caller in logs by key ID only.

   **Check:** Tests cover expired, wrong-audience, wrong-algorithm and tampered tokens.

6. **Validate input against the schema.** Validate requests at the edge from the OpenAPI/proto/GraphQL schema: types, formats, lengths, enums, `additionalProperties: false`. Lint the spec with Spectral (the OWASP ruleset exists as `@stoplight/spectral-owasp-ruleset`).

   **Check:** Requests with unknown fields, oversized strings or wrong types are rejected with 400 before handler code runs.

7. **Bound resource consumption.** Rate limit per principal and per IP (token bucket at the gateway or Redis), cap page size, request body size, upload size, batch size, GraphQL depth and complexity, and set timeouts on every downstream call. Protect costly business flows (signup, checkout, SMS, LLM calls) with per-account quotas and abuse detection.

   **Check:** Exceeding each limit returns 429 or 413 with `Retry-After` where relevant; no endpoint accepts an unbounded `limit`.

8. **Handle outbound calls safely.** For user-supplied URLs, allowlist hosts, resolve and block private and metadata IP ranges, disable redirects or re-check after each. Treat third-party API responses as untrusted input: validate, time out, and limit size.

   **Check:** A URL pointing at `169.254.169.254` or `localhost` is rejected.

9. **Test continuously.** Add the authz matrix to CI, run `zap-api-scan.py` against staging with the spec, and fuzz with a schema-based tool such as Schemathesis (check its current CLI flags).

## Reference

### OWASP API Security Top 10 (2023)

| ID | Risk | Primary control |
| :--- | :--- | :--- |
| API1 | Broken Object Level Authorization | Scoped lookups, policy check per object |
| API2 | Broken Authentication | Correct token validation, rate-limited auth flows |
| API3 | Broken Object Property Level Authorization | Input and output DTO allowlists |
| API4 | Unrestricted Resource Consumption | Rate limits, size and page caps, timeouts |
| API5 | Broken Function Level Authorization | Deny by default, separate admin checks |
| API6 | Unrestricted Access to Sensitive Business Flows | Per-account quotas, bot and abuse controls |
| API7 | Server Side Request Forgery | Allowlists, IP checks, no redirects |
| API8 | Security Misconfiguration | Headers, CORS allowlist, no verbose errors |
| API9 | Improper Inventory Management | Spec-as-source, retire old versions |
| API10 | Unsafe Consumption of APIs | Validate third-party responses, TLS, timeouts |

### Authz matrix test

```python
CASES = [  # (role, method, path, expected_status)
    ("tenant_a_user", "GET", "/orders/{a_order}", 200),
    ("tenant_b_user", "GET", "/orders/{a_order}", 404),
    ("tenant_a_user", "POST", "/admin/refunds", 403),
]

@pytest.mark.parametrize("role,method,path,expected", CASES)
def test_authz(client_for, fixtures, role, method, path, expected):
    resp = client_for(role).request(method, path.format(**fixtures))
    assert resp.status_code == expected
```

### CORS

Allowlist exact origins; never reflect the `Origin` header with `Access-Control-Allow-Credentials: true`. Public read-only APIs may use `*` without credentials.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Rely on unguessable UUIDs for access control | Check ownership on every lookup | IDs leak through logs, URLs and shared links |
| `Model.update(**request.json)` | Explicit writable-field DTOs | Mass assignment lets users set roles and prices |
| Return ORM objects directly | Output schemas per role | Internal and sensitive fields leak silently |
| Rate limit only by IP | Limit by principal and IP, plus per-flow quotas | Attackers rotate IPs; costly flows need business limits |
| Leave v1 running "for old clients" without owners | Inventory, monitor usage, sunset with dates | Forgotten versions lack newer fixes |
| Trust a partner API's response shape | Validate and bound it | A compromised or buggy upstream becomes your vulnerability |

## Verification checklist

- [ ] Every endpoint is inventoried with owner, auth and data class.
- [ ] Object, property and function-level authorization are enforced server-side.
- [ ] Token validation checks signature, algorithm, expiry, issuer and audience.
- [ ] Schema validation rejects unknown fields and oversized input.
- [ ] Rate, size, page, depth and timeout limits exist for every endpoint.
- [ ] The authz matrix runs in CI and passes.

## Related

- Knowledge: `api-design`, `auth-patterns`, `security-audit`, `graphql-servers`, `grpc-services`, `redis-caching`, `api-testing`.
- Workflows: `/threat-modeling`, `/api-scaffold`, `/security-scan`, `/code-review`.
- Agents: `security-guard`, `backend-engineer`.
