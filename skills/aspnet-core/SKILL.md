---
name: aspnet-core
description: >-
  Builds ASP.NET Core APIs: minimal APIs with route groups and TypedResults or
  controllers, middleware order, ProblemDetails errors, EF Core usage and
  migrations, JWT bearer authentication and authorization policies, rate
  limiting, OpenAPI, health checks, WebApplicationFactory integration tests,
  and container publishing for Cloud Run. Use when creating, extending,
  testing or deploying an ASP.NET Core web API.
---

# ASP.NET Core APIs

An ASP.NET Core app is a pipeline: middleware in the right order, endpoints
that return typed results, errors normalised to problem details, and EF Core
queries that project to DTOs. Prove it with in-memory host tests and ship it
as a container with real health checks.

## When to use

- Creating a web API or adding endpoints, middleware, auth or EF Core entities.
- 500s without useful bodies, inconsistent error shapes, or auth that "works locally".
- Slow endpoints from EF Core tracking, N+1 includes or client-side evaluation.
- Integration tests for the HTTP surface, or preparing a container deployment.

## When not to use

- Language, async, DI and options fundamentals: use `csharp-dotnet`.
- API contract and versioning decisions: use `api-design`; auth architecture: `auth-patterns`.
- Migration rollout strategy on shared databases: use `database-migrations`.
- Reviews: delegate to `csharp-reviewer`; build errors to `dotnet-build-resolver`.

## Workflow

1. **Read `Program.cs` top to bottom.** List registered services, middleware order and endpoint mapping; note the target framework and whether the app uses minimal APIs, controllers or both.

   **Check:** You can write the middleware order down and it matches the reference order below.

2. **Choose the endpoint style and stay consistent.** Minimal APIs with `MapGroup` and `TypedResults` for new services; controllers when the codebase already uses them or needs model-binding features they provide.

   **Check:** New endpoints follow the existing style; each group applies auth and filters once.

3. **Normalise errors.** `AddProblemDetails()`, `UseExceptionHandler()`, `UseStatusCodePages()`; implement `IExceptionHandler` (.NET 8+) to map domain exceptions to status codes. Validate input with data annotations, FluentValidation, or built-in minimal API validation where your .NET version provides it (verify against current docs).

   **Check:** A thrown domain exception and an invalid body both return `application/problem+json` without stack traces in Production.

4. **Use EF Core deliberately.** Register `DbContext` as scoped; read with `AsNoTracking()` and `Select` projections to DTOs; avoid lazy loading; use `ExecuteUpdateAsync`/`ExecuteDeleteAsync` for set-based writes; add concurrency tokens where users edit the same rows. Generate migrations with `dotnet ef migrations add <Name>`, review the SQL with `dotnet ef migrations script --idempotent`, and get user confirmation before applying to any shared database.

   **Check:** Logged SQL for list endpoints is one query (or a fixed number) regardless of row count.

5. **Authenticate and authorise.** `AddAuthentication().AddJwtBearer()` with authority and audience from configuration (your identity provider's issuer), named policies via `AddAuthorization`, and `RequireAuthorization("policy")` on groups. Check object ownership in the handler, not only the role.

   **Check:** No token gives 401, wrong policy gives 403, another user's resource gives 404 or 403.

6. **Add operational endpoints.** Liveness (process only) and readiness (dependencies) health checks, OpenAPI document (`AddOpenApi()`/`MapOpenApi()` on .NET 9+), rate limiting for public endpoints, and structured logging.

   **Check:** `/healthz/ready` fails when the database is down while `/healthz/live` stays healthy.

7. **Test through the host.** `WebApplicationFactory<Program>` (package `Microsoft.AspNetCore.Mvc.Testing`), replacing external services in `ConfigureTestServices` and using a Testcontainers database for EF Core.

   **Check:** `dotnet test` covers happy path, validation, 401/403 and not-found for each new endpoint.

8. **Publish a container.** `dotnet publish -c Release /t:PublishContainer` (SDK container support) or a multi-stage Dockerfile. .NET 8+ images listen on port 8080 by default; set `ASPNETCORE_HTTP_PORTS` if the platform uses another port. Confirm project, region and service with the user before deploying.

   **Check:** The image runs locally and answers `/healthz/ready` with the production configuration shape.

## Patterns

### Program.cs with minimal APIs

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<DomainExceptionHandler>();
builder.Services.AddDbContext<AppDb>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Db")));
builder.Services.AddAuthentication().AddJwtBearer();   // binds Authentication:Schemes:Bearer from config
builder.Services.AddAuthorization(o => o.AddPolicy("orders:read",
    p => p.RequireClaim("scope", "orders:read")));   // if your IdP sends one space-delimited "scope" claim, split it first
builder.Services.AddRateLimiter(o => o.AddFixedWindowLimiter("public", l =>
{
    l.PermitLimit = 100;
    l.Window = TimeSpan.FromMinutes(1);
}));
builder.Services.AddHealthChecks().AddDbContextCheck<AppDb>(tags: ["ready"]);
builder.Services.AddOpenApi();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapOpenApi();
app.MapHealthChecks("/healthz/live", new() { Predicate = _ => false });
app.MapHealthChecks("/healthz/ready", new() { Predicate = c => c.Tags.Contains("ready") });

var orders = app.MapGroup("/v1/orders").RequireAuthorization("orders:read");

orders.MapGet("/{id:guid}", async Task<Results<Ok<OrderDto>, NotFound>> (Guid id, AppDb db, CancellationToken ct) =>
{
    var dto = await db.Orders.AsNoTracking()
        .Where(o => o.Id == id)
        .Select(o => new OrderDto(o.Id, o.TotalCents, o.Status))
        .FirstOrDefaultAsync(ct);
    return dto is null ? TypedResults.NotFound() : TypedResults.Ok(dto);
});

app.Run();

public partial class Program { }   // lets WebApplicationFactory<Program> see the entry point
```

### Exception handler

```csharp
public sealed class DomainExceptionHandler(IProblemDetailsService problems) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)
    {
        var status = ex switch
        {
            NotFoundException => StatusCodes.Status404NotFound,
            ConflictException => StatusCodes.Status409Conflict,
            _ => 0,
        };
        if (status == 0) return false;   // fall through to the default 500 handling
        ctx.Response.StatusCode = status;
        return await problems.TryWriteAsync(new() { HttpContext = ctx, Exception = ex });
    }
}
```

### Middleware order (reference)

`UseExceptionHandler` → `UseHsts` → `UseHttpsRedirection` → `UseStaticFiles` → `UseRouting` (implicit) → `UseCors` → `UseAuthentication` → `UseAuthorization` → `UseRateLimiter` → custom middleware → endpoints. Behind a TLS-terminating load balancer (Cloud Run, GKE ingress), configure forwarded headers instead of `UseHttpsRedirection`.

### Integration test

```csharp
public sealed class OrdersApiTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task Get_without_token_returns_401()
    {
        using var client = factory.CreateClient();
        var res = await client.GetAsync($"/v1/orders/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }
}
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `UseAuthorization()` before `UseAuthentication()` | Authentication first | Users are never identified, so policies fail |
| Returning EF entities from endpoints | Project to DTO records | Over-posting, cycles, accidental data exposure |
| `Database.Migrate()` at startup in multi-instance apps | Apply reviewed scripts or migration bundles in a release step | Concurrent instances race on schema changes |
| Tracking queries for read-only endpoints | `AsNoTracking()` plus projection | Extra memory and CPU per request |
| Exception messages and stack traces in responses | ProblemDetails with safe messages; details in logs | Leaks internals to attackers |
| A single health endpoint that checks everything | Separate liveness and readiness | Dependency blips restart healthy pods |
| Swallowing `OperationCanceledException` as 500 | Let cancellation end the request quietly | Client disconnects pollute error metrics |

## Verification checklist

- [ ] Middleware order matches the reference; auth runs before authorization.
- [ ] Errors return ProblemDetails; domain exceptions map to specific statuses.
- [ ] EF Core reads are no-tracking projections; migrations reviewed as SQL.
- [ ] Every new endpoint has auth, validation and object-level checks.
- [ ] Liveness and readiness are separate; OpenAPI document is generated.
- [ ] `WebApplicationFactory` tests pass; the container runs with production-shaped config.

## Related

- Knowledge: `csharp-dotnet`, `api-design`, `auth-patterns`, `orm-patterns`, `database-migrations`, `observability-otel`, `cloud-run`, `docker-containers`.
- Workflows: `/api-scaffold`, `/dockerize`, `/tdd`, `/verify`.
- Agents: `csharp-reviewer`, `dotnet-build-resolver`, `backend-engineer`.
