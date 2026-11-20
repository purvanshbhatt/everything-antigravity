---
name: golang-services
description: >-
  Builds and reviews idiomatic Go services: project layout, context
  propagation and cancellation, error wrapping with errors.Is and errors.As,
  concurrency with errgroup and worker pools without goroutine leaks, net/http
  ServeMux routing patterns (Go 1.22+), database/sql or pgx, table tests,
  httptest, -race and fuzzing, golangci-lint, govulncheck, and graceful
  shutdown. Use when writing, reviewing or debugging a Go API, worker or CLI.
---

# Go Services

Write Go services that stop cleanly, never leak goroutines, carry `context`
through every blocking call, and wrap errors so callers can branch on them.
Prefer the standard library until it demonstrably isn't enough.

## When to use

- Creating a Go HTTP API, background worker or CLI, or adding handlers and packages to one.
- Hangs, goroutine leaks, slow shutdowns, data races or "context canceled" noise.
- Choosing between `database/sql` and pgx, or setting up migrations and DB tests.
- Setting up lint, vulnerability scanning and race-enabled tests for a Go module.

## When not to use

- API contract design: use `api-design`. Schema and index design: use `database-design`.
- Container and cluster deployment: use `docker-containers` or `kubernetes-gke`.
- Tracing and metrics instrumentation: use `observability-otel`.
- A second opinion on a diff: delegate to the `go-reviewer` agent.

## Workflow

1. **Read the module before changing it.** Check `go.mod` (the `go` line and `toolchain`), the existing layout, and how logging, config and errors are already handled.

   ```bash
   go version
   go env GOPATH GOFLAGS
   go list ./...
   go build ./... && go vet ./...
   ```

   **Check:** The module builds and vets cleanly before your change, or you have recorded the existing failures.

2. **Place code by responsibility.** Use `cmd/<app>/main.go` for wiring only and `internal/<domain>` for logic, keeping storage behind small interfaces defined where they are consumed. Don't create `utils` or `common` packages. Keep `main` to `run(ctx, ...) error` so it can be tested.

   **Check:** `go build ./...` succeeds (Go rejects import cycles), and `main.go` contains wiring, not business logic.

3. **Thread `context.Context` through every blocking call.** Make it the first parameter. Pass it to DB calls (`QueryContext`, pgx methods), outgoing HTTP (`http.NewRequestWithContext`) and channel waits (`select` on `ctx.Done()`). Set deadlines at the edges with `context.WithTimeout`, and always `defer cancel()`. Use `context.WithoutCancel` (Go 1.21+) for work that must outlive the request, such as audit writes.

   **Check:** `grep_search` for `context.Background()` and `context.TODO()` outside `main` and tests; each remaining one is justified.

4. **Handle errors once, with context.** Wrap with `fmt.Errorf("load user %d: %w", id, err)`. Expose sentinels (`var ErrNotFound = errors.New("not found")`) or typed errors for conditions callers branch on, and test them with `errors.Is` and `errors.As`, never by comparing strings. Either log or return an error, not both. Map domain errors to HTTP status codes in one place at the edge.

   **Check:** `golangci-lint run` reports no `errcheck` or `errorlint` findings in changed files.

5. **Bound and own every goroutine.** Use `errgroup.WithContext` with `SetLimit` for fan-out, and a fixed worker pool for streams. Every goroutine needs an exit path tied to `ctx` or a closed channel. Patterns: [concurrency and testing](references/concurrency-and-testing.md).

   **Check:** Tests pass with `-race`, and `goleak` (if the project uses it) reports no leaked goroutines.

6. **Serve HTTP with timeouts and graceful shutdown.** Use `http.ServeMux` method and wildcard patterns (Go 1.22+), set server timeouts, cap request bodies, and shut down on SIGINT and SIGTERM with a deadline. Full skeleton: [service skeleton](references/service-skeleton.md).

   **Check:** Sending SIGTERM (or `Ctrl+C` locally) during a slow request lets that request finish, then the process exits with code 0 before the deadline.

7. **Run the gates.**

   ```bash
   gofmt -l .                       # must print nothing
   go vet ./...
   golangci-lint run
   go test -race -count=1 ./...
   govulncheck ./...
   ```

   Install `govulncheck` with `go install golang.org/x/vuln/cmd/govulncheck@latest`, or track it as a tool dependency (`go get -tool`, Go 1.24+) and run `go tool govulncheck ./...`. On Windows, `-race` needs cgo and a C toolchain; run it in CI or WSL if it isn't available locally.

   **Check:** All gates pass. Any `govulncheck` finding in a reachable symbol is fixed or explicitly accepted by the user.

## Patterns

### Routing with the standard library (Go 1.22+)

```go
mux := http.NewServeMux()
mux.HandleFunc("GET /healthz", healthz)
mux.HandleFunc("GET /v1/users/{id}", h.getUser)
mux.HandleFunc("POST /v1/users", h.createUser)
mux.HandleFunc("GET /files/{path...}", h.serveFile)   // trailing wildcard
mux.HandleFunc("GET /{$}", h.index)                     // exactly "/"

func (h *Handler) getUser(w http.ResponseWriter, r *http.Request) {
    id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
    if err != nil {
        http.Error(w, "invalid id", http.StatusBadRequest)
        return
    }
    u, err := h.users.Get(r.Context(), id)
    switch {
    case errors.Is(err, store.ErrNotFound):
        http.Error(w, "not found", http.StatusNotFound)
        return
    case err != nil:
        h.log.ErrorContext(r.Context(), "get user", "id", id, "err", err)
        http.Error(w, "internal error", http.StatusInternalServerError)
        return
    }
    writeJSON(w, http.StatusOK, u)
}
```

A `GET` pattern also matches `HEAD`. When two patterns overlap, the more
specific one wins; patterns that conflict with equal specificity panic at
registration. Check the `go.mod` `go` line is 1.22 or later, because older
language versions keep the old matching behaviour.

### Decoding input safely

```go
r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MiB
dec := json.NewDecoder(r.Body)
dec.DisallowUnknownFields()
var in CreateUserInput
if err := dec.Decode(&in); err != nil {
    http.Error(w, "invalid JSON", http.StatusBadRequest)
    return
}
if err := in.Validate(); err != nil {
    http.Error(w, err.Error(), http.StatusUnprocessableEntity)
    return
}
```

### Database access

| Choice | Use when |
| :--- | :--- |
| `database/sql` with the pgx stdlib driver (`github.com/jackc/pgx/v5/stdlib`) | You want driver portability or libraries that expect `*sql.DB` |
| `pgxpool` directly | Postgres only, and you want native types, `CopyFrom`, batches and better performance |
| `sqlc` on top of either | You want type-safe generated queries from SQL files |

Rules: always `defer rows.Close()` and check `rows.Err()`. With `database/sql`, set `SetMaxOpenConns`, `SetMaxIdleConns` and `SetConnMaxLifetime`. For transactions, `defer tx.Rollback()` right after `BeginTx` (it is a no-op after a successful `Commit`). Map `sql.ErrNoRows` or `pgx.ErrNoRows` to your own `ErrNotFound` at the store boundary. Use a migration tool such as goose, golang-migrate or Atlas, and confirm with the user before running migrations against shared databases.

### Table-driven test

```go
func TestParseAmount(t *testing.T) {
    tests := []struct {
        name    string
        in      string
        want    int64
        wantErr error
    }{
        {"whole", "12", 1200, nil},
        {"cents", "12.34", 1234, nil},
        {"negative", "-1", 0, ErrNegative},
        {"garbage", "1x", 0, ErrSyntax},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel() // capturing tt is safe with Go 1.22+ per-iteration loop variables
            got, err := ParseAmount(tt.in)
            if !errors.Is(err, tt.wantErr) {
                t.Fatalf("err = %v, want %v", err, tt.wantErr)
            }
            if got != tt.want {
                t.Fatalf("got %d, want %d", got, tt.want)
            }
        })
    }
}
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Use `http.DefaultClient` or a zero `http.Server` | Set `Client.Timeout` and the server's `ReadHeaderTimeout`, `ReadTimeout`, `WriteTimeout` and `IdleTimeout` | No timeouts means hung connections pile up |
| Start goroutines with no way to stop them | Tie them to `ctx`, an `errgroup`, or a closed channel | Leaks grow memory until the process dies |
| Store a `context.Context` in a struct | Pass it as the first argument | Contexts are per-call and get stale |
| `log.Fatal` outside `main` | Return errors up to `main` | Skips deferred cleanup and graceful shutdown |
| Compare errors with `err.Error() ==` | `errors.Is` or `errors.As` | Messages change; wrapping breaks equality |
| Ignore `rows.Err()` or `resp.Body.Close()` | Always check and close | Silent partial results and connection leaks |
| Add a framework for routing alone | `http.ServeMux` patterns | Fewer dependencies, standard behaviour |

## Verification checklist

- [ ] Every blocking call takes a `context.Context` derived from the request or the process root.
- [ ] Errors are wrapped with `%w` and handled once; callers branch with `errors.Is` or `errors.As`.
- [ ] Every goroutine has an owner and an exit path; tests pass with `-race`.
- [ ] The HTTP server and clients have timeouts, and request bodies are size-limited.
- [ ] SIGTERM drains in-flight requests and exits before the deadline.
- [ ] `gofmt`, `go vet`, `golangci-lint`, `go test -race` and `govulncheck` pass.

## Related

- Workflows: `/tdd`, `/feature-dev`, `/verify`, `/build-fix`, `/code-review`, `/root-cause`.
- Knowledge: `api-design`, `backend-patterns`, `database-design`, `auth-patterns`, `docker-containers`, `observability-otel`, `tdd-testing`.
- Agents: `go-reviewer`, `test-engineer`, `database-architect`, `performance-optimizer`.
