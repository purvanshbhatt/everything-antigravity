---
trigger: glob
globs: "**/*.cs"
description: C# and .NET conventions
---

# C# and .NET

## Tooling

- Gate with `dotnet build` (warnings as errors where configured), `dotnet test` and `dotnet format --verify-no-changes`. Respect `TargetFramework`, `LangVersion` and `Directory.Build.props`; do not change them as a side effect.
- Keep `<Nullable>enable</Nullable>`. Fix nullable warnings properly; the `!` null-forgiving operator needs a comment saying why it is safe.

## Style

- PascalCase for types, methods and properties; `_camelCase` for private fields; `I` prefix for interfaces; `Async` suffix for async methods.
- File-scoped namespaces, one public type per file, `var` when the type is obvious from the right-hand side.
- Prefer `record` / `record struct` for immutable data, `init` accessors, `readonly` fields and `IReadOnlyList<T>` / `IReadOnlyDictionary` in public signatures.
- Use pattern matching and switch expressions; keep them exhaustive over enums with a default that throws.

## Async

- `async Task` / `async Task<T>`; `async void` only for event handlers.
- Never block on async code with `.Result`, `.Wait()` or `.GetAwaiter().GetResult()`.
- Accept and pass a `CancellationToken` through every async I/O path.
- Library code uses `ConfigureAwait(false)` where the project convention requires it.
- Use `ValueTask` only when profiling justifies it, and never await one twice.

## Errors and resources

- Catch specific exceptions; no empty `catch`. Rethrow with `throw;`, never `throw ex;`, to keep the stack trace.
- Do not use exceptions for normal control flow; use `TryParse`-style APIs or result types for expected failures.
- Dispose with `using` / `await using`. Implement `IDisposable` / `IAsyncDisposable` only when owning unmanaged or disposable resources.
- Validate arguments with `ArgumentNullException.ThrowIfNull(x)` and similar guard helpers.

## ASP.NET Core and dependencies

- Constructor injection; register lifetimes deliberately (never inject a scoped service into a singleton).
- Use `IHttpClientFactory` or typed clients; never `new HttpClient()` per request.
- Bind configuration with the options pattern (`IOptions<T>`) and validate it on start.
- Log with `ILogger<T>` and message templates: `logger.LogInformation("Order {OrderId} placed", id)`. No string interpolation in log calls, no `Console.WriteLine` in services, no secrets or personal data in logs.

## Data access

- EF Core: `AsNoTracking()` for read-only queries, project with `Select` instead of loading whole graphs, avoid N+1 with `Include` or projections, and add migrations instead of editing applied ones.
- Raw SQL only via parameterized APIs (`FromSql($"...")` interpolation is parameterized; `FromSqlRaw` with string concatenation is not).

## Tests

- xUnit, NUnit or MSTest per the project; one behaviour per test; `[Theory]` with data for variants.
- Use fakes or mocks behind interfaces for I/O, `TimeProvider` (or an injected clock) for time, and `WebApplicationFactory` for API integration tests.
- Run one test: `dotnet test --filter "FullyQualifiedName~OrderServiceTests"`.
