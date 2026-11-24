---
name: java-modern
disable-model-invocation: true
description: >-
  Writes modern Java 21+: records with compact constructors, sealed hierarchies,
  pattern matching for switch with record patterns, virtual threads and
  avoiding pinning, sequenced collections, streams versus loops, Optional
  discipline, and Maven or Gradle builds with toolchains, BOMs and dependency
  insight. Use when writing or modernising Java code, upgrading the JDK,
  choosing between Maven and Gradle tasks, or reviewing Java for idioms.
---

# Modern Java

Java 21 changed the defaults: data is a record, a closed set of cases is a
sealed interface, branching on type is an exhaustive `switch`, and blocking
I/O can run on virtual threads. Write to the JDK you ship on and let the
compiler prove exhaustiveness.

## When to use

- New Java code on JDK 21 or later, or modernising Java 8/11/17 code.
- Replacing visitor patterns, `instanceof` chains or enum-plus-switch with sealed types.
- Moving thread-pool-per-request code to virtual threads.
- Maven or Gradle questions: toolchains, dependency conflicts, BOMs, wrapper use.

## When not to use

- Spring-specific wiring, JPA and testing slices: use `java-spring-boot`.
- Kotlin or Scala on the JVM: use `kotlin-patterns` or `scala-jvm`.
- A JDK or framework major-version migration plan: use `/framework-migration`.
- Build failures: delegate to `jvm-build-resolver`; reviews to `java-reviewer`.

## Workflow

1. **Pin the language level.** Read `java -version`, `maven.compiler.release` or the Gradle `toolchain`, and the CI image. Compile with `--release N` semantics so newer APIs cannot leak in.

   **Check:** Local, CI and runtime image use the same major JDK, and the build declares it.

2. **Model data with records and sealed types.** Immutable carriers are records; validate in the compact constructor. A closed set of alternatives is a `sealed interface` with record implementations.

   **Check:** No mutable DTO classes with setters remain in changed code without a framework reason.

3. **Branch with exhaustive `switch`.** Use pattern matching for switch with record patterns and `when` guards; omit `default` on sealed types so adding a case breaks compilation where it must.

   **Check:** Adding a new permitted subtype causes compile errors at every unhandled switch.

4. **Choose concurrency deliberately.** Blocking I/O fan-out: `Executors.newVirtualThreadPerTaskExecutor()` with a `Semaphore` to respect downstream limits. CPU-bound work: a bounded platform pool sized to cores. Never pool virtual threads.

   **Check:** A JFR recording under load shows no frequent `jdk.VirtualThreadPinned` events, and downstream concurrency stays within its limit.

5. **Keep streams readable.** Use streams for transform-filter-collect pipelines; use a loop when you need early exit with state, checked exceptions or index math. Return `Optional` from lookups only; never accept it as a parameter or store it in fields.

   **Check:** No stream pipeline in the diff has side effects inside `map` or `filter`.

6. **Control dependencies.** Import BOMs (`dependencyManagement` in Maven, `platform(...)` in Gradle) instead of pinning each artifact; find conflicts with the insight commands below.

   **Check:** `dependency:tree` or `dependencyInsight` shows one resolved version per library family.

7. **Run the gates.** `./mvnw verify` or `./gradlew build`, plus the static analysis the project uses (Error Prone, SpotBugs, Checkstyle or Spotless).

   **Check:** All pass on the pinned JDK with warnings treated as errors where configured.

## Patterns

### Sealed types, records and pattern matching

```java
sealed interface PaymentResult permits Approved, Declined, Pending {}
record Approved(String authCode, long amountCents) implements PaymentResult {}
record Declined(String reason) implements PaymentResult {}
record Pending(Duration retryAfter) implements PaymentResult {}

static String describe(PaymentResult r) {
  return switch (r) {                         // exhaustive: no default needed
    case Approved(var code, var cents) -> "approved %s for %d".formatted(code, cents);
    case Declined(var reason) when reason.isBlank() -> "declined";
    case Declined(var reason) -> "declined: " + reason;
    case Pending p -> "retry in " + p.retryAfter().toSeconds() + "s";
  };
}

record Money(long cents, Currency currency) {
  Money {                                      // compact constructor validates
    Objects.requireNonNull(currency, "currency");
    if (cents < 0) throw new IllegalArgumentException("cents must be >= 0");
  }
}
```

### Virtual threads with a concurrency limit

```java
List<Quote> fetchAll(List<String> skus) throws InterruptedException, ExecutionException {
  var limit = new Semaphore(50);                         // protect the downstream service
  try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
    List<Future<Quote>> futures = skus.stream()
        .map(sku -> exec.submit(() -> {
          limit.acquire();
          try { return client.quote(sku); }              // blocking HTTP call is fine here
          finally { limit.release(); }
        }))
        .toList();
    List<Quote> out = new ArrayList<>(futures.size());
    for (Future<Quote> f : futures) out.add(f.get());
    return out;
  }                                                       // close() waits for all tasks
}
```

Pinning: before JDK 24, blocking inside `synchronized` pins the carrier thread; prefer `ReentrantLock` on older JDKs. Native calls still pin. Thread-locals multiply with millions of threads; prefer passing context explicitly (or scoped values where final on your JDK).

### Feature map (verify newer items against the JDK release notes)

| Feature | Final in | Use for |
| :--- | :--- | :--- |
| Records, `instanceof` patterns, text blocks | 16 / 16 / 15 | Data carriers, safe casts, multi-line strings |
| Sealed classes | 17 | Closed hierarchies |
| Pattern matching for switch, record patterns, virtual threads, sequenced collections (`getFirst`, `reversed`) | 21 | Exhaustive branching, cheap blocking concurrency |
| Unnamed variables `_` | 22 | Ignored lambda params and pattern parts |
| Stream gatherers, `synchronized` without pinning | 24 | Custom intermediate stream ops |
| Scoped values, flexible constructor bodies, module imports | 25 | Context passing, validation before `super(...)` |

### Build tool essentials

```xml
<!-- Maven -->
<properties><maven.compiler.release>21</maven.compiler.release></properties>
```

```kotlin
// Gradle (Kotlin DSL)
java { toolchain { languageVersion = JavaLanguageVersion.of(21) } }
```

| Task | Maven | Gradle |
| :--- | :--- | :--- |
| Build and test | `./mvnw verify` | `./gradlew build` |
| Why is this version here? | `./mvnw dependency:tree -Dincludes=com.fasterxml.jackson.core` | `./gradlew dependencyInsight --dependency jackson-databind` |
| Available updates | `./mvnw versions:display-dependency-updates` | a versions plugin, or Dependabot/Renovate |
| Single test | `./mvnw -Dtest=OrderTest#rejectsNegative test` | `./gradlew test --tests 'OrderTest.rejectsNegative'` |
| Profile a run | `java -XX:StartFlightRecording=duration=60s,filename=rec.jfr -jar app.jar` | same |

Always use the wrapper (`mvnw`, `gradlew`; `.cmd`/`.bat` on Windows) so everyone runs the same build tool version.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `default ->` on a switch over a sealed type | List every case | Default hides new subtypes from the compiler |
| Pooling virtual threads or capping them with a small fixed pool | One virtual thread per task plus a `Semaphore` | Pools defeat the purpose and add queueing |
| `Optional` parameters and fields | Overloads or nullable fields with clear contracts | Optional is a return-type signal only |
| Mutating the result of `stream.toList()` | `Collectors.toCollection(ArrayList::new)` when you need a mutable list | `.toList()` is unmodifiable; mutation throws at runtime |
| `new Date()`, `SimpleDateFormat` | `java.time` (`Instant`, `ZonedDateTime`, `DateTimeFormatter`) | Thread-safe and correct |
| `double` for money | `long` minor units or `BigDecimal` with explicit rounding | Floating point loses cents |
| Catching `Exception` to log and continue | Catch specific exceptions; rethrow with context | Silent corrupt state |

## Verification checklist

- [ ] JDK version declared in the build and identical in CI and runtime.
- [ ] Data carriers are records; closed hierarchies are sealed and switched exhaustively.
- [ ] Virtual threads used for blocking I/O only, with explicit concurrency limits.
- [ ] No `Optional` parameters or fields; no mutation of `.toList()` results.
- [ ] Dependency versions come from BOMs; conflicts checked with tree/insight.
- [ ] `./mvnw verify` or `./gradlew build` and static analysis pass.

## Related

- Knowledge: `java-spring-boot`, `kotlin-patterns`, `scala-jvm`, `concurrency-bugs`, `profiling`, `memory-leaks`.
- Workflows: `/framework-migration`, `/dependency-upgrades`, `/refactor-clean`.
- Agents: `java-reviewer`, `jvm-build-resolver`.
