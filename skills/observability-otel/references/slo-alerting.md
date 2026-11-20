# SLOs and Alerting

Companion to the `observability-otel` skill. An SLO is a promise about user
experience with an explicit tolerance for failure; alerts exist to protect that
promise, not to report every anomaly.

## Choosing SLIs

| SLI type | Good event | Valid event | Typical source |
| :--- | :--- | :--- | :--- |
| Availability | Response not 5xx (and not a timeout) | All requests except health checks; decide explicitly whether 429s count | Load balancer or server request metrics |
| Latency | Response faster than the threshold (for example 300 ms) | Same as availability | `http.server.request.duration` histogram |
| Freshness | Data updated within N minutes | Each scheduled check | Pipeline completion timestamps |
| Correctness | Output passes validation | Each processed item | Application counters |

Measure as close to the user as possible: load balancer metrics beat
in-process metrics, which miss requests the process never received.

## Error budgets (30-day window)

| SLO | Error budget | Allowed full downtime per 30 days |
| :--- | :--- | :--- |
| 99% | 1% | 7.2 hours |
| 99.5% | 0.5% | 3.6 hours |
| 99.9% | 0.1% | 43.2 minutes |
| 99.95% | 0.05% | 21.6 minutes |
| 99.99% | 0.01% | 4.32 minutes |

Pick the lowest target users will accept. Every extra nine roughly multiplies
engineering cost and halves the room for deploys and experiments.

## Burn-rate math

- **Burn rate** = observed error ratio / (1 - SLO). A burn rate of 1 spends the
  whole budget exactly at the end of the window.
- **Budget consumed** = burn rate x alert window / SLO window. For example,
  14.4 x 1 h / 720 h = 2%.

| Severity | Long window | Short window | Burn rate | Budget spent |
| :--- | :--- | :--- | :--- | :--- |
| Page | 1 h | 5 min | 14.4 | 2% |
| Page | 6 h | 30 min | 6 | 5% |
| Ticket | 3 days | 6 h | 1 | 10% |

Alert only when both the long and the short window exceed the burn rate. The
short window makes the alert reset quickly once the problem stops.

## Google Cloud Monitoring

- Define a service (built in for Cloud Run and GKE, or custom) and attach SLOs
  in the console, API or Terraform (`google_monitoring_custom_service`,
  `google_monitoring_slo`).
- Burn-rate alert policies use the `select_slo_burn_rate` time-series selector
  with a lookback window; create one condition per row of the table above.
  Check the current Cloud Monitoring SLO alerting docs for the exact filter syntax.
- Route pages to an on-call channel and tickets to the team queue. Every policy
  documentation field links to a runbook.

## Symptoms vs causes

| Alert on (symptom) | Dashboard only (cause) |
| :--- | :--- |
| SLO burn rate for availability and latency | CPU, memory, disk utilization |
| Synthetic check of a critical journey failing | Pod restarts, GC pauses |
| Queue age exceeding the freshness SLO | Queue depth, consumer lag |
| Certificate expiring within 14 days (no user impact yet, but guaranteed) | Connection pool saturation |

Cause metrics belong on the dashboard the runbook opens first.

## SLO document template

```markdown
# SLO: Checkout availability
- Owner: payments team (on-call rotation: payments-primary)
- Journey: user submits an order and receives confirmation
- SLI: successful POST /checkout responses (not 5xx, < 2 s) / all POST /checkout requests, measured at the load balancer
- Target: 99.9% over a rolling 30 days (budget: 43.2 minutes of full outage)
- Alerts: 14.4x over 1 h and 5 min (page); 6x over 6 h and 30 min (page); 1x over 3 days and 6 h (ticket)
- Error budget policy: when the budget is exhausted, pause non-critical launches and prioritize reliability work until it recovers
- Review: quarterly, or after any incident that consumed more than 20% of the budget
```

## Runbook skeleton

```markdown
# Runbook: Checkout availability burn
1. Open the checkout dashboard; confirm which SLI is burning and since when.
2. Check recent deploys and config changes in that window; roll back first if one lines up (with approval).
3. Open example error traces from the alert window; group by `error.type` and downstream service.
4. Mitigate (rollback, scale, fail over, disable a feature flag), then confirm the burn rate drops.
5. Record the timeline and evidence for the incident review.
```
