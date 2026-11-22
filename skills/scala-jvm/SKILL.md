---
name: scala-jvm
description: >-
  Writes Scala 3 on the JVM: enums and ADTs with exhaustive matching, opaque
  types, given/using and type classes, extension methods, derives, an overview
  of effect stacks (Future, Cats Effect, ZIO, direct style), sbt and scala-cli
  workflows, compiler warning flags, scalafmt and scalafix, and testing with
  munit and ScalaCheck. Use when writing, reviewing or migrating Scala code, or
  choosing an effect library or build setup.
---

# Scala 3 on the JVM

Scala 3 makes the good parts explicit: `enum` for algebraic data types,
`opaque type` for zero-cost domain types, `given`/`using` for type classes.
Pick one effect stack per service and stay inside it; most Scala pain comes
from mixing styles, not from the language.

## When to use

- New Scala 3 services, libraries or scripts, or reviewing existing Scala code.
- Migrating Scala 2.13 code to Scala 3 syntax and implicits.
- Choosing between `Future`, Cats Effect, ZIO or direct-style code.
- Setting up sbt, scala-cli, formatting, linting and tests.
- Spark or data jobs written in Scala that need cleaner domain code.

## When not to use

- Java or Kotlin code on the same JVM: use `java-modern` or `kotlin-patterns`.
- Spark job tuning (partitions, skew, joins): use `pyspark` for the engine concepts.
- Streaming system design: use `stream-processing`.
- Build failures: delegate to `jvm-build-resolver`.

## Workflow

1. **Read the build.** Check `build.sbt` (`scalaVersion`, `scalacOptions`, libraries), `project/build.properties` (sbt version), `project/plugins.sbt`, and whether scala-cli or Mill is used instead.

   ```bash
   sbt about                       # sbt and Scala versions
   sbt compile
   sbt evicted                     # version conflicts
   ```

   On Windows, `sbt` runs from PowerShell once installed (Coursier `cs setup` installs sbt, scala-cli and a JDK).

   **Check:** The project compiles and you know the Scala version (3.3 LTS line for libraries, or the current 3.x for applications).

2. **Turn on useful warnings.** Add `-deprecation`, `-feature`, `-Wunused:all` and `-Xfatal-warnings` (newer releases also accept `-Werror`) once existing warnings are fixed.

   **Check:** `sbt compile` is warning-free with the flags enabled.

3. **Model the domain with ADTs and opaque types.** `enum` or `sealed trait` hierarchies for alternatives, `case class` for records, `opaque type` with a smart constructor for validated IDs and units. Match exhaustively; the compiler warns on missing cases.

   **Check:** Adding an enum case produces non-exhaustive match warnings (errors with fatal warnings) where it must be handled.

4. **Use type classes for cross-cutting behaviour.** Define a trait, provide `given` instances in the companion object, require them with `using`. Use `derives` for built-in (`CanEqual`) or library-provided derivation (JSON codecs).

   **Check:** No `implicit def` conversions remain in new code; implicit scope is predictable (instances live in companions).

5. **Choose one effect stack** (table below) and keep side effects at the edges. Do not mix `Future` with `IO` or `ZIO` except at a single adapter layer.

   **Check:** `grep_search` shows one effect type in service signatures, with adapters only in an integration package.

6. **Format, lint and test.**

   ```bash
   sbt scalafmtCheckAll "scalafixAll --check" test
   sbt "testOnly *OrderSuite"
   sbt ~test                       # watch mode during development
   ```

   **Check:** Formatting, scalafix rules and tests pass in CI.

## Patterns

### ADTs, opaque types and exhaustive matching

```scala
enum PaymentResult:
  case Approved(authCode: String, amountCents: Long)
  case Declined(reason: String)
  case Pending(retryAfterSeconds: Int)

def describe(r: PaymentResult): String = r match
  case PaymentResult.Approved(code, cents) => s"approved $code for $cents"
  case PaymentResult.Declined(reason)      => s"declined: $reason"
  case PaymentResult.Pending(s)            => s"retry in ${s}s"

object ids:
  opaque type UserId = String
  object UserId:
    def parse(s: String): Either[String, UserId] =
      if s.matches("u_[a-z0-9]+") then Right(s) else Left(s"invalid user id: $s")
  extension (id: UserId) def value: String = id
```

Outside `ids`, a `UserId` is not a `String`, so IDs cannot be mixed up, and there is no runtime wrapper.

### Type classes with given and using

```scala
trait Show[A]:
  extension (a: A) def show: String

object Show:
  given Show[Int] with
    extension (a: Int) def show: String = a.toString
  given [A](using Show[A]): Show[List[A]] with
    extension (as: List[A]) def show: String = as.map(_.show).mkString("[", ", ", "]")

def render[A: Show](a: A): String = a.show   // context bound desugars to a using clause

render(List(1, 2, 3))                        // "[1, 2, 3]"
```

### Effect stacks

| Stack | Model | Ecosystem | Choose when |
| :--- | :--- | :--- | :--- |
| `scala.concurrent.Future` | Eager, no built-in cancellation | Standard library, Play, Pekko | Simple async, existing Future-based code |
| Cats Effect 3 (`IO`) | Lazy, cancellable fibers, resource safety | http4s, fs2, doobie, Typelevel libraries | Functional style with a broad library ecosystem |
| ZIO 2 (`ZIO[R, E, A]`) | Typed errors and environment, layers for DI | zio-http, zio-json, ZIO ecosystem | Typed error channels and built-in DI |
| Direct style (for example Ox on virtual threads) | Plain blocking-looking code, structured concurrency | Smaller, newer | Teams wanting simple code on Java 21+ |
| Actors (Apache Pekko, Akka) | Message passing, clustering | Pekko is the Apache-licensed fork after Akka's licence change | Stateful distributed actors and streams |

Library versions and APIs in this space move quickly; check each project's documentation before adopting.

### build.sbt baseline

```scala
ThisBuild / scalaVersion := "3.3.4"   // pin the latest 3.3.x LTS patch from scala-lang.org
ThisBuild / scalacOptions ++= Seq("-deprecation", "-feature", "-Wunused:all", "-Xfatal-warnings")

lazy val root = (project in file("."))
  .settings(
    name := "orders",
    libraryDependencies ++= Seq(
      "org.scalameta" %% "munit" % "1.0.0" % Test,              // check for the current release
      "org.scalameta" %% "munit-scalacheck" % "1.0.0" % Test,
    ),
  )
```

`.scalafmt.conf` needs at least `version = "<scalafmt version>"` and `runner.dialect = scala3`. For one-file tools and scripts, prefer scala-cli (`scala run script.scala`, with `//> using dep ...` directives at the top).

### Tests with munit and ScalaCheck

```scala
class MoneySuite extends munit.ScalaCheckSuite:
  test("rejects malformed ids"):
    assert(ids.UserId.parse("nope").isLeft)

  property("format then parse round-trips"):
    org.scalacheck.Prop.forAll((cents: Long) => Money.parse(Money.format(cents)) == Right(cents))
```

### Migrating from Scala 2.13

Compile 2.13 code with `-Xsource:3` first; then build with Scala 3 using `-source:3.0-migration -rewrite` to apply automatic rewrites. Replace `implicit` definitions with `given`/`using` gradually; both work in Scala 3. Macros must be rewritten; check every macro-based dependency for a Scala 3 release before starting.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Implicit conversions (`implicit def a2b`) | Explicit methods or extension methods | Hidden conversions surprise readers and the compiler |
| `Any`, `asInstanceOf`, `null` in domain code | ADTs, `Option`, `Either` | Type safety is the reason to use Scala |
| Mixing `Future`, `IO` and `ZIO` in one service | One stack plus an adapter layer | Cancellation and error semantics differ |
| Blocking calls inside `IO`/`ZIO` without the blocking pool | `IO.blocking` / `ZIO.attemptBlocking` | Starves the compute pool |
| Deep type-level tricks in application code | Plain ADTs and type classes | Compile times and onboarding cost explode |
| Unpinned plugin and library versions | Pin versions; update with Scala Steward or Renovate | Reproducible builds |

## Verification checklist

- [ ] Scala and sbt versions are pinned; warnings flags on and clean.
- [ ] Domain uses enums/sealed traits, case classes and opaque types; matches are exhaustive.
- [ ] Type class instances live in companions; no implicit conversions.
- [ ] One effect stack per service; blocking work uses the blocking pool.
- [ ] `scalafmtCheckAll`, `scalafixAll --check` and tests pass in CI.

## Related

- Knowledge: `java-modern`, `kotlin-patterns`, `pyspark`, `stream-processing`, `tdd-testing`.
- Workflows: `/framework-migration`, `/code-review`.
- Agents: `jvm-build-resolver`, `code-reviewer`.
