---
name: golang-testing
description: >-
  Writes and runs Go tests in depth: table-driven tests and subtests,
  t.Parallel, t.Cleanup and t.TempDir, httptest for handlers and clients,
  golden files, native fuzzing, benchmarks with benchstat, coverage across
  packages, the race detector, goleak, and integration tests with
  testcontainers-go behind build tags. Use when adding or fixing Go tests, or
  when a Go suite is flaky, racy, slow or missing coverage.
---

# Go Testing

The standard `testing` package covers almost everything: tables for cases,
subtests for names, `httptest` for HTTP, fuzzing for parsers and benchmarks
for speed claims. Every suite runs with `-race` in CI, and integration tests
are opt-in so `go test ./...` stays fast.

## When to use

- Adding tests to a Go package, handler, client or CLI.
- Data races, goroutine leaks or tests that fail only in parallel.
- Proving a performance change with benchmarks instead of anecdotes.
- Fuzzing parsers, decoders and anything that takes untrusted input.
- Running tests against a real Postgres, Redis or Pub/Sub emulator.

## When not to use

- Service structure, context and error handling: use `golang-services`.
- Test strategy across a system: use `tdd-testing`. Load tests: use `load-testing`.
- CPU or memory investigations beyond a benchmark: use `profiling`.
- A diff review: delegate to the `go-reviewer` agent.

## Workflow

1. **Get a clean baseline.** Disable the cache and shuffle order so hidden coupling shows up.

   ```bash
   go vet ./...
   go test -count=1 -shuffle=on ./...
   go test -race -count=1 ./...       # needs cgo; on Windows install a gcc toolchain or run in CI/WSL
   ```

   **Check:** Both runs pass, or failures are recorded before you change anything.

2. **Choose the package boundary.** Use `package foo_test` (black-box) by default; use `package foo` only for unexported helpers. Expose test hooks through an `export_test.go` file rather than widening the public API.

   **Check:** Tests use the package the way callers do.

3. **Write table-driven subtests.** One table, one loop, `t.Run(tc.name, ...)`, `t.Parallel()` where safe. Compare structs with `github.com/google/go-cmp/cmp` (`cmp.Diff`) and errors with `errors.Is`. Use `t.Helper()` in assertion helpers, `t.Cleanup` for teardown, `t.TempDir()` for files, and `t.Setenv` for env vars (not allowed in parallel tests).

   **Check:** `go test -run 'TestName/case_name' -v ./pkg` runs exactly one case.

4. **Test HTTP with `httptest`.** Route requests through your real mux (so `r.PathValue` works) with `httptest.NewRecorder`, or set path values with `req.SetPathValue` (Go 1.22+) when calling a handler directly. Test outbound clients against `httptest.NewServer`.

   **Check:** Handler tests cover success, validation failure, not found and internal error.

5. **Fuzz untrusted-input code.** Seed with `f.Add`, assert invariants (round-trip, no panic, idempotence). Failing inputs land in `testdata/fuzz/<FuzzName>/`; commit them as regression cases.

   ```bash
   go test -run '^$' -fuzz '^FuzzParseAmount$' -fuzztime 30s ./money
   ```

   **Check:** The fuzzer runs for the full duration without new failures, and the seed corpus runs in normal `go test`.

6. **Benchmark before claiming speed.** Run each side 10 times and compare with `benchstat` (`go install golang.org/x/perf/cmd/benchstat@latest`).

   ```bash
   go test -run '^$' -bench '^BenchmarkParse$' -benchmem -count 10 ./money > old.txt
   # apply the change
   go test -run '^$' -bench '^BenchmarkParse$' -benchmem -count 10 ./money > new.txt
   benchstat old.txt new.txt
   ```

   **Check:** benchstat shows a statistically significant delta (low p-value) before you report a speed-up.

7. **Keep integration tests opt-in.** Put them behind `//go:build integration` and run with `go test -tags integration ./...`, or skip with `if testing.Short() { t.Skip(...) }`. Start dependencies with testcontainers-go and clean them up with `t.Cleanup`.

   **Check:** `go test ./...` passes without Docker; `go test -tags integration ./...` passes with it.

8. **Measure coverage honestly.**

   ```bash
   go test -coverpkg=./... -coverprofile=cover.out ./...
   go tool cover -func=cover.out | tail -n 1      # PowerShell: ... | Select-Object -Last 1
   go tool cover -html=cover.out
   ```

   In PowerShell, quote flags that contain a dot: `go test "-coverprofile=cover.out" ./...`.

   **Check:** New branches in the diff are covered; the total does not drop.

## Patterns

### Table test with go-cmp

```go
func TestNormalizeEmail(t *testing.T) {
    tests := []struct {
        name    string
        in      string
        want    string
        wantErr error
    }{
        {"lowercases", "Ann@Example.COM", "ann@example.com", nil},
        {"trims", "  bob@x.io ", "bob@x.io", nil},
        {"rejects empty", "", "", ErrInvalidEmail},
    }
    for _, tc := range tests {
        t.Run(tc.name, func(t *testing.T) {
            t.Parallel()
            got, err := NormalizeEmail(tc.in)
            if !errors.Is(err, tc.wantErr) {
                t.Fatalf("err = %v, want %v", err, tc.wantErr)
            }
            if diff := cmp.Diff(tc.want, got); diff != "" {
                t.Errorf("mismatch (-want +got):\n%s", diff)
            }
        })
    }
}
```

### Fuzz target and benchmark

```go
func FuzzParseAmount(f *testing.F) {
    for _, s := range []string{"0", "12.34", "-1", "999999.99"} {
        f.Add(s)
    }
    f.Fuzz(func(t *testing.T, s string) {
        v, err := ParseAmount(s)
        if err != nil {
            return // invalid input is fine; panics are not
        }
        back, err := ParseAmount(FormatAmount(v))
        if err != nil || back != v {
            t.Fatalf("round trip %q: %d -> %d (%v)", s, v, back, err)
        }
    })
}

func BenchmarkParseAmount(b *testing.B) {
    for b.Loop() { // Go 1.24+; older: for i := 0; i < b.N; i++
        _, _ = ParseAmount("12345.67")
    }
}
```

### Postgres with testcontainers-go

```go
//go:build integration

func newTestDB(t *testing.T) *pgxpool.Pool {
    t.Helper()
    ctx := t.Context() // Go 1.24+; older: context.Background()
    // Module API: verify against the current testcontainers-go docs.
    ctr, err := postgres.Run(ctx, "postgres:16-alpine",
        postgres.WithDatabase("app"),
        postgres.WithUsername("app"),
        postgres.WithPassword("test-only"),
        postgres.BasicWaitStrategies(),
    )
    testcontainers.CleanupContainer(t, ctr)
    if err != nil {
        t.Fatal(err)
    }
    dsn, err := ctr.ConnectionString(ctx, "sslmode=disable")
    if err != nil {
        t.Fatal(err)
    }
    pool, err := pgxpool.New(ctx, dsn)
    if err != nil {
        t.Fatal(err)
    }
    t.Cleanup(pool.Close)
    runMigrations(t, pool)
    return pool
}
```

### Other tools

| Need | Tool |
| :--- | :--- |
| Goroutine leak check | `go.uber.org/goleak`: `goleak.VerifyTestMain(m)` in `TestMain` |
| Golden files | `testdata/*.golden` plus a `-update` flag defined in the test package |
| Mocks | Small consumer-side interfaces with hand-written fakes; `go.uber.org/mock` (mockgen) for large ones |
| Time-dependent code | Inject a clock; `testing/synctest` for fake time in concurrent code (check its status for your Go version) |
| Coverage of a built binary | `go build -cover`, run with `GOCOVERDIR=<dir>`, then `go tool covdata percent -i=<dir>` |
| Executable docs | `func ExampleFoo()` with an `// Output:` comment |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `time.Sleep` to wait for goroutines | Channels, `sync.WaitGroup`, or poll with a deadline | Sleeps are slow and still flaky |
| Assertion libraries that hide which case failed | `t.Run` names plus `cmp.Diff` output | The failure message is the debugging tool |
| Calling a handler directly and reading `r.PathValue` | Route through the mux or `req.SetPathValue` | Path values are empty otherwise |
| Integration tests in the default run | Build tags or `testing.Short()` | Unit runs need to stay seconds-fast |
| Skipping `-race` because it is slow | Run it in CI on every PR | Races ship silently otherwise |
| Benchmarks run once | `-count 10` plus `benchstat` | Single runs are noise |

## Verification checklist

- [ ] `go vet`, `go test -shuffle=on` and `go test -race` pass with `-count=1`.
- [ ] New logic has table-driven tests covering error paths.
- [ ] HTTP handlers and clients are tested with `httptest`.
- [ ] Parsers of untrusted input have a fuzz target with committed seeds.
- [ ] Performance claims come with benchstat output.
- [ ] Integration tests are tagged and clean up their containers.

## Related

- Knowledge: `golang-services`, `tdd-testing`, `profiling`, `concurrency-bugs`, `contract-testing`, `test-data-management`, `load-testing`.
- Workflows: `/tdd`, `/test-coverage`, `/verify`.
- Agents: `go-reviewer`, `test-engineer`.
