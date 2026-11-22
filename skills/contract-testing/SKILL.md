---
name: contract-testing
description: >-
  Sets up contract testing between services: consumer-driven contracts with
  Pact (consumer tests, provider verification, broker, can-i-deploy),
  provider states and loose matchers, plus schema-diff gates in CI for
  OpenAPI (oasdiff), protobuf (buf breaking), GraphQL (GraphQL Inspector) and
  event schemas, and API versioning rules. Use when services break each other
  on deploy, before splitting a monolith, or when adding breaking-change
  checks to CI.
---

# Contract Testing

Integration environments catch contract breaks late and flakily. Contract
tests catch them in each service's own pipeline: consumers state exactly what
they use, providers prove they still satisfy it, and a deploy gate refuses
releases that would break a consumer already in production.

## When to use

- Two or more services or a frontend and backend release independently.
- A provider change broke a consumer in staging or production.
- You need a CI gate for breaking changes to OpenAPI, protobuf, GraphQL or event schemas.
- Preparing to split a monolith into services.

## When not to use

- Testing an API's own behaviour, auth and error handling: use `api-testing`.
- Designing the API or versioning policy itself: use `api-design`.
- Data contracts between data producers and warehouse consumers: use `data-quality`.
- One team owns both sides and deploys them together: a shared integration test may be enough.

## Workflow

1. **Map interactions.** List each consumer-provider pair, protocol (HTTP, gRPC, GraphQL, events) and who owns each side.

   **Check:** Every pair has an owner on both sides and a chosen contract approach (table below).

2. **Add schema-diff gates on the provider.** Compare the contract file on the pull request against the main branch.

   ```bash
   oasdiff breaking api/openapi.base.yaml api/openapi.yaml       # OpenAPI
   buf breaking --against '.git#branch=main'                      # protobuf
   graphql-inspector diff schema.main.graphql schema.graphql      # GraphQL
   ```

   For events, use a schema registry with a compatibility mode (backward, forward or full) enforced on registration.

   **Check:** Removing a required response field fails the pull request.

3. **Write consumer tests (Pact)** for each interaction the consumer actually uses, with loose matchers.

   ```typescript
   import { PactV3, MatchersV3 } from "@pact-foundation/pact";
   const { like, eachLike } = MatchersV3;
   const provider = new PactV3({ consumer: "web", provider: "orders-api" });

   it("fetches an order", () => {
     provider
       .given("order 42 exists")
       .uponReceiving("a request for order 42")
       .withRequest({ method: "GET", path: "/orders/42", headers: { Accept: "application/json" } })
       .willRespondWith({ status: 200, body: like({ id: 42, status: "paid", items: eachLike({ sku: "A1", qty: 1 }) }) });
     return provider.executeTest(async (mock) => {
       const order = await getOrder(mock.url, 42);   // the real client code
       expect(order.status).toBe("paid");
     });
   });
   ```

   **Check:** The test exercises the real client function, and a pact file is written under `pacts/`.

4. **Publish pacts with version and branch.**

   ```bash
   pact-broker publish ./pacts --consumer-app-version "$GIT_SHA" --branch "$GIT_BRANCH" --broker-base-url "$PACT_BROKER_BASE_URL"
   ```

   Broker credentials come from CI secrets, never from the repository. In PowerShell use `$env:GIT_SHA` style variables.

   **Check:** The broker shows the pact for this consumer version and branch.

5. **Verify on the provider** against pacts selected for the main branch and deployed or released versions, with provider state handlers that set up data.

   ```typescript
   import { Verifier } from "@pact-foundation/pact";
   await new Verifier({
     provider: "orders-api", providerBaseUrl: "http://localhost:8080",
     pactBrokerUrl: process.env.PACT_BROKER_BASE_URL,
     consumerVersionSelectors: [{ mainBranch: true }, { deployedOrReleased: true }],
     enablePending: true, publishVerificationResult: process.env.CI === "true",
     providerVersion: process.env.GIT_SHA, providerVersionBranch: process.env.GIT_BRANCH,
     stateHandlers: { "order 42 exists": async () => seedOrder(42) },
   }).verifyProvider();
   ```

   **Check:** Verification results appear in the broker for this provider version.

6. **Gate deploys and record them.**

   ```bash
   pact-broker can-i-deploy --pacticipant orders-api --version "$GIT_SHA" --to-environment production
   pact-broker record-deployment --pacticipant orders-api --version "$GIT_SHA" --environment production
   ```

   **Check:** A provider change that breaks a deployed consumer is blocked by `can-i-deploy` before release.

## Reference

### Approach by interaction

| Interaction | Approach |
| :--- | :--- |
| Internal HTTP, independent teams | Pact consumer-driven contracts plus OpenAPI diff |
| Public or many unknown consumers | OpenAPI or GraphQL schema diff, versioning and deprecation policy |
| gRPC | `buf breaking` in CI; Pact has a protobuf plugin if you need consumer-driven checks |
| Events on Pub/Sub or Kafka | Schema registry compatibility, plus Pact message contracts for critical consumers |
| Provider already has an OpenAPI spec | Bi-directional contracts (consumer pacts compared with the provider spec) where your broker supports it |

### Matchers and provider states

- Match types and shapes (`like`, `eachLike`, regex or datetime matchers), not exact values, unless the value is the contract (an enum or status code).
- Include only fields the consumer reads. Extra provider fields are allowed by default.
- Provider states describe data preconditions ("order 42 exists"), never implementation steps. State handlers create data through the provider's own code or database fixtures.

### Change rules for providers

| Change | Safe? |
| :--- | :--- |
| Add optional response field, new endpoint, new optional request field | Yes |
| Add an enum value | Only if consumers tolerate unknown values (tolerant reader) |
| Remove or rename a field, change a type, make a request field required | Breaking: new version, or expand/contract with deprecation |
| Change error status codes or error body shape | Breaking for consumers that branch on them |

Deprecate first, find consumers in the broker or traffic logs, migrate them, then remove.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Exact-value matching everywhere | Type and shape matchers | Pacts break on irrelevant data changes |
| Pacts covering every provider field | Only what the consumer reads | The provider cannot evolve unused fields |
| Hand-written mock responses for the consumer | Pact mock server driven by the contract | Hand mocks drift from reality |
| Verify only against the latest pact | Main branch plus deployed or released selectors | Breaks for consumers in production go unnoticed |
| Contract tests that test business logic | Keep business logic in provider unit tests | Contracts become slow and brittle |
| Skip `can-i-deploy` "just this once" | Treat it as a required release gate | That one release is the one that breaks production |

## Verification checklist

- [ ] Each consumer-provider pair has owners and an approach.
- [ ] Schema-diff gates run on provider pull requests.
- [ ] Consumer tests use real client code and loose matchers.
- [ ] Pacts are published with version and branch; credentials come from CI secrets.
- [ ] Providers verify main-branch and deployed consumer versions with state handlers.
- [ ] `can-i-deploy` gates releases and deployments are recorded.

## Related

- Knowledge: `api-design`, `api-testing`, `grpc-services`, `graphql-servers`, `microservices`, `event-driven-architecture`, `ci-cd-github-actions`.
- Workflows: `/verify`, `/pr-ready`.
- Agents: `test-engineer`, `backend-engineer`.
