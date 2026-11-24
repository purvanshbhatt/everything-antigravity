---
name: api-testing
disable-model-invocation: true
description: >-
  Builds API test suites that catch real bugs: in-process HTTP tests
  (supertest, httpx with FastAPI, Go httptest, Spring MockMvc), black-box
  suites against deployed environments (Postman/Newman, Bruno, Hurl, .http
  files), auth and object-level authorization matrices, OpenAPI response
  validation and Schemathesis fuzzing. Use when adding tests for REST or HTTP
  endpoints, or smoke-testing an API in CI or after deploy.
---

# API Testing

Test the API the way clients use it: real HTTP requests, real serialization,
real auth. Cover the unhappy paths (validation, authorization, conflicts) as
thoroughly as the happy path, because that is where production incidents and
security bugs live.

## When to use

- New or changed endpoints need tests.
- Verifying authentication and per-object authorization (one user cannot read another's data).
- Responses must match the published OpenAPI schema.
- Post-deploy smoke tests or a shared request collection for the team.

## When not to use

- Cross-service compatibility between independently deployed teams: use `contract-testing`.
- Throughput, latency and capacity: use `load-testing`.
- Browser flows through the UI: use `/e2e`.
- Adversarial security testing: use `api-security` and `web-pentest-authorized` (only with written authorization).

## Workflow

1. **Build the endpoint matrix.** For each endpoint list: success cases, validation failures, unauthenticated, wrong role, other tenant or owner, not found, conflict or idempotency replay, pagination edges, and rate limiting.

   **Check:** Every endpoint has rows for 2xx, 4xx validation, 401, 403 or 404 for foreign objects, and its specific conflict cases.

2. **Choose the layer** (table below). Most cases belong in fast in-process tests; keep a thin black-box smoke suite for deployed environments.

   **Check:** The in-process suite runs on every pull request in under a few minutes.

3. **Set up fixtures.** Each test creates the data it needs through factories or the API itself, with unique identifiers so tests can run in parallel. Mint test tokens per role in a fixture; never use real user credentials or production keys.

   **Check:** Tests pass in random order and in parallel (`pytest -n auto` with pytest-xdist, plus pytest-randomly which shuffles once installed; `vitest --sequence.shuffle`; `go test -shuffle=on ./...`).

4. **Write tests against the HTTP surface.**

   ```python
   import pytest
   from httpx import ASGITransport, AsyncClient
   from app.main import app

   @pytest.mark.anyio
   async def test_cannot_read_other_tenants_order(order_for_tenant_b, token_for_tenant_a):
       async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
           r = await client.get(f"/orders/{order_for_tenant_b.id}",
                                headers={"Authorization": f"Bearer {token_for_tenant_a}"})
       assert r.status_code == 404          # do not reveal existence
       assert r.headers["content-type"].startswith("application/problem+json")
   ```

   **Check:** Each test asserts status, the relevant body fields, and important headers, not only the status code.

5. **Validate responses against the schema.** Validate bodies against the OpenAPI document in tests (for example `jsonschema` in Python or `ajv` in JavaScript), and run a property-based fuzzer such as Schemathesis against a local or ephemeral environment to find 500s and schema violations. Check current CLI syntax with `schemathesis run --help`, because options changed between major versions.

   **Check:** The fuzzer reports no server errors or schema mismatches on the changed endpoints.

6. **Add a deployed smoke suite.** A short collection (Newman, Bruno, Hurl) that runs after each deploy against staging, using CI secrets for tokens. Running suites that create data against production needs explicit user confirmation and dedicated test accounts.

   ```bash
   newman run api.postman_collection.json -e staging.postman_environment.json --reporters cli,junit
   hurl --test --variable host=https://staging.example.test smoke/*.hurl
   ```

   **Check:** The smoke job fails the deploy pipeline when a critical endpoint breaks.

## Reference

### Layer choice

| Layer | Tools | Use for |
| :--- | :--- | :--- |
| In-process | supertest (Express, Fastify via inject), httpx `ASGITransport` (FastAPI, Starlette), Go `httptest`, Spring `MockMvc` or `WebTestClient`, ASP.NET `WebApplicationFactory` | Most behaviour, validation and authz cases; fast and debuggable |
| Local stack | Testcontainers or Docker Compose with real database and dependencies | Persistence, transactions, migrations |
| Deployed | Newman, Bruno CLI (`bru run`), Hurl, k6 for checks | Smoke tests, configuration, networking, TLS, gateway rules |
| Editor | `.http` files (REST Client style) committed with the code | Manual exploration that doubles as documentation |

### Assertions worth making

| Area | Assert |
| :--- | :--- |
| Status | Exact code; `201` with `Location` for creates; `204` with empty body |
| Body | Required fields and types; no leaked internals (stack traces, SQL, other users' data) |
| Errors | Consistent problem+json shape with a machine-readable type and field errors |
| Headers | `Content-Type`, caching headers, `Retry-After` on 429 and 503 |
| Authz | Owner allowed; other user denied or 404; admin paths denied for normal roles |
| Idempotency | Same idempotency key replays the first response; different body with the same key is rejected |
| Pagination | Stable ordering, no duplicates or gaps across pages, limit bounds enforced |

### Auth testing

- Generate tokens in fixtures with a test signing key, or call the identity provider's test tenant; keep secrets in CI secret storage.
- Test expired, malformed and wrong-audience tokens, not only missing ones.
- For each resource, test horizontal access (user A to user B's object) and vertical access (user to admin action).

### Test data

Keep fixtures minimal and local to the test. Reset state per test with transactions or truncation, or isolate by tenant. See `test-data-management` for factories, seeding and anonymized data.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Assert only `status == 200` | Assert body, headers and side effects | Wrong payloads pass silently |
| Test only the happy path | Matrix of validation, auth and conflict cases | Incidents and security bugs live in failure paths |
| Share mutable fixtures across tests | Per-test data with unique IDs | Order-dependent, flaky suites |
| Mock the framework's routing and serialization | Real HTTP through the app | Misses middleware, validation and encoding bugs |
| Real credentials or production tokens in collections | Test accounts and CI secrets | Leaks and accidental production changes |
| Run a data-creating suite against production casually | Staging, or confirmed runs with dedicated test accounts | Pollutes real data and metrics |

## Verification checklist

- [ ] Each endpoint has a written case matrix including authz and error paths.
- [ ] Tests run in parallel and random order without failures.
- [ ] Responses are validated against the OpenAPI schema.
- [ ] Horizontal and vertical authorization are tested for every resource type.
- [ ] A post-deploy smoke suite gates the pipeline using secrets from CI.
- [ ] No real credentials or production data appear in tests or collections.

## Related

- Knowledge: `api-design`, `contract-testing`, `test-data-management`, `tdd-testing`, `python-testing`, `load-testing`, `api-security`, `auth-patterns`.
- Workflows: `/tdd`, `/verify`, `/api-scaffold`, `/e2e`.
- Agents: `test-engineer`, `backend-engineer`.
