# Go HTTP service skeleton

A minimal, production-shaped `main` package: testable `run`, structured
logging, server timeouts and graceful shutdown. Adapt names to the project.

## cmd/api/main.go

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"golang.org/x/sync/errgroup"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := run(ctx, os.Getenv, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, getenv func(string) string, stdout io.Writer) error {
	logger := slog.New(slog.NewJSONHandler(stdout, nil))

	cfg, err := loadConfig(getenv)
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	db, err := openDB(ctx, cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}
	defer db.Close() // runs after the server has drained

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           newRouter(logger, db),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		ErrorLog:          slog.NewLogLogger(logger.Handler(), slog.LevelError),
	}

	g, gctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		logger.Info("listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			return fmt.Errorf("listen: %w", err)
		}
		return nil
	})
	g.Go(func() error {
		<-gctx.Done() // signal received, or the listener failed
		logger.Info("shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		return srv.Shutdown(shutdownCtx) // stops accepting, waits for in-flight requests
	})
	return g.Wait()
}
```

Notes:

- Don't set `http.Server.BaseContext` to the signal context: every in-flight request would be cancelled the moment SIGTERM arrives, which defeats draining.
- Keep the shutdown timeout below the orchestrator's grace period (Kubernetes defaults to 30 s).
- Behind a load balancer, fail the readiness probe first (for example an `atomic.Bool` checked by `/readyz`), wait a few seconds for endpoints to update, then call `Shutdown`.
- Long-lived connections (WebSockets, SSE) are not tracked by `Shutdown`; close them yourself via `srv.RegisterOnShutdown`.

## Router and middleware

```go
func newRouter(log *slog.Logger, db *pgxpool.Pool) http.Handler {
	h := &Handler{log: log, users: store.NewUsers(db)}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	mux.HandleFunc("GET /v1/users/{id}", h.getUser)
	mux.HandleFunc("POST /v1/users", h.createUser)

	return recoverer(log, requestLogger(log, mux))
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

func requestLogger(log *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		log.InfoContext(r.Context(), "request",
			"method", r.Method, "path", r.URL.Path, "status", rec.status,
			"duration_ms", time.Since(start).Milliseconds())
	})
}

func recoverer(log *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				if v == http.ErrAbortHandler {
					panic(v) // let net/http abort the response as intended
				}
				log.ErrorContext(r.Context(), "panic", "value", v)
				http.Error(w, "internal error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v) // the client may have gone away; nothing useful to do
}
```

A `statusRecorder` wrapper hides optional interfaces such as `http.Flusher`.
If handlers stream, add an `Unwrap() http.ResponseWriter` method so
`http.NewResponseController` can reach the underlying writer.

## Database pool (pgx v5)

```go
func openDB(ctx context.Context, url string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping: %w", err)
	}
	return pool, nil
}
```

## Handler test with httptest

```go
func TestGetUser_NotFound(t *testing.T) {
	h := &Handler{
		log:   slog.New(slog.NewTextHandler(io.Discard, nil)),
		users: fakeUsers{err: store.ErrNotFound},
	}
	req := httptest.NewRequest(http.MethodGet, "/v1/users/42", nil)
	req.SetPathValue("id", "42") // or route through a real ServeMux
	rec := httptest.NewRecorder()

	h.getUser(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}
```

Use `httptest.NewServer(handler)` when you need a real network round trip, for
example to test a client with timeouts.

## Build

```bash
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o bin/api ./cmd/api
GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -trimpath -o bin/api-linux-arm64 ./cmd/api
```

```powershell
$env:CGO_ENABLED = "0"; go build -trimpath -ldflags="-s -w" -o bin/api.exe ./cmd/api
$env:GOOS = "linux"; $env:GOARCH = "arm64"; go build -trimpath -o bin/api-linux-arm64 ./cmd/api
```

A static binary runs on a distroless or scratch base image; add CA
certificates and time zone data if the service needs TLS or `time.LoadLocation`.
