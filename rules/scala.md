---
trigger: glob
globs: "**/*.scala, **/*.sbt"
description: Scala conventions
---

# Scala

## Environment and tooling

- Respect the Scala version in `build.sbt` (or `build.sc`, `project.scala`) and the sbt version in `project/build.properties`. Do not mix Scala 2 and Scala 3 syntax in one module.
- Format with scalafmt using the project's `.scalafmt.conf` (`sbt scalafmtCheckAll`). Lint with scalafix and compiler warnings when configured.
- Keep compiler warnings meaningful: respect `-Werror`/`-Xfatal-warnings`, `-deprecation` and unused-import warnings. Do not add `@nowarn` to pass a build.
- Pin dependency versions in the build; say so when you add one. Prefer `%%` for Scala libraries so the binary version matches.

## Types and modelling

- Model data with immutable `case class`es and closed hierarchies: Scala 3 `enum` or `sealed trait` with cases. Make pattern matches exhaustive; do not add a catch-all `case _` that hides new cases.
- Annotate the types of public members. Do not let inferred types leak implementation details into public APIs.
- Use `Option` for absence, never `null`. Wrap Java APIs that return `null` with `Option(...)` at the boundary.
- Use opaque types (Scala 3) or value classes for identifiers and units instead of raw `String` and `Long`.
- Use `given`/`using` (or Scala 2 implicits) only for type classes and context, not for hidden conversions. Avoid implicit conversions.

## Errors

- Return `Either`, `Try` or the effect type's error channel for expected failures. Do not throw for control flow.
- Never catch `Throwable` broadly; use `scala.util.control.NonFatal` when catching unknowns.
- Never call `.get` on `Option`, `Try` or `Either`, or `.head` on collections that can be empty, outside tests.

## Functional style and effects

- Prefer `val`, immutable collections and pure functions. Keep `var` and mutable collections local and justified.
- Stay within one effect system per service (Cats Effect, ZIO or `Future`). Do not mix them without an explicit boundary.
- With `Future`, pass an explicit `ExecutionContext` and never block on the global pool; with Cats Effect or ZIO, wrap blocking calls in `blocking` / `ZIO.attemptBlocking`.
- Do not use `Await.result` outside `main` and tests.
- Use `for` comprehensions for sequential effects; use the library's parallel combinators deliberately.

## Collections and performance

- Choose collections for the access pattern (`Vector` for indexed, `List` for prepend and recursion, `Map`/`Set` for lookup). Avoid repeated `:+` on `List`.
- Use `.view`, iterators or streaming libraries (fs2, ZIO Streams, Akka/Pekko Streams) for large data instead of materialising everything.

## Spark and data jobs

- Prefer `Dataset`/`DataFrame` operations over UDFs, avoid `collect()` on large data, and declare schemas explicitly instead of inferring them in production.

## Tests

- Use the project's framework (MUnit, ScalaTest, specs2, weaver). Property-based tests with ScalaCheck for pure logic.
- Test effects with the library's test runtime (`munit-cats-effect`, ZIO Test) and controlled clocks, not `Thread.sleep`.
- Run the narrowest test first (`sbt "testOnly *MySpec"`), then the suite.
