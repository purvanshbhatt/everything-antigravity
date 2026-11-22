---
name: kotlin-patterns
description: >-
  Writes idiomatic Kotlin: null safety without !!, data, sealed and value
  classes, exhaustive when, extension functions with restraint, scope
  functions, collections versus sequences, type-safe DSLs with @DslMarker,
  Java interop annotations, and Gradle Kotlin DSL with version catalogs,
  toolchains, ktlint and detekt. Use when writing or reviewing Kotlin on the
  JVM, Android or multiplatform, or setting up a Kotlin Gradle build.
---

# Kotlin Patterns

Let the type system carry the rules: nullability says what may be missing,
sealed hierarchies say what cases exist, value classes stop ID mix-ups, and
`val` plus read-only collections make mutation visible. Prefer plain, explicit
code over clever scope-function chains.

## When to use

- Writing Kotlin services, libraries, Android or multiplatform shared code.
- Reviewing Kotlin for `!!`, platform-type leaks from Java, or unreadable `let`/`apply` chains.
- Designing a builder DSL or extension-function API.
- Setting up or cleaning a Gradle Kotlin DSL build with version catalogs.

## When not to use

- Coroutines, Flow and structured concurrency: use `kotlin-coroutines`.
- HTTP services with Ktor: use `ktor-server`; with Spring: use `java-spring-boot`.
- Android UI: use `android-jetpack-compose`; shared iOS/Android modules: `kotlin-multiplatform`.
- Reviews: delegate to `kotlin-reviewer`; build failures to `jvm-build-resolver`.

## Workflow

1. **Read the build.** Check the Kotlin version (`libs.versions.toml` or plugin block), JVM toolchain, compiler options, and lint setup. Kotlin 2.x uses the K2 compiler by default.

   ```bash
   ./gradlew --version
   ./gradlew help --task compileKotlin     # confirms the Kotlin plugin is applied
   ```

   **Check:** You know the Kotlin version, JVM target and whether `explicitApi()` or warnings-as-errors is on.

2. **Model with the type system.** Data classes for values, sealed interfaces for closed sets, `@JvmInline value class` for typed IDs and units, enums only for constant sets without data.

   **Check:** Mixing two ID types (for example passing an `OrderId` where a `UserId` is expected) fails to compile.

3. **Handle null at the edge.** Convert platform types from Java APIs to explicit `T` or `T?` immediately; use `?.`, `?:`, `requireNotNull(x) { "msg" }` and `checkNotNull`. Ban `!!` in production code with detekt.

   **Check:** `grep_search` for `!!` in changed main sources returns nothing, or each has a comment proving non-null.

4. **Use `when` exhaustively.** Use `when` as an expression over sealed types and enums with no `else` branch, so new cases fail compilation.

   **Check:** Adding a subclass breaks every `when` that must handle it.

5. **Keep extensions and scope functions readable.** Extensions go next to the type they extend or in a clearly named file; keep them private or internal unless they are API. Use at most one scope function per expression (table below).

   **Check:** No expression nests two or more scope functions.

6. **Run the gates.**

   ```bash
   ./gradlew ktlintCheck detekt test     # task names depend on the plugins in use
   ```

   **Check:** Lint, static analysis and tests pass with warnings-as-errors where configured.

## Patterns

### Domain modelling

```kotlin
@JvmInline value class UserId(val value: String) {
    init { require(value.startsWith("u_")) { "invalid user id: $value" } }
}

sealed interface PaymentResult {
    data class Approved(val authCode: String, val amountCents: Long) : PaymentResult
    data class Declined(val reason: String) : PaymentResult
    data object Pending : PaymentResult
}

fun describe(r: PaymentResult): String = when (r) {
    is PaymentResult.Approved -> "approved ${r.authCode} for ${r.amountCents}"
    is PaymentResult.Declined -> "declined: ${r.reason}"
    PaymentResult.Pending -> "pending"
}
```

### Null handling at boundaries

```kotlin
fun loadConfig(env: Map<String, String>): Config {
    val url = requireNotNull(env["DB_URL"]) { "DB_URL is required" }
    val pool = env["DB_POOL"]?.toIntOrNull() ?: 10
    return Config(url = url, poolSize = pool)
}
```

### Scope functions

| Function | Receiver as | Returns | Use for |
| :--- | :--- | :--- | :--- |
| `let` | `it` | lambda result | Null-safe transform: `x?.let { parse(it) }` |
| `apply` | `this` | the object | Configuring a new object |
| `also` | `it` | the object | Side effects such as logging in a chain |
| `run` | `this` | lambda result | Computing a value from an object's members |
| `with(x)` | `this` | lambda result | Several calls on one object without a chain |

If a plain `val` and an `if` read better, use them.

### Type-safe DSL

```kotlin
@DslMarker annotation class HtmlDsl

@HtmlDsl class Ul { val items = mutableListOf<String>(); fun li(text: String) { items += text } }
@HtmlDsl class Page { val lists = mutableListOf<Ul>(); fun ul(block: Ul.() -> Unit) { lists += Ul().apply(block) } }

fun page(block: Page.() -> Unit): Page = Page().apply(block)

val p = page { ul { li("one"); li("two") } }   // @DslMarker stops calling ul() inside ul {}
```

### Collections versus sequences

Use collection operations (`map`, `filter`) for small or medium lists; they are eager and simple. Use `asSequence()` for long chains over large inputs or when you `take(n)` early, then finish with `toList()`. Expose `List<T>` (read-only) from APIs and keep `MutableList` private.

### Java interop

| Annotation | Effect |
| :--- | :--- |
| `@JvmStatic` | Companion member callable as a Java static |
| `@JvmOverloads` | Generates overloads for default parameters |
| `@JvmName("...")` | Resolves signature clashes, renames for Java |
| `@Throws(IOException::class)` | Declares checked exceptions for Java callers |
| `-Xjsr305=strict` | Treats JSR-305 nullability annotations in Java libraries as strict |

### Gradle Kotlin DSL

```toml
# gradle/libs.versions.toml (pin current stable versions from the official sites)
[versions]
kotlin = "<current stable>"

[plugins]
kotlin-jvm = { id = "org.jetbrains.kotlin.jvm", version.ref = "kotlin" }
```

```kotlin
// build.gradle.kts
plugins { alias(libs.plugins.kotlin.jvm) }

kotlin {
    jvmToolchain(21)
    explicitApi()                     // libraries: force visibility and return types on public API
    compilerOptions {
        allWarningsAsErrors = true
        freeCompilerArgs.add("-Xjsr305=strict")
    }
}
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `!!` to silence the compiler | `requireNotNull`, `?:`, or restructure | Turns compile-time safety into runtime crashes |
| `lateinit var` for values available at construction | Constructor parameters or `by lazy` | Hidden uninitialised-state crashes |
| `else ->` in a `when` over a sealed type | Handle every case | New cases are silently ignored |
| Public extension functions on `String`, `Any` | Private/internal extensions or real types | Pollutes autocomplete project-wide |
| `data class` with `var` properties used as map keys | `val` properties | Mutating a key breaks hash lookups |
| `runCatching` around suspend calls | Catch specific exceptions; rethrow `CancellationException` | `runCatching` swallows cancellation |
| Hard-coded dependency versions in each module | Version catalog | One place to upgrade |

## Verification checklist

- [ ] No `!!` in production code; Java platform types are converted at the boundary.
- [ ] Closed sets are sealed and handled by exhaustive `when` without `else`.
- [ ] Typed IDs use value classes; APIs expose read-only collections.
- [ ] Scope functions are not nested; extensions are scoped narrowly.
- [ ] Build uses a toolchain and version catalog; ktlint, detekt and tests pass.

## Related

- Knowledge: `kotlin-coroutines`, `ktor-server`, `android-jetpack-compose`, `kotlin-multiplatform`, `java-modern`, `java-spring-boot`.
- Workflows: `/code-review`, `/refactor-clean`, `/verify`.
- Agents: `kotlin-reviewer`, `jvm-build-resolver`.
