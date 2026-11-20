# Go concurrency and testing patterns

Version notes below refer to the `go` line in `go.mod`; check the release
notes for your toolchain before relying on them.

## Bounded fan-out with errgroup

```go
func fetchAll(ctx context.Context, ids []int64) ([]Item, error) {
	g, ctx := errgroup.WithContext(ctx) // ctx is cancelled when any goroutine fails
	g.SetLimit(8)                       // at most 8 in flight
	out := make([]Item, len(ids))
	for i, id := range ids {
		g.Go(func() error {
			it, err := fetch(ctx, id)
			if err != nil {
				return fmt.Errorf("fetch %d: %w", id, err)
			}
			out[i] = it // each goroutine writes its own index, so no lock is needed
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return nil, err
	}
	return out, nil
}
```

## Worker pool over a channel

```go
func process(ctx context.Context, jobs <-chan Job, workers int) error {
	g, ctx := errgroup.WithContext(ctx)
	for range workers { // range over int: Go 1.22+
		g.Go(func() error {
			for {
				select {
				case <-ctx.Done():
					return ctx.Err()
				case j, ok := <-jobs:
					if !ok {
						return nil // producer closed the channel
					}
					if err := handle(ctx, j); err != nil {
						return fmt.Errorf("job %s: %w", j.ID, err)
					}
				}
			}
		})
	}
	return g.Wait()
}
```

The producer owns the channel and is the only one that closes it.

## Leak-proof timeout around a blocking call

```go
func callWithTimeout(ctx context.Context) (Result, error) {
	ch := make(chan Result, 1) // buffered: the goroutine can always send and exit
	go func() { ch <- slowCall() }()
	select {
	case r := <-ch:
		return r, nil
	case <-ctx.Done():
		return Result{}, ctx.Err()
	}
}
```

With an unbuffered channel, the goroutine blocks forever after a timeout.
Better still, make `slowCall` accept a context.

## Leak checklist

| Leak | Fix |
| :--- | :--- |
| Send on a channel nobody will read | Buffer it, or `select` with `ctx.Done()` |
| Receive from a channel nobody will close | Close it from the single owner, or `select` with `ctx.Done()` |
| `for { ... }` worker without a stop condition | Exit on `ctx.Done()` or a closed input channel |
| HTTP response body not closed | `defer resp.Body.Close()` after checking the error |
| `time.After` in a hot loop | `time.NewTimer` plus `Stop` on older Go versions; Go 1.23 made unreferenced timers collectable |
| Ticker never stopped | `defer ticker.Stop()` |

Detect leaks in tests with `go.uber.org/goleak`:

```go
func TestMain(m *testing.M) { goleak.VerifyTestMain(m) }
```

## Synchronisation choices

| Need | Use |
| :--- | :--- |
| Protect a shared map or struct | `sync.Mutex` or `sync.RWMutex`, held for the shortest time |
| A counter or flag | `atomic.Int64`, `atomic.Bool` |
| Lazy one-time initialisation | `sync.OnceValue` / `sync.OnceValues` (Go 1.21+) |
| Wait for a set of goroutines without errors | `sync.WaitGroup`; Go 1.25 adds `wg.Go(func())` |
| Wait with errors and cancellation | `errgroup` |
| Rate limit outgoing calls | `golang.org/x/time/rate` |

## Testing commands

```bash
go test ./...                                  # all packages
go test -run 'TestParseAmount/negative' -v ./internal/money
go test -race -count=1 -shuffle=on ./...       # no cache, random order
go test -coverprofile=cover.out ./... && go tool cover -html=cover.out
go test -fuzz=FuzzParseAmount -fuzztime=30s ./internal/money   # one package at a time
go test -tags=integration ./...                # files with //go:build integration
```

- `t.Context()` (Go 1.24+) returns a context cancelled when the test ends.
- `t.Cleanup`, `t.TempDir` and `t.Setenv` replace manual teardown.
- For time-dependent concurrent code, look at `testing/synctest` (stable in recent Go releases; check your version's docs).
- Use testcontainers-go or a Compose file for real Postgres in integration tests; keep them behind a build tag.

## Fuzz test

```go
func FuzzParseAmount(f *testing.F) {
	for _, s := range []string{"0", "12.34", "-1", "", "9999999999999"} {
		f.Add(s)
	}
	f.Fuzz(func(t *testing.T, s string) {
		v, err := ParseAmount(s)
		if err != nil {
			return // invalid input is fine; panics and wrong round trips are not
		}
		got, err := ParseAmount(FormatAmount(v))
		if err != nil || got != v {
			t.Fatalf("round trip of %q: got %d, %v; want %d", s, got, err, v)
		}
	})
}
```

Failing inputs are saved under `testdata/fuzz/FuzzParseAmount/`; commit them so
they run as regression cases in every `go test`.

## golangci-lint

```yaml
# .golangci.yml (v2 format)
version: "2"
linters:
  default: standard
  enable:
    - bodyclose
    - errorlint
    - gosec
    - noctx
    - rowserrcheck
    - sqlclosecheck
formatters:
  enable:
    - gofmt
    - goimports
```

v2 changed the config format; `golangci-lint migrate` converts a v1 file.
Check the golangci-lint docs for the linter names available in your version.
