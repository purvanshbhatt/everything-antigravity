---
name: java-spring-boot
description: >-
  Builds and reviews Spring Boot 3 services: package-by-feature layering,
  typed @ConfigurationProperties, Spring Data JPA without N+1 or open-in-view,
  Flyway migrations, Bean Validation with ProblemDetail errors, a
  SecurityFilterChain with an OAuth2 resource server, test slices with
  Testcontainers, Actuator probes, virtual threads and graceful shutdown. Use
  when creating, extending, testing or debugging a Spring Boot application.
---

# Spring Boot Services

Keep controllers thin, put transactions on services, validate at the edge and
return RFC 9457 problem details. Test each layer with the narrowest slice that
proves it, and let Actuator tell the platform when the app is ready.

## When to use

- Creating a Spring Boot REST service or adding endpoints, entities and migrations.
- Slow endpoints caused by N+1 queries, lazy-loading errors or connection-pool exhaustion.
- Configuring Spring Security for JWT bearer tokens or method-level authorisation.
- Slow or flaky `@SpringBootTest` suites that should be slices.
- Preparing a Boot app for Cloud Run, GKE or any container platform.

## When not to use

- Language features (records, sealed types, virtual threads in depth): use `java-modern`.
- Kotlin with Ktor instead of Spring: use `ktor-server`.
- Schema evolution strategy and backfills: use `database-migrations`; ORM trade-offs: `orm-patterns`.
- Build failures: delegate to the `jvm-build-resolver` agent; reviews to `java-reviewer`.

## Workflow

1. **Read the build and versions.** Check the Boot version (parent POM or `org.springframework.boot` plugin), Java release, and starters in use.

   ```bash
   ./mvnw -q help:evaluate -Dexpression=project.parent.version -DforceStdout   # Maven, Boot parent
   ./mvnw dependency:tree -Dincludes=org.springframework.boot
   ./gradlew dependencies --configuration runtimeClasspath                     # Gradle
   ```

   Windows: `.\mvnw.cmd` and `.\gradlew.bat`. Spring Boot 4 (Spring Framework 7) changes starters and several packages; read its migration guide before upgrading.

   **Check:** You know the Boot major/minor, Java version and persistence stack.

2. **Organise by feature.** `orders/OrderController`, `orders/OrderService`, `orders/OrderRepository`, `orders/Order` in one package; package-private where possible. Controllers map DTOs (records) to service calls; services own `@Transactional`; repositories never leak to controllers.

   **Check:** No controller references a repository or a JPA entity in its request/response types.

3. **Type the configuration.** Bind settings to a record annotated `@ConfigurationProperties("app.payments")` plus `@Validated`, enable with `@ConfigurationPropertiesScan`. Secrets come from environment variables or Secret Manager, never `application.yml` in git.

   **Check:** Starting with an invalid property fails at boot with a binding error naming the property.

4. **Make persistence explicit.** Set `spring.jpa.open-in-view=false`, `spring.jpa.hibernate.ddl-auto=validate`, and migrate with Flyway (`db/migration/V1__init.sql`). Fetch associations deliberately with `@EntityGraph` or `join fetch`; page with `Pageable`. Mark read paths `@Transactional(readOnly = true)`.

   **Check:** With `spring.jpa.show-sql=true` (locally only), a list endpoint issues a constant number of queries regardless of row count.

5. **Validate input and standardise errors.** `@Valid @RequestBody` on records with Bean Validation annotations; a `@RestControllerAdvice` returning `ProblemDetail`; set `spring.mvc.problemdetails.enabled=true` for framework errors.

   **Check:** An invalid body returns 400 with `application/problem+json` and no stack trace.

6. **Secure with a filter chain.** Define a `SecurityFilterChain` bean (pattern below); configure `spring.security.oauth2.resourceserver.jwt.issuer-uri` for your identity provider; use `@EnableMethodSecurity` and `@PreAuthorize` for object-level rules.

   **Check:** Unauthenticated calls get 401, wrong-role calls get 403, and `/actuator/health` stays reachable for probes.

7. **Test with slices.** `@WebMvcTest` plus `MockMvc` for controllers, `@DataJpaTest` with a Testcontainers database and `@ServiceConnection` (Boot 3.1+) for repositories, and one or two `@SpringBootTest(webEnvironment = RANDOM_PORT)` end-to-end tests. Replace beans with `@MockitoBean` (Boot 3.4+; `@MockBean` is deprecated).

   **Check:** `./mvnw verify` (or `./gradlew check`) passes and most tests start in under a second after the context cache warms.

8. **Make it operable.** Expose only `health`, `info` and metrics endpoints; enable liveness/readiness groups; set graceful shutdown; enable virtual threads on Java 21+ for blocking I/O workloads. Build an image with `./mvnw spring-boot:build-image` or `./gradlew bootBuildImage`, or deploy from source with `gcloud run deploy --source .` after confirming the target project and region with the user.

   **Check:** `/actuator/health/readiness` returns UP only after the database is reachable, and SIGTERM drains requests before exit.

## Patterns

### Controller, DTOs and problem details

```java
@RestController
@RequestMapping("/api/orders")
class OrderController {
  private final OrderService service;
  OrderController(OrderService service) { this.service = service; }

  @PostMapping
  ResponseEntity<OrderResponse> create(@Valid @RequestBody CreateOrderRequest req, UriComponentsBuilder uri) {
    OrderResponse created = service.create(req);
    return ResponseEntity.created(uri.path("/api/orders/{id}").build(created.id())).body(created);
  }
}

record CreateOrderRequest(@NotBlank String customerId, @NotEmpty List<@Valid Line> lines) {
  record Line(@NotBlank String sku, @Positive int qty) {}
}

@RestControllerAdvice
class ApiErrors {
  @ExceptionHandler(OrderNotFoundException.class)
  ProblemDetail notFound(OrderNotFoundException e) {
    ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
    pd.setTitle("Order not found");
    return pd;
  }
}
```

### Security filter chain (stateless JWT API)

```java
@Configuration
@EnableMethodSecurity
class SecurityConfig {
  @Bean
  SecurityFilterChain api(HttpSecurity http) throws Exception {
    return http
        .authorizeHttpRequests(a -> a
            .requestMatchers("/actuator/health/**").permitAll()
            .anyRequest().authenticated())
        .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()))
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .csrf(c -> c.disable())   // only because this API uses bearer tokens, not cookies
        .build();
  }
}
```

### Controller slice test

```java
@WebMvcTest(OrderController.class)
@Import(SecurityConfig.class)
class OrderControllerTest {
  @Autowired MockMvc mvc;
  @MockitoBean OrderService service;
  @MockitoBean JwtDecoder jwtDecoder;   // satisfies the resource server; jwt() below skips decoding

  @Test
  void rejectsEmptyLines() throws Exception {
    mvc.perform(post("/api/orders").with(jwt())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"customerId\":\"c1\",\"lines\":[]}"))
        .andExpect(status().isBadRequest());
  }
}
```

### Operational properties

```yaml
spring:
  jpa:
    open-in-view: false
    hibernate.ddl-auto: validate
  threads.virtual.enabled: true          # Boot 3.2+ on Java 21+
  lifecycle.timeout-per-shutdown-phase: 20s
server:
  shutdown: graceful
management:
  endpoints.web.exposure.include: health,info,prometheus
  endpoint.health.probes.enabled: true
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Field injection with `@Autowired` | Constructor injection | Immutable, testable, explicit dependencies |
| Returning JPA entities from controllers | Map to record DTOs | Lazy-loading errors, leaked fields, coupled API |
| `ddl-auto=update` outside local dev | Flyway or Liquibase with `validate` | Unreviewed, irreversible schema changes |
| `@Transactional` on controllers or private methods | Public service methods | Proxies do not intercept private or self calls |
| `@SpringBootTest` for every test | Slices plus a few end-to-end tests | Full contexts make suites slow |
| `exposure.include: "*"` on Actuator | Allow-list endpoints; secure the rest | `env`, `heapdump` and others leak secrets |
| Catching exceptions to return `null` | Throw domain exceptions; map once in advice | Consistent errors and status codes |

## Verification checklist

- [ ] Controllers use DTOs; services own transactions; no repository in controllers.
- [ ] `open-in-view=false`, `ddl-auto=validate`, migrations versioned.
- [ ] Validation errors return 400 problem details without stack traces.
- [ ] Security returns 401/403 correctly; health probes stay public.
- [ ] Slices and Testcontainers tests pass in `./mvnw verify` or `./gradlew check`.
- [ ] Actuator exposure is allow-listed; graceful shutdown is set.

## Related

- Knowledge: `java-modern`, `kotlin-patterns`, `api-design`, `auth-patterns`, `orm-patterns`, `database-migrations`, `observability-otel`, `cloud-run`, `docker-containers`.
- Workflows: `/api-scaffold`, `/dockerize`, `/tdd`, `/verify`.
- Agents: `java-reviewer`, `jvm-build-resolver`, `backend-engineer`.
