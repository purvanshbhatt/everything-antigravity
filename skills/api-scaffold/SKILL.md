---
name: api-scaffold
disable-model-invocation: true
description: >-
  Scaffolds a new API endpoint or service contract-first: learns the
  project's layering from an existing endpoint, writes the OpenAPI, protobuf
  or GraphQL contract, adds boundary validation, RFC 9457 errors, auth and
  per-object authorization, writes failing tests first, implements, and
  updates docs. Use when the user asks to add an endpoint, route, resource or
  new API service. Invoke with /api-scaffold.
---

# API Scaffold

Add an endpoint that looks like it was always part of the codebase: same
layering, same error format, same test style, with the contract written and
linted before the handler exists. Every endpoint ships with validation,
authorization and tests for its failure paths, not just the happy path.

Usage: `/api-scaffold <method and path, or resource> [service]`.

## When to use

- "Add a POST /projects endpoint", "create a CRUD API for invoices", "new gRPC method for X".
- Bootstrapping a new small service with its first endpoints.
- Adding a GraphQL query or mutation to an existing schema.

## When not to use

- Deciding the API style or reviewing a breaking change: `api-design`.
- Securing an existing API surface: `api-security`.
- Large features spanning many layers and UI: `/feature-dev` (which can call this for the API part).

## Workflow

1. **Learn the house style.** Find the closest existing endpoint and read it end to end: router registration, handler, service, repository, validation library, error format, auth middleware, logging and tracing, tests and how docs are generated. For a large or unfamiliar repo, delegate to the `codebase-explorer` subagent with "find the endpoint most similar to <new one> and list its files".

   **Check:** You can name the exemplar files you will mirror, one per layer.

2. **Write the contract first.** Resource and path, method, request and response schemas, status codes, error shapes, pagination, filtering, idempotency (an `Idempotency-Key` header for POSTs that create or charge), auth scopes and rate limits. Extend the project's `openapi.yaml`, `.proto` or GraphQL schema, then lint it:

   ```bash
   npx @redocly/cli lint openapi.yaml           # or: npx @stoplight/spectral-cli lint openapi.yaml
   buf lint                                     # protobuf
   ```

   For public or cross-team APIs, show the contract to the user for approval before implementing.

   **Check:** The contract lints clean and every response code has a schema.

3. **Write failing tests first.** Cover the happy path, validation failures, unauthenticated (401), forbidden (403), another tenant's object (404 or 403 per house convention), not found, conflict or duplicate, and idempotent replay where relevant. Delegate to the `test-engineer` subagent if the suite is unfamiliar. Run them.

   **Check:** The new tests fail because the endpoint does not exist yet, not because of setup errors.

4. **Implement thinly, layer by layer.** Route, then boundary validation (zod, Pydantic, go-playground/validator, Bean Validation, matching the project), then a thin handler, then the service with business rules, then the repository. Check authorization per object, not just per route. Map domain errors to the project's error format (RFC 9457 problem details if it has none). Generate types from the contract if the project already does (openapi-typescript, oapi-codegen, datamodel-code-generator). Schema changes go through `database-migrations` (expand and contract).

   **Check:** All new tests pass, and no handler contains business logic or raw SQL.

5. **Make it operable.** Structured logs without secrets or personal data, a trace span, metrics if the project records them per route, and timeouts on outbound calls.

   **Check:** A request in local logs shows the route, status and latency with no sensitive fields.

6. **Document.** Descriptions and examples in the contract, changelog entry, and README or API docs if they are hand-written.

   **Check:** Generated docs render the new endpoint with an example request and response.

7. **Verify and review.** Run `/verify`, then `/code-review` on the diff and a security pass with the `security-guard` subagent for anything touching auth, money or personal data.

   **Check:** Gates pass and review findings are resolved or recorded.

## Patterns

FastAPI shape (mirror your own stack's equivalent):

```python
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/v1/projects", tags=["projects"])

class ProjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)

class ProjectOut(BaseModel):
    id: str
    name: str

@router.post("", status_code=status.HTTP_201_CREATED, response_model=ProjectOut)
async def create_project(body: ProjectIn, user=Depends(current_user), svc=Depends(project_service)):
    return await svc.create(owner_id=user.id, name=body.name)   # authz and rules live in the service
```

Problem details error (`Content-Type: application/problem+json`):

```json
{
  "type": "https://api.example.com/problems/validation-error",
  "title": "Request validation failed",
  "status": 422,
  "detail": "name must be between 1 and 100 characters",
  "instance": "/v1/projects"
}
```

| Situation | Status |
| :--- | :--- |
| Created | 201 with `Location` header |
| Accepted for async processing | 202 with a status URL |
| Malformed or invalid input | 400 or 422 (follow the house convention) |
| Missing or invalid credentials | 401 |
| Authenticated but not allowed | 403 (or 404 to avoid revealing existence) |
| Duplicate or state conflict | 409 |
| Rate limited | 429 with `Retry-After` |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Invent a new layering or error format | Mirror the exemplar endpoint | Inconsistency costs every future reader |
| Write the handler, then the contract | Contract first, linted | Clients and tests need a stable target |
| Check auth only at the route | Authorize per object in the service | Route checks miss IDOR across tenants |
| Test only the happy path | Test 401, 403, 404, 409 and validation | Failure paths are where security bugs live |
| Return stack traces or SQL errors | Map to problem details; log internally | Leaks internals to attackers |

## Verification checklist

- [ ] Exemplar endpoint identified and mirrored per layer.
- [ ] Contract written and linted before implementation; approved if public.
- [ ] Tests for happy and failure paths written first, then passing.
- [ ] Boundary validation, per-object authorization and consistent errors.
- [ ] Logs, traces and timeouts in place without sensitive data.
- [ ] Docs updated; `/verify` and `/code-review` done.

## Related

- Knowledge: `api-design`, `api-security`, `api-testing`, `contract-testing`, `sdk-generation`, `backend-patterns`, `python-fastapi`, `graphql-servers`, `grpc-services`, `database-migrations`.
- Workflows: `/verify`, `/code-review`, `/feature-dev`, `/threat-modeling`.
- Agents: `codebase-explorer`, `test-engineer`, `security-guard`, `backend-engineer`.
