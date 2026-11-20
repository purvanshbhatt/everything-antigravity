---
trigger: glob
globs: "**/*.go"
description: Go conventions
---

# Go

## Tooling

- Code must pass `gofmt` (or `goimports`), `go vet ./...` and the configured linter (`golangci-lint run` or `staticcheck ./...`).
- Run `go test -race ./...` for anything touching concurrency. Run `go mod tidy` after dependency changes and `govulncheck ./...` when available.
- Respect the `go` directive in `go.mod`; do not use features from newer releases.

## Errors

- Return errors; do not panic for expected failures. `panic` only for programmer errors at init time.
- Wrap with context using `%w`: `fmt.Errorf("load config %s: %w", path, err)`. Compare with `errors.Is` / `errors.As`, never by string.
- Handle each error once: either return it or log it, not both.
- Never discard errors with `_` unless the reason is commented. Check `Close()` errors on files you wrote.
- Sentinel errors are `var ErrNotFound = errors.New("not found")`; custom error types implement `Error()` and, if wrapping, `Unwrap()`.

## Context and concurrency

- `ctx context.Context` is the first parameter of any function that does I/O or may block. Never store a context in a struct; never pass `nil`, use `context.TODO()`.
- Respect cancellation: `select` on `ctx.Done()` in loops and pass `ctx` down to every call that accepts it.
- Every goroutine has an owner and a guaranteed exit. Prefer `errgroup.Group` with `SetLimit` for bounded fan-out. No fire-and-forget goroutines in request handlers.
- The sender closes a channel, never the receiver. Protect shared state with a mutex or confine it to one goroutine; do not copy structs containing a `sync.Mutex`.
- Set timeouts on `http.Client` and `http.Server` (`ReadHeaderTimeout` at minimum). Never use `http.DefaultClient` for outbound calls in services.

## Design

- Accept interfaces, return concrete types. Define small interfaces in the consuming package, not next to the implementation.
- Package names are short, lowercase and specific; no `util`, `common` or `helpers`. Avoid stutter (`config.Config` is fine, `config.ConfigLoader` is not).
- No mutable package-level state or work in `init()` beyond registration. Pass dependencies explicitly.
- Use generics only when they remove real duplication; prefer concrete types otherwise.
- Make the zero value useful where practical. Use functional options or a config struct for constructors with many optional parameters.
- Use `log/slog` for structured logging with key-value pairs; no `fmt.Println` in services.

## Tests

- Table-driven tests with `t.Run(tc.name, ...)`, `t.Helper()` in helpers, `t.TempDir()` for files and `t.Cleanup` for teardown.
- Use `t.Parallel()` only when tests share no mutable state.
- Compare structs with `cmp.Diff` (go-cmp) or `reflect.DeepEqual` and print a readable diff on failure.
- Use `httptest.Server` and interfaces for fakes; no real network in unit tests.
- Run one test with `go test ./pkg/x -run '^TestName$' -v`.
