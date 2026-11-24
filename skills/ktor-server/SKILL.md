---
name: ktor-server
disable-model-invocation: true
description: >-
  Builds Ktor server applications in Kotlin: engine and module setup,
  configuration from files and environment, routing, plugins (content
  negotiation with kotlinx.serialization, StatusPages, CallLogging,
  Authentication with JWT and JWKS, CORS), request validation, database access
  off the event loop, testApplication tests, and packaging as a fat JAR or
  container for Cloud Run. Use when creating, extending, testing or deploying
  a Ktor service.
---

# Ktor Services

Ktor is a small core plus plugins you install explicitly, so an app is exactly
what its `module()` function says. Keep routing thin, map errors in one
`StatusPages` block, push blocking work off the request coroutine, and test the
whole module in-process with `testApplication`.

## When to use

- Creating a Ktor HTTP API or adding routes, plugins and authentication.
- JSON serialization errors, missing `ContentNegotiation`, or 415/406 responses.
- Wiring JWT auth against an identity provider's JWKS endpoint.
- Writing fast in-process tests for routes.
- Packaging and deploying a Ktor service to a container platform.

## When not to use

- Coroutine semantics and Flow: use `kotlin-coroutines`; language idioms: `kotlin-patterns`.
- Spring-based Kotlin services: use `java-spring-boot`.
- API contract design: use `api-design`; auth architecture: `auth-patterns`.
- Reviews: delegate to `kotlin-reviewer`; build failures to `jvm-build-resolver`.

## Workflow

1. **Read the setup.** Check the Ktor version (`libs.versions.toml` or Gradle), the engine (Netty, CIO, Jetty), and whether the app starts with `embeddedServer` (config in code) or `EngineMain` (config in `application.conf` or `application.yaml`). Ktor 3 changed several APIs from 2.x; read the migration guide before upgrading.

   **Check:** You can point to the `module()` functions and list installed plugins.

2. **Bind to the platform port.** Read `PORT` from the environment and bind to `0.0.0.0`. With file config: `ktor.deployment.port = ${?PORT}` in HOCON.

   **Check:** `PORT=9090 ./gradlew run` (PowerShell: `$env:PORT=9090; ./gradlew run`) serves on 9090.

3. **Install core plugins in one module.** `ContentNegotiation` with `json()`, `StatusPages` for error mapping, `CallLogging` (with a call ID if you trace), `Authentication`, and `CORS` only for browser clients with an explicit host list.

   **Check:** An unknown route returns 404 JSON, a thrown domain error returns its mapped status, and an unexpected exception returns 500 without a stack trace.

4. **Keep routes thin.** Group with `route("/v1/orders") { ... }`, validate input (the `RequestValidation` plugin or explicit checks), call a service, respond with a DTO annotated `@Serializable`. Use the `Resources` plugin for type-safe routes if the API is large.

   **Check:** Route handlers contain no SQL and no business rules.

5. **Do blocking work on `Dispatchers.IO`.** JDBC (Exposed, jOOQ, plain JDBC with HikariCP) runs inside `withContext(Dispatchers.IO)` or a library-provided suspend transaction; never block the engine's threads.

   **Check:** Under a small load test, request latency does not climb with a slow database query on another route.

6. **Authenticate with JWKS, not shared secrets.** Verify RS256 tokens from your identity provider (Identity Platform, Firebase Auth, any OIDC issuer) using its JWKS URL, issuer and audience. Wrap protected routes in `authenticate("auth-jwt") { ... }`.

   **Check:** Requests without a token get 401; tokens with the wrong audience get 401; valid tokens reach the route.

7. **Test the module in-process.** `testApplication { application { module(testConfig) } }` with a client that installs `ContentNegotiation`. Replace external services with fakes passed into `module()`.

   **Check:** `./gradlew test` covers success, validation, auth and error paths without a network.

8. **Package and deploy.** The Ktor Gradle plugin provides `buildFatJar` and image tasks; any JDK base image or Jib also works. Confirm the project, region and service name with the user before `gcloud run deploy`.

   **Check:** The container starts locally with `docker run -e PORT=8080 -p 8080:8080 <image>` and `/healthz` returns 200.

## Patterns

### Application module

```kotlin
fun main() {
    val port = System.getenv("PORT")?.toIntOrNull() ?: 8080
    embeddedServer(Netty, port = port, host = "0.0.0.0") { module(AppConfig.fromEnv()) }
        .start(wait = true)
}

fun Application.module(config: AppConfig, orders: OrderService = OrderService(config)) {
    install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
    install(CallLogging)
    install(StatusPages) {
        exception<NotFoundException> { call, e ->
            call.respond(HttpStatusCode.NotFound, ApiError(e.message ?: "not found"))
        }
        exception<BadRequestException> { call, e ->
            call.respond(HttpStatusCode.BadRequest, ApiError(e.message ?: "bad request"))
        }
        exception<Throwable> { call, e ->
            call.application.log.error("unhandled error", e)
            call.respond(HttpStatusCode.InternalServerError, ApiError("internal error"))
        }
    }
    configureAuth(config)

    routing {
        get("/healthz") { call.respondText("ok") }
        authenticate("auth-jwt") {
            route("/v1/orders") {
                get("{id}") {
                    val id = call.parameters["id"] ?: throw BadRequestException("id is required")
                    call.respond(orders.get(id))
                }
                post {
                    val req = call.receive<CreateOrder>()
                    call.respond(HttpStatusCode.Created, orders.create(req))
                }
            }
        }
    }
}

@Serializable data class ApiError(val message: String)
```

### JWT with a JWKS provider

```kotlin
fun Application.configureAuth(config: AppConfig) {
    val jwkProvider = JwkProviderBuilder(URI(config.jwksUrl).toURL())
        .cached(10, 24, TimeUnit.HOURS)
        .rateLimited(10, 1, TimeUnit.MINUTES)
        .build()
    install(Authentication) {
        jwt("auth-jwt") {
            realm = "api"
            verifier(jwkProvider, config.issuer) {
                acceptLeeway(3)
                withAudience(config.audience)
            }
            validate { cred -> cred.payload.subject?.let { JWTPrincipal(cred.payload) } }
        }
    }
}
```

### In-process test

```kotlin
class OrdersRouteTest {
    @Test
    fun createReturns201() = testApplication {
        application { module(testConfig, orders = FakeOrderService()) }
        val client = createClient { install(ContentNegotiation) { json() } }

        val res = client.post("/v1/orders") {
            contentType(ContentType.Application.Json)
            bearerAuth(testToken())               // signed by a test key served from a fake JWKS
            setBody(CreateOrder(sku = "A-1", qty = 2))
        }
        assertEquals(HttpStatusCode.Created, res.status)
    }
}
```

The server-side `ContentNegotiation` and the client-side one are different artifacts (`ktor-server-content-negotiation` and `ktor-client-content-negotiation`); tests need both.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Blocking JDBC calls directly in route handlers | `withContext(Dispatchers.IO)` or suspend transactions | Starves engine threads; latency spikes |
| HMAC JWT secrets hard-coded in config | JWKS from the identity provider; secrets from Secret Manager | Leaked secrets forge tokens |
| `anyHost()` in CORS for an authenticated API | Explicit `allowHost(...)` list | Any site can call your API from a browser |
| try/catch in every route | One `StatusPages` mapping | Inconsistent status codes and bodies |
| Global singletons reached from routes | Pass services into `module()` | Untestable without real dependencies |
| Binding to `localhost` in containers | `0.0.0.0` and `PORT` from env | The platform cannot reach the server |

## Verification checklist

- [ ] Server binds `0.0.0.0` on `PORT`; `/healthz` responds.
- [ ] Errors are mapped once in `StatusPages`; no stack traces in responses.
- [ ] JWT verification uses JWKS, issuer and audience; protected routes are wrapped.
- [ ] Blocking I/O runs off the engine threads.
- [ ] `testApplication` tests cover success, validation, auth and error paths.
- [ ] The fat JAR or image runs locally before any deploy, and deploys were confirmed by the user.

## Related

- Knowledge: `kotlin-patterns`, `kotlin-coroutines`, `api-design`, `auth-patterns`, `orm-patterns`, `observability-otel`, `cloud-run`, `docker-containers`.
- Workflows: `/api-scaffold`, `/dockerize`, `/tdd`.
- Agents: `kotlin-reviewer`, `jvm-build-resolver`, `backend-engineer`.
