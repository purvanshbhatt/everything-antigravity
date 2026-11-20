---
trigger: glob
globs: "**/*.java, **/*.kt, **/*.kts"
description: Java and Kotlin conventions
---

# Java and Kotlin

## Build

- Use the wrapper: `./gradlew` (Windows `gradlew.bat`) or `./mvnw`. Never upgrade the wrapper, Gradle plugins or the JDK target as a side effect of another change.
- Declare dependencies through the version catalog (`gradle/libs.versions.toml`) when the project has one. Build scripts use the Kotlin DSL (`*.gradle.kts`) style already present.
- Gate with `./gradlew build` (or `check`) / `./mvnw verify`, plus the configured formatter (Spotless, ktlint, detekt, google-java-format).

## Java

- Use the language level in the build file. On 17+, prefer `record` for immutable data, `sealed` interfaces for closed hierarchies, switch expressions and pattern matching; text blocks for multi-line strings.
- Fields `private final` by default; return unmodifiable collections (`List.copyOf`, `List.of`).
- `Optional` only as a return type, never for fields or parameters, and never call `get()` without a check. Annotate nullability (`@Nullable` from the project's annotation library, such as JSpecify).
- Close resources with try-with-resources.
- Catch specific exceptions; never catch `Throwable`, never swallow, and keep the cause (`throw new ConfigException("bad port", e)`).
- Log with SLF4J parameterized messages (`log.info("loaded {} rows", n)`); no `System.out` or `printStackTrace()`.
- Concurrency: use `ExecutorService` (shut it down) or virtual threads (Java 21+) for blocking I/O; prefer `java.util.concurrent` types over `synchronized` + `wait/notify`.
- Spring: constructor injection only (no field `@Autowired`); keep `@Transactional` on public service methods and remember self-invocation bypasses the proxy.

## Kotlin

- `val` over `var`; immutable collections (`listOf`, `mapOf`) at API boundaries.
- Model nullability in types. No `!!`; use `?.`, `?:`, `requireNotNull(x) { "why" }` or early return.
- `data class` for values, `sealed interface`/`sealed class` for closed state, and exhaustive `when` without `else` on sealed types.
- Coroutines: structured concurrency only. No `GlobalScope`; launch in a lifecycle-bound scope (`viewModelScope`, a `CoroutineScope` you cancel). Blocking calls go in `withContext(Dispatchers.IO)`.
- Never swallow `CancellationException`. `runCatching` and broad `catch (e: Exception)` catch it too, so rethrow it.
- Prefer `Flow` for streams; use `StateFlow` for UI state. Do not collect flows in `init` blocks without a scope.
- Extension functions for readability, not to reach into another module's internals. Mark APIs `internal` by default in libraries.

## Tests

- JUnit 5 with AssertJ (Java) or kotlin.test / Kotest (Kotlin); MockK for Kotlin mocks, Mockito for Java. Follow what the project uses.
- Use `kotlinx-coroutines-test` (`runTest`) for coroutines; never `Thread.sleep` in tests.
- Run one test: `./gradlew test --tests "com.example.FooTest"` or `./mvnw -Dtest=FooTest test`.
