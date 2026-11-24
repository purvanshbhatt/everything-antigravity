---
name: post-deploy-canary
disable-model-invocation: true
description: >-
  Watches a fresh deploy for a fixed window: records a pre-deploy baseline,
  then polls key pages and endpoints for status codes, error rates, latency,
  console errors and web vitals, compares each cycle with the baseline using
  explicit thresholds, gathers evidence such as screenshots and failing
  requests, and recommends continue or roll back without acting alone. Invoke
  with /post-deploy-canary.
---

# Post-Deploy Canary

Most bad deploys announce themselves in the first half hour, but only to someone who is looking. This workflow is that someone: a time-boxed, read-only watch that compares the new version with a baseline taken before it, applies thresholds agreed in advance, and hands the user a clear recommendation with evidence.

**Read-only rule.** The watch only reads: `GET` and `HEAD` requests, page loads, log and metric queries. It never submits forms, creates data, logs in as a real user or generates load. **Rollback rule.** The agent recommends a rollback with the exact command; it runs it only after the user's explicit yes.

## When to use

- A release just went out (or is about to) and the user says "watch the deploy", "keep an eye on prod" or "is the release healthy?"
- A progressive rollout needs a go or no-go decision at each stage.
- A risky change (migration, dependency bump, config change) shipped and needs a closer look than dashboards give.
- After a rollback, to confirm the previous version is healthy again.

## When not to use

- Something is already down with user impact: run `incident-response` and the `incident-commander` agent.
- Preparing, versioning and tagging the release: `/release-management`.
- Adding the metrics, traces and alerts the watch depends on: `observability-otel`.
- A deep performance investigation: `/perf-audit` or `web-performance`.
- Load or capacity testing: `load-testing`, never against production without a plan.

## Workflow

1. **Agree the watch plan.** Write it as an artifact (template in Patterns): environment and base URL, the version being deployed, five to ten critical checks (health endpoint, home page, sign-in page, key API reads), the metric and log sources, the window (15 to 60 minutes) and interval (30 to 120 seconds), the thresholds, who decides on rollback, and the rollback command written out but not run.

   **Check:** The user approved the plan, and every check is a read-only request.

2. **Record the baseline before the deploy.** For each check, take several samples of status, latency and a content marker (a string that must appear in the response). Pull the error rate and the top error messages from logs or metrics over the last 30 to 60 minutes. For two or three key pages, run a lab performance pass. If the deploy already happened, use the previous version's numbers from the same time window yesterday, and say so.

   ```bash
   curl -s -o /dev/null -H "Cache-Control: no-cache" -w "%{http_code} %{time_total}\n" --max-time 10 https://www.example.com/healthz
   gcloud logging read 'resource.type="cloud_run_revision" AND severity>=ERROR' --freshness=30m --limit=200 --format=json > baseline-errors.json
   npx lighthouse https://www.example.com/ --only-categories=performance --output=json --output-path=baseline-home.json --chrome-flags="--headless"
   ```

   On Windows, call `curl.exe` explicitly, because `curl` is an alias for `Invoke-WebRequest` in Windows PowerShell.

   **Check:** A baseline file exists with timestamps, samples per check, an error rate, and the top error signatures.

3. **Confirm the new version is live.** Check a version endpoint or header, the platform's revision list (`gcloud run revisions list --service <svc> --region <region>`) or the rollout status (`kubectl rollout status deployment/<name> -n <ns>`). Send `Cache-Control: no-cache` so a CDN does not answer for the old version.

   **Check:** The checks are hitting the new version, proven by a version string or revision id.

4. **Run the watch loop.** Each cycle: run every check and record status, latency and whether the marker is present; query the error count and new error signatures since the previous cycle. Every few cycles, have the browser agent load the key pages, take a screenshot, and record console errors and failed network requests. Append one line per check per cycle to `canary.jsonl`. Stop at the end of the window. The loop scripts in Patterns can run as a background command, or run one cycle per step.

   **Check:** The number of recorded cycles matches window divided by interval, with no gaps.

5. **Evaluate every cycle against the thresholds** in Patterns. Use the consecutive-cycle rules so one slow request does not trigger a rollback, but treat hard failures as immediate.

   **Check:** Each verdict cites the samples and the threshold that produced it.

6. **Escalate as soon as a hard threshold trips.** Do not wait for the window to end. Show the user the evidence (failing requests, error signatures with counts, screenshots, the version in use) and the rollback command, and ask for a decision. Run the rollback only on an explicit yes, then repeat steps 3 to 5 against the restored version.

   **Check:** No rollback, flag change or traffic shift happened without the user's yes.

7. **Report.** Give a verdict of CONTINUE, HOLD (extend the watch, with the reason) or ROLL BACK, then the evidence table, new error signatures, screenshots, and follow-ups (a ticket for a new warning, a missing alert for something only the watch caught).

   **Check:** The user has the verdict, and every claim in the report points to a recorded sample.

## Patterns

### Watch plan

```markdown
# Canary plan: <service> <version> -> <environment>
- Window: 30 min, interval 60 s, started after the deploy finished
- Checks (read-only): GET /healthz (200, "ok"); GET / (200, "<title>Shop"); GET /api/products?limit=1 (200, "items")
- Signals: error logs for the service; p95 latency from the load balancer; console errors on / and /checkout
- Thresholds: see table; hard failures escalate immediately
- Decision owner: <name>
- Rollback (do not run without a yes): <exact command>
```

### Thresholds

| Signal | Regression | Hard failure (escalate now) |
| :--- | :--- | :--- |
| Health or critical check | Marker missing in 2 consecutive cycles | Any non-2xx on the health check, or 2 consecutive 5xx on any check |
| Error rate | Above twice the baseline, or the baseline plus 0.5 percentage points, for 2 cycles | Above 5 percent of requests in any cycle |
| New error signature | Any new message seen 5 or more times | A new crash, panic or unhandled-exception signature on a critical path |
| p95 latency | Above 1.5 times the baseline for 3 cycles | Above 3 times the baseline for 2 cycles |
| Console errors | A new error on a key page | A script error that blocks rendering or a key action |
| Lab LCP or CLS | Worse than the baseline by more than 20 percent | Page fails to render its main content |

Agree these numbers with the user in step 1; the values above are starting points, not standards.

### Loop: bash

```bash
end=$(( $(date +%s) + 30*60 ))
while [ "$(date +%s)" -lt "$end" ]; do
  while read -r url; do
    printf '{"t":"%s","url":"%s",' "$(date -u +%FT%TZ)" "$url"
    curl -s -o /dev/null -H "Cache-Control: no-cache" --max-time 10 -w '"code":"%{http_code}","secs":%{time_total}}\n' "$url"
  done < canary-urls.txt >> canary.jsonl
  sleep 60
done
```

### Loop: PowerShell

```powershell
$end = (Get-Date).AddMinutes(30)
while ((Get-Date) -lt $end) {
  foreach ($url in Get-Content canary-urls.txt) {
    $r = curl.exe -s -o NUL -H "Cache-Control: no-cache" --max-time 10 -w "%{http_code} %{time_total}" $url
    $code, $secs = $r -split ' '
    @{ t = (Get-Date).ToUniversalTime().ToString('o'); url = $url; code = [int]$code; secs = [double]$secs } |
      ConvertTo-Json -Compress | Add-Content canary.jsonl
  }
  Start-Sleep -Seconds 60
}
```

These loops record status and latency only. Marker checks, logs and browser passes run alongside them in the agent's cycle.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Watch without a baseline | Record one before the deploy, or use yesterday's same window | Without it, every number looks alarming or fine |
| Roll back on one slow request | Use consecutive-cycle rules; escalate early only on hard failures | Noise causes needless rollbacks |
| Roll back automatically | Recommend with evidence and the exact command; wait for a yes | Rollbacks have their own risks, such as data written by the new version |
| Exercise write paths in production | Read-only checks; use a staging environment for writes | The watch must never create real orders or emails |
| Watch until it "feels fine" | Time-box the window and report a verdict | Open-ended watching ends without a decision |
| Trust a cached response | Send `Cache-Control: no-cache` and verify the version | A CDN can serve the old version and hide the problem |

## Verification checklist

- [ ] The watch plan, thresholds and rollback owner were agreed before the deploy.
- [ ] A baseline existed before evaluation started.
- [ ] The checks were proven to hit the new version.
- [ ] Every request was read-only, and the window was time-boxed.
- [ ] Each verdict cites samples and a threshold; hard failures were escalated at once.
- [ ] No rollback or traffic change ran without the user's explicit yes.
- [ ] The report gives CONTINUE, HOLD or ROLL BACK with evidence.

## Related

- Workflows: `/release-management`, `/perf-audit`, `/e2e`, `/ci-failure-triage`, `/postmortem`.
- Knowledge: `observability-otel`, `web-performance`, `browser-automation`, `incident-response`, `feature-flags`, `runbooks-oncall`, `cloud-run`, `kubernetes-gke`, `load-testing`.
- Agents: `sre-engineer`, `incident-commander`.
