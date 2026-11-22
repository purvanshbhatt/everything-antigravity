---
name: csharp-dotnet
description: >-
  Writes modern C# and .NET: nullable reference types as errors, records and
  required members, pattern matching, LINQ pitfalls, async/await rules,
  CancellationToken flow, DI lifetimes and captive dependencies, validated
  options, logging, Directory.Build.props, central package management and
  analyzers. Use when writing, reviewing or modernising C# code or a .NET
  solution's build.
---

# Modern C# and .NET

Turn the compiler into a reviewer: nullable warnings as errors, analyzers on,
one place for versions. Then follow a few non-negotiable runtime rules: async
all the way, tokens passed everywhere, and no service holding a dependency
that lives shorter than itself.

## When to use

- New C# libraries, workers, console apps or the shared code under an ASP.NET Core API.
- Enabling nullable reference types or analyzers on an existing solution.
- Deadlocks, thread-pool starvation, `ObjectDisposedException` or "Cannot access a disposed context".
- DI lifetime bugs, configuration binding that silently yields defaults.
- Cleaning up a multi-project solution's build and package versions.

## When not to use

- HTTP endpoints, middleware, EF Core and auth: use `aspnet-core`.
- Unity scripting: use `unity`.
- Build errors you need fixed fast: delegate to `dotnet-build-resolver`; reviews to `csharp-reviewer`.
- Cross-runtime race and deadlock methodology: use `concurrency-bugs`.

## Workflow

1. **Read the toolchain.** Check installed SDKs, `global.json` (SDK pin), target frameworks and language version.

   ```bash
   dotnet --list-sdks
   dotnet --info
   dotnet build -warnaserror      # baseline: how many warnings exist today?
   ```

   **Check:** The SDK in `global.json` matches CI and the target framework is a supported release (prefer the current LTS; check Microsoft's support policy).

2. **Centralise build settings.** Put shared properties in `Directory.Build.props` and package versions in `Directory.Packages.props` (central package management). Turn on nullable, analyzers and warnings-as-errors (pattern below).

   **Check:** No `.csproj` sets its own package `Version=` attributes; `dotnet build` is clean.

3. **Model data with records and required members.** `record` or `record struct` for values, `required` and `init` for construction-time guarantees, pattern matching (`switch` expressions, property and list patterns) for branching.

   **Check:** Nullable warnings in changed files are fixed, not suppressed with `!`.

4. **Apply the async rules.** Async all the way: no `.Result`, `.Wait()` or `GetAwaiter().GetResult()` on request paths. No `async void` except event handlers. Accept a `CancellationToken` in every async public method and pass it to every call. Use `ConfigureAwait(false)` in libraries that may run under a synchronization context.

   **Check:** `grep_search` for `.Result`, `.Wait()` and `async void` in changed code returns only justified cases.

5. **Get DI lifetimes right.** Singleton must not depend on scoped (captive dependency); `DbContext` is scoped; `HttpClient` comes from `IHttpClientFactory` or typed clients. Validate the container at startup.

   **Check:** Startup with `ValidateScopes` and `ValidateOnBuild` enabled (the default in Development) throws no lifetime errors.

6. **Bind configuration to validated options.** Use the options pattern with data annotations and `ValidateOnStart()`. Development secrets via `dotnet user-secrets`; production via environment variables (`Section__Key`) or Secret Manager.

   **Check:** Removing a required setting makes the app fail at startup with the option name in the error.

7. **Run the gates.**

   ```bash
   dotnet format --verify-no-changes
   dotnet build -c Release
   dotnet test
   dotnet list package --vulnerable --include-transitive
   ```

   **Check:** All pass; vulnerable packages are upgraded or explicitly accepted by the user.

## Patterns

### Directory.Build.props and central packages

```xml
<!-- Directory.Build.props -->
<Project>
  <PropertyGroup>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <AnalysisLevel>latest-recommended</AnalysisLevel>
    <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
  </PropertyGroup>
</Project>

<!-- Directory.Packages.props -->
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="Microsoft.Extensions.Http.Resilience" Version="x.y.z" />  <!-- pin current -->
  </ItemGroup>
</Project>
```

Projects then use `<PackageReference Include="..." />` without a version.

### Options with validation and a typed client

```csharp
public sealed class PaymentsOptions
{
    public const string Section = "Payments";
    [Required, Url] public required string BaseUrl { get; init; }
    [Range(1, 60)] public int TimeoutSeconds { get; init; } = 10;
}

builder.Services.AddOptions<PaymentsOptions>()
    .Bind(builder.Configuration.GetSection(PaymentsOptions.Section))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddHttpClient<PaymentsClient>((sp, http) =>
{
    var o = sp.GetRequiredService<IOptions<PaymentsOptions>>().Value;
    http.BaseAddress = new Uri(o.BaseUrl);
    http.Timeout = TimeSpan.FromSeconds(o.TimeoutSeconds);
})
.AddStandardResilienceHandler();   // retries, timeouts, circuit breaker (Microsoft.Extensions.Http.Resilience)
```

### Async and cancellation

```csharp
public async Task<IReadOnlyList<Invoice>> GetOverdueAsync(DateOnly asOf, CancellationToken ct)
{
    var ids = await _store.ListOverdueIdsAsync(asOf, ct);
    var invoices = await Task.WhenAll(ids.Select(id => _store.GetAsync(id, ct)));  // bounded set only
    return invoices;
}
```

For large or unbounded sets use `Parallel.ForEachAsync` with `MaxDegreeOfParallelism`, or `IAsyncEnumerable<T>` with `await foreach`.

### LINQ pitfalls

| Pitfall | Fix |
| :--- | :--- |
| Enumerating an `IEnumerable<T>` twice (re-runs the query or generator) | Materialise once with `ToList()` / `ToArray()` |
| `Count() > 0` | `Any()` |
| `First()` where none may exist | `FirstOrDefault()` and handle `null` |
| Client-side filtering after `AsEnumerable()` on EF queries | Keep filters on `IQueryable` so they translate to SQL |
| Deferred query capturing a `for` loop variable or a variable changed later | Materialise immediately or copy to a local first |

### DI lifetimes

| Lifetime | Use for | Never inject into |
| :--- | :--- | :--- |
| Singleton | Stateless services, caches, typed client factories | — |
| Scoped | `DbContext`, unit of work, per-request state | Singletons (resolve via `IServiceScopeFactory` instead) |
| Transient | Lightweight stateless helpers | Long-lived singletons if they hold resources |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `.Result` / `.Wait()` on tasks | `await` | Deadlocks and thread-pool starvation |
| `async void` methods | `async Task` | Exceptions crash the process; callers cannot await |
| `new HttpClient()` per call | `IHttpClientFactory` or typed clients | Socket exhaustion and stale DNS |
| `!` (null-forgiving) to silence warnings | Fix the flow or annotate correctly | Moves the crash to runtime |
| `catch (Exception) { }` | Catch specific exceptions; log with context; rethrow with `throw;` | `throw ex;` also resets the stack trace |
| String-interpolated log messages | Message templates: `_log.LogInformation("Paid {InvoiceId}", id)` | Structured logs and no allocation when disabled |
| Scattered package versions | Central package management | Version drift across projects |

## Verification checklist

- [ ] Nullable enabled and warnings-as-errors on; no new `!` suppressions.
- [ ] Shared build settings and package versions are centralised.
- [ ] No sync-over-async, no `async void`; tokens flow through every async call.
- [ ] DI validates on build; no singleton holds a scoped service.
- [ ] Options are bound, validated and checked at startup.
- [ ] `dotnet format`, build, tests and the vulnerable-package check pass.

## Related

- Knowledge: `aspnet-core`, `unity`, `concurrency-bugs`, `profiling`, `linting-formatting`, `static-analysis`.
- Workflows: `/build-fix`, `/dependency-upgrades`, `/code-review`.
- Agents: `csharp-reviewer`, `dotnet-build-resolver`.
