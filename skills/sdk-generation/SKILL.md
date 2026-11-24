---
name: sdk-generation
disable-model-invocation: true
description: >-
  Produces client SDKs from API contracts: OpenAPI and protobuf linting,
  generator choice (openapi-typescript, OpenAPI Generator, oapi-codegen, Kiota,
  buf), handwritten ergonomic wrappers for auth, retries, pagination and typed
  errors, regeneration checks and breaking-change detection in CI, and SDK
  versioning and publishing. Use when shipping an API to external developers,
  replacing hand-written clients, or when a generated SDK feels unidiomatic.
---

# SDK Generation

The contract is the product; the SDK is a projection of it. Generate the
mechanical layer from the spec, hand-write a thin idiomatic layer on top, and
let CI prove that the two never drift and that no change breaks callers
silently.

## When to use

- Publishing an HTTP or gRPC API for other teams or external developers.
- Several hand-written clients disagree with the server or with each other.
- A generated SDK is awkward: no pagination helpers, untyped errors, no retries.
- Setting up CI for spec linting, regeneration and breaking-change checks.

## When not to use

- Designing the API resources and errors themselves: use `api-design`.
- gRPC service internals (deadlines, interceptors): use `grpc-services`.
- Consumer-driven contract tests between services: use `contract-testing`.
- Scaffolding a new server endpoint: use `/api-scaffold`.

## Workflow

1. **Make the spec the source of truth.** Commit `openapi.yaml` (3.x) or `.proto` files beside the server, generated from code or written first. Every OpenAPI operation needs a stable `operationId`, tags, `required` lists, error responses and examples. Lint:

   ```bash
   npx @stoplight/spectral-cli lint openapi.yaml
   buf lint
   ```

   **Check:** Lint passes with zero errors and every operation has an `operationId`.

2. **Choose generators per language.**

   | Source | Target | Tool | Notes |
   | :--- | :--- | :--- | :--- |
   | OpenAPI | TypeScript | `openapi-typescript` + `openapi-fetch` | Types only plus a tiny typed fetch client |
   | OpenAPI | Many languages | OpenAPI Generator | Needs a JRE; quality varies by generator |
   | OpenAPI | Go | `oapi-codegen` | Client and server stubs from one config |
   | OpenAPI | C#, Go, Java, Python, TypeScript and more | Kiota | Consistent request-builder style |
   | OpenAPI | Several, commercial | Speakeasy, Stainless, Fern | Idiomatic output, paid plans |
   | Protobuf | Many | `buf generate` with local or remote plugins | Connect for TypeScript and Go |

   ```bash
   npx openapi-typescript openapi.yaml -o sdk/ts/src/schema.d.ts
   npx @openapitools/openapi-generator-cli generate -i openapi.yaml -g python -o sdk/python
   ```

   ```yaml
   # buf.gen.yaml
   version: v2
   plugins:
     - remote: buf.build/protocolbuffers/go
       out: gen/go
       opt: paths=source_relative
   ```

   **Check:** Generated code compiles and its smoke test calls a mock server successfully.

3. **Isolate generated code.** Write output to its own directory or package, never hand-edit it, and mark it in `.gitattributes` (`sdk/ts/src/gen/** linguist-generated=true`) so reviews collapse it.

   **Check:** Regenerating from the same spec produces zero diff.

4. **Hand-write the ergonomic layer.** Keep it thin and tested:

   - Client construction: base URL, credentials (API key, OAuth token provider), timeouts, custom `fetch` or HTTP client injection, no global state.
   - Retries: only idempotent methods, or POSTs carrying an idempotency key; retry 429 and 5xx with exponential backoff plus jitter; honour `Retry-After`.
   - Pagination: async iterators (`for await (const u of client.users.list())`) over cursor pages.
   - Errors: typed error classes carrying status, error code, message and request id.
   - Telemetry: a `User-Agent` such as `acme-sdk-ts/1.4.0`, optional logging hooks with secrets redacted.

   ```ts
   import createClient from 'openapi-fetch';
   import type { paths } from './gen/schema';

   export function createAcme(opts: { apiKey: string; baseUrl?: string }) {
     return createClient<paths>({
       baseUrl: opts.baseUrl ?? 'https://api.example.com/v1',
       headers: { Authorization: `Bearer ${opts.apiKey}`, 'User-Agent': 'acme-sdk-ts/1.4.0' },
     });
   }

   // const { data, error } = await acme.GET('/users/{id}', { params: { path: { id: '42' } } });
   ```

   **Check:** Unit tests cover retry rules, pagination termination and error mapping.

5. **Test against a mock built from the spec.** Run Prism (`npx @stoplight/prism-cli mock openapi.yaml`) or the real server in CI; compile and run every README example.

   **Check:** README snippets execute in CI, not just compile.

6. **Guard the contract in CI.** Regenerate and fail on drift (`git diff --exit-code sdk/`). Detect breaking changes against the main branch:

   ```bash
   oasdiff breaking base/openapi.yaml openapi.yaml
   buf breaking --against '.git#branch=main'
   ```

   **Check:** A PR that removes a field or makes a parameter required fails CI.

7. **Version and publish (confirm first).** SDK versions follow SemVer independently of the API version: a breaking spec change, or a breaking wrapper change, means a major SDK release. Go modules in subdirectories are tagged with the path prefix (`sdk/go/v1.4.0`) and need a `/v2` module path from major 2. Publishing to npm, PyPI, Maven Central or crates.io follows `/release-management` and waits for explicit user confirmation.

   **Check:** Changelog lists spec changes per SDK release; the registry install works in a clean directory.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Hand-edit generated files | Change the spec or the wrapper, then regenerate | Edits vanish on the next generation |
| Ship raw generator output as the SDK | Add a thin idiomatic layer | Users judge the API by the SDK experience |
| Retry every failed POST | Retry idempotent calls or POSTs with idempotency keys | Duplicate charges and orders |
| Missing `operationId`s | Stable, descriptive `operationId`s | Generated method names churn and break users |
| Bump SDK minor for a removed field | Major release, or deprecate first | Callers break on a routine update |
| Publish from a laptop | Publish from CI after confirmation | Reproducible, auditable releases |

## Verification checklist

- [ ] Spec lints clean; every operation has an `operationId` and error responses.
- [ ] Generated code is isolated, marked, and regenerates with zero diff.
- [ ] Wrapper covers auth, timeouts, retries, pagination and typed errors, with tests.
- [ ] CI checks drift and breaking changes.
- [ ] Release versioning follows SemVer and publishing had user confirmation.

## Related

- Workflows: `/api-scaffold`, `/release-management`, `/verify`.
- Knowledge: `api-design`, `grpc-services`, `contract-testing`, `api-testing`, `typescript-patterns`, `python-packaging`, `cli-development`.
- Agents: `backend-engineer`, `typescript-reviewer`.
