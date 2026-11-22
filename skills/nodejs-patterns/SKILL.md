---
name: nodejs-patterns
description: >-
  Applies Node.js runtime patterns: keeping the event loop free, streams with
  pipeline and backpressure, worker threads for CPU work, ESM and CommonJS
  interop, AbortSignal timeouts, unhandled rejections, graceful shutdown, env
  config, and diagnostics (--inspect, CPU and heap profiles, reports). Use when
  building or debugging a Node service, worker, CLI or script, or when a Node
  process hangs, leaks, blocks or will not shut down.
---

# Node.js Patterns

Node is one thread running an event loop. Anything that holds that thread
(sync I/O, big JSON, regex backtracking, crypto in a loop) stalls every request.
Keep the loop free, propagate cancellation, and make the process exit cleanly.

## When to use

- Writing a Node HTTP service, queue worker, CLI or build script.
- Latency spikes, timeouts under load, or a process stuck at 100% CPU.
- `ERR_REQUIRE_ESM`, `ERR_MODULE_NOT_FOUND` or "Cannot use import statement outside a module".
- Containers that take 10+ seconds to stop, or lose in-flight work on deploy.
- Memory growing until the process is OOM-killed.

## When not to use

- Type design: use `typescript-patterns`. Choosing Bun or Deno: use `bun-deno`.
- Framework-level API design: use `api-design` and `backend-patterns`.
- Deep profiling methodology: use `profiling` and `memory-leaks`.
- Container packaging: use `/dockerize` or `docker-containers`.

## Workflow

1. **Pin the runtime and module system.** Read `node --version`, the `engines` field, `.nvmrc` or `.node-version`, and the `package.json` `"type"` (`"module"` means `.js` is ESM). Use an even-numbered LTS line for production.

   **Check:** CI, the Dockerfile base image and local dev use the same major version.

2. **Find and remove event-loop blockers.** Measure loop delay (pattern below). Replace `readFileSync`/`execSync` on request paths, move CPU-heavy work (hashing, image processing, large parsing) to `worker_threads` via a pool such as Piscina, and stream large payloads instead of buffering.

   **Check:** p99 event-loop delay stays under ~50 ms at target load.

3. **Use `pipeline`, not `.pipe()`.** `stream/promises` `pipeline` propagates errors, destroys every stream on failure and respects backpressure. Async generators work as transform stages.

   **Check:** Killing the source mid-transfer rejects the `pipeline` promise and leaves no open file handles.

4. **Bound every outbound call.** Pass `signal: AbortSignal.timeout(ms)` to `fetch` and other APIs; combine a request signal and a timeout with `AbortSignal.any([a, b])` (Node 20.3+). Cap concurrency for fan-out (`p-limit` or a worker pool).

   **Check:** `grep_search` for `fetch(` and client constructors in changed files; each has a timeout.

5. **Fail loudly on unhandled errors.** Since Node 15 an unhandled rejection crashes the process; keep that default. Add `process.on('uncaughtException')` only to log and exit, never to continue. Always `await` or return promises; enable `@typescript-eslint/no-floating-promises`.

   **Check:** A deliberately rejected promise in a test exits non-zero with a stack trace.

6. **Shut down gracefully.** On `SIGTERM` and `SIGINT`: stop accepting connections, finish in-flight work with a deadline, close pools, then exit. On Windows the OS does not raise `SIGTERM`; `Ctrl+C` raises `SIGINT`.

   **Check:** Sending `SIGTERM` during a slow request lets it finish and exits 0 before the platform's kill timeout (10 s on Cloud Run).

7. **Load and validate config once at startup.** Use `node --env-file=.env` (Node 20.6+) or `process.loadEnvFile()` in development, real environment variables or a secret manager in production, and validate with a schema; fail fast on missing values.

   **Check:** Starting with a required variable unset exits immediately with a clear message.

## Patterns

### ESM and CommonJS interop

| Situation | What works |
| :--- | :--- |
| ESM imports CJS | `import pkg from 'cjs-pkg'` gives `module.exports`; named imports only if Node can detect them statically |
| CJS needs ESM | `const m = await import('esm-pkg')`; recent releases also allow `require()` of synchronous ESM graphs (no top-level await): verify against the Node docs for your version |
| `__dirname` in ESM | `import.meta.dirname` and `import.meta.filename` (Node 20.11+), or `fileURLToPath(new URL('.', import.meta.url))` |
| Relative imports in ESM | Full file extension required: `./util.js`, even when the source is `.ts` compiled by `tsc` |
| Package for both | `exports` with `import` and `require` conditions, or ship ESM only and document it |
| JSON in ESM | `import data from './x.json' with { type: 'json' }` (check support for your Node version) or `fs.readFile` plus `JSON.parse` |

### Measuring event-loop delay

```js
import { monitorEventLoopDelay } from 'node:perf_hooks';

const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();
setInterval(() => {
  console.log(JSON.stringify({ loopDelayP99Ms: h.percentile(99) / 1e6 })); // values are nanoseconds
  h.reset();
}, 10_000).unref();
```

### Streaming with cancellation

```js
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';

await pipeline(
  createReadStream('events.ndjson'),
  async function* (source) {               // transform stage as an async generator
    for await (const chunk of source) yield chunk.toString().toUpperCase();
  },
  createGzip(),
  createWriteStream('events.ndjson.gz'),
  { signal: AbortSignal.timeout(60_000) },
);
```

### Graceful shutdown

```js
import http from 'node:http';

const server = http.createServer(handler);
server.listen(Number(process.env.PORT ?? 8080));

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(JSON.stringify({ msg: 'shutting down', signal }));
  const force = setTimeout(() => process.exit(1), 9_000);
  force.unref();
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));   // waits for in-flight requests
    server.closeIdleConnections();                              // drop idle keep-alive sockets
  });
  await db.end();                                               // close pools, flush telemetry
  clearTimeout(force);
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
```

### Diagnostics

| Symptom | Command |
| :--- | :--- |
| Need a debugger | `node --inspect src/server.js`, then open `chrome://inspect` |
| High CPU | `node --cpu-prof src/server.js` writes a `.cpuprofile` on exit; open it in DevTools |
| Memory growth | `node --heapsnapshot-signal=SIGUSR2 ...` then `kill -USR2 <pid>` (Linux/macOS), or take snapshots from DevTools; compare two snapshots |
| Crash with no context | `node --report-on-fatalerror --report-uncaught-exception ...` writes a diagnostic report |
| Mystery warnings | `node --trace-warnings` |
| Dev loop | `node --watch src/server.js`; built-in runner `node --test` |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `fs.*Sync` or `execSync` on request paths | Async APIs or a worker | Blocks every concurrent request |
| `a.pipe(b)` with no error handling | `pipeline()` from `stream/promises` | Errors leak file descriptors and crash later |
| Fire-and-forget promises | `await`, or collect and `Promise.allSettled` | Rejections crash the process or vanish |
| `process.exit()` right after logging | Set `process.exitCode` or finish async cleanup first | Logs and telemetry may not flush |
| A new `Worker` per request | A fixed worker pool | Worker start-up costs tens of milliseconds and memory |
| Unbounded in-memory caches or arrays | LRU with a size cap, or an external cache | Classic slow leak until OOM |
| `JSON.parse` of multi-MB bodies on the main thread | Stream-parse, cap body size, or offload | Parsing blocks the loop for the whole duration |

## Verification checklist

- [ ] Node major version is pinned and identical in CI, container and local dev.
- [ ] No sync I/O or CPU-heavy work on request paths; loop delay p99 is measured.
- [ ] Streams use `pipeline`; outbound calls have timeouts and bounded concurrency.
- [ ] Unhandled rejections crash with a stack trace; no floating promises.
- [ ] `SIGTERM` drains in-flight work and exits 0 within the platform deadline.
- [ ] Config is validated at start-up and secrets are not read from committed files.

## Related

- Knowledge: `typescript-patterns`, `bun-deno`, `backend-patterns`, `profiling`, `memory-leaks`, `observability-otel`, `cloud-run`, `docker-containers`, `cli-development`.
- Workflows: `/perf-audit`, `/root-cause`, `/dockerize`, `/verify`.
- Agents: `typescript-reviewer`, `performance-optimizer`, `backend-engineer`.
