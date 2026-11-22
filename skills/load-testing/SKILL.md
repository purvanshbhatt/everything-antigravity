---
name: load-testing
description: >-
  Plans, runs and analyses load tests with k6 or Locust: workload models from
  production traffic, open versus closed models, smoke, load, stress, spike and
  soak profiles, thresholds on latency percentiles and error rate, finding the
  saturation point, and CI performance gates. Use when asked "how much traffic
  can this handle", before a launch or sale event, after a performance fix, or
  when adding performance regression checks to CI.
---

# Load Testing

Answer a capacity question with numbers: at what request rate does latency or
error rate break the SLO, and which resource saturates first. Tests run against
staging or an isolated environment. Targeting production, shared environments
or third-party APIs needs the user's explicit, written approval first.

## When to use

- Capacity planning before a launch, campaign or seasonal peak.
- Verifying that a performance fix or a new instance size actually helps.
- Finding the first bottleneck: database connections, CPU, a lock, a downstream rate limit.
- Adding a performance regression gate to CI.

## When not to use

- A single slow function or endpoint: use `profiling` first; load tests show symptoms, profilers show causes.
- Frontend page speed and Core Web Vitals: use `web-performance`.
- Resilience to failures under load: use `chaos-engineering` (often together with this skill).
- End-to-end measure-fix-prove of a performance problem: use `/perf-audit`, which calls this skill.

## Workflow

1. **State the question and the pass criteria.** Example: "Checkout sustains 300 req/s for 30 minutes with p95 under 300 ms and errors under 0.5 percent." Take the numbers from the SLO and the expected peak (historical peak times a growth margin).

   **Check:** The target rate, duration and thresholds are written down before any test runs.

2. **Build the workload model from production.** Pull the endpoint mix, peak requests per second, payload sizes and think time from logs or traces. Use realistic data cardinality (many users, many IDs), not one cached record.

   **Check:** The script's endpoint ratios match production within a few percent, and test data does not all hit the same keys.

3. **Choose the model and profile.** Use an open model (arrival rate) when users arrive independently of response time, which is true for most public APIs. A closed model (fixed users) under-reports latency once the system slows, because users wait instead of piling up.

   | Profile | Shape | Answers |
   | :--- | :--- | :--- |
   | Smoke | 1-5 req/s, 1 min | Does the script work? |
   | Load | Ramp to expected peak, hold 15-30 min | Do we meet the SLO at peak? |
   | Stress / breakpoint | Keep ramping until thresholds fail | Where is the knee and what breaks first? |
   | Spike | Jump to several times peak in seconds | Does autoscaling and queueing cope? |
   | Soak | Peak or below for hours | Leaks, connection exhaustion, disk growth |

   **Check:** The chosen profile matches the question from step 1.

4. **Prepare the environment and get consent.** Confirm the target URL with the user, the environment is production-like (same instance sizes, data volume, autoscaling limits), downstream third parties are stubbed or in sandbox mode, and owners of shared dependencies are told. Ask the user to approve the target and the time window.

   **Check:** The user approved the target and window, and dashboards for the service and its dependencies are open.

5. **Run a smoke test, then the real test.**

   ```bash
   k6 run -e BASE_URL=https://staging.example.com --summary-export=summary.json load.js
   locust -f locustfile.py --headless -u 200 -r 20 -t 15m --host https://staging.example.com --csv results
   ```

   Without a local install, run k6 in Docker: `docker run --rm -i grafana/k6 run - <load.js` (PowerShell: `Get-Content load.js | docker run --rm -i grafana/k6 run -`). Watch the load generator's own CPU and network; above about 80 percent CPU it becomes the bottleneck.

   **Check:** The smoke test passes with zero script errors before the full run starts.

6. **Analyse.** Plot throughput against p95 and p99 latency, and find the knee where latency climbs while throughput flattens. Correlate that moment with server metrics: CPU, memory, connection pool waits, database locks, queue depth, autoscaler events, downstream 429s. Exclude the warm-up period.

   **Check:** The report names the saturation point (req/s) and the resource that saturated first, with a graph or metric as evidence.

7. **Fix, re-run, compare.** Change one thing, re-run the same script and profile, and compare against the saved baseline.

   **Check:** The new result beats the baseline beyond run-to-run noise (repeat runs differ by less than about 5-10 percent).

8. **Gate in CI.** Run a short smoke-load test with thresholds on every merge to main against an ephemeral environment, and the full load test nightly or before releases. k6 exits non-zero when a threshold fails, which fails the job.

   **Check:** A deliberately slowed endpoint makes the CI gate fail.

## Patterns

### k6 open-model script with thresholds

```js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    checkout: {
      executor: 'ramping-arrival-rate',
      startRate: 10, timeUnit: '1s',
      preAllocatedVUs: 50, maxVUs: 500,
      stages: [
        { target: 300, duration: '5m' },   // ramp to 300 req/s
        { target: 300, duration: '30m' },  // hold at peak
        { target: 0, duration: '1m' },
      ],
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.005', abortOnFail: true }],
    http_req_duration: ['p(95)<300', 'p(99)<800'],
  },
};

const BASE = __ENV.BASE_URL;
const ids = Array.from({ length: 5000 }, (_, i) => i + 1);

export default function () {
  const id = ids[Math.floor(Math.random() * ids.length)];
  const res = http.get(`${BASE}/api/products/${id}`, { tags: { name: 'get-product' } });
  check(res, { 'status 200': (r) => r.status === 200 });
}
```

Tag requests with a stable `name` so URLs with IDs aggregate into one metric.

### Locust (Python, closed model)

```python
from locust import HttpUser, task, between

class Shopper(HttpUser):
    wait_time = between(1, 3)

    @task(5)
    def browse(self):
        self.client.get("/api/products?page=1", name="list-products")

    @task(1)
    def add_to_cart(self):
        self.client.post("/api/cart", json={"sku": "A1", "qty": 1}, name="add-to-cart")
```

For more load than one machine produces, run Locust distributed (`--master` and `--worker`) or several k6 instances, and sum the results.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Load test production on a whim | Staging or isolated env; production only with written approval and a window | Real users and shared dependencies get hurt |
| Report average latency | Report p95 and p99 plus error rate | Averages hide the tail users complain about |
| Closed model for a public API | Arrival-rate executor | Closed models hide queueing (coordinated omission) |
| Hit one cached record | Realistic data spread | Cache hits make the system look far faster |
| Call real payment or email providers | Sandboxes or stubs | Costs, rate limits and bans |
| Change several things between runs | One change per run against a saved baseline | You cannot tell which change mattered |

## Verification checklist

- [ ] Question, target rate, duration and thresholds were written before testing.
- [ ] Workload mix and data come from production patterns.
- [ ] The user approved the target environment and time window.
- [ ] Load generator was not saturated.
- [ ] Report names the saturation point and the first saturated resource with evidence.
- [ ] Results are saved as the new baseline; CI gate fails on regression.

## Related

- Agents: `performance-optimizer`, `sre-engineer`.
- Workflows: `/perf-audit`, `/verify`.
- Knowledge: `profiling`, `web-performance`, `chaos-engineering`, `observability-otel`, `ci-cd-github-actions`, `api-testing`.
