---
name: cloud-run
description: >-
  Operates Cloud Run services and jobs in depth: deploy options, revisions and
  tagged traffic splits, concurrency, CPU allocation and cold starts, probes,
  ingress and invoker auth, Direct VPC egress, mounted secrets, scheduled jobs,
  and a troubleshooting table for common errors. Use when tuning or debugging a
  Cloud Run service, running batch jobs, splitting traffic, or fixing 403, 429,
  503 or failed-to-start errors.
---

# Cloud Run

Run containers on Cloud Run with deliberate settings for concurrency, CPU,
scaling, ingress and identity, roll out through tagged revisions, and debug
from revision logs rather than guesses. First-time project setup lives in
`cloud-devops`; this skill is the deep reference for the service itself.

## When to use

- Tuning latency, cold starts, concurrency, memory or cost of a service.
- Canary releases, blue/green with tags, or rollbacks.
- Batch or scheduled work with Cloud Run jobs.
- Errors such as "failed to start and then listen on the port", 403, 429 or 503.

## When not to use

- New project, Artifact Registry, keyless CI and budgets: use `cloud-devops`.
- Load balancer, custom domain and Cloud Armor in front of the service: use `cloud-networking` and `dns-tls`.
- Event triggers (Pub/Sub push, Eventarc): use `pubsub-eventarc`.
- Kubernetes-level control, stateful workloads: use `kubernetes-gke`.

## Workflow

Commands use bash continuations (`\`). In PowerShell use a backtick or one line. Confirm the project (`gcloud config list`) before every deploy.

1. **Snapshot the current state.**

   ```bash
   gcloud run services describe api --region=REGION --format=export > service.yaml
   gcloud run revisions list --service=api --region=REGION --limit=5
   ```

   **Check:** You know the serving revision, its traffic share and settings. Keep `service.yaml` for diff and rollback.

2. **Set runtime knobs on purpose.**

   ```bash
   gcloud run deploy api --image=IMAGE_BY_DIGEST --region=REGION \
     --concurrency=40 --cpu=2 --memory=1Gi --timeout=60 \
     --min-instances=1 --max-instances=20 --cpu-boost \
     --execution-environment=gen2 \
     --service-account=api-runtime@PROJECT_ID.iam.gserviceaccount.com \
     --no-allow-unauthenticated --no-traffic --tag=canary
   ```

   Use the tuning table below. `--no-cpu-throttling` keeps CPU allocated outside requests and changes billing; idle-cost settings such as `--min-instances` need user approval in production.

   **Check:** `gcloud run revisions describe REVISION --region=REGION` shows the intended values.

3. **Add probes and graceful shutdown.** Configure probes in YAML and apply with `gcloud run services replace service.yaml`:

   ```yaml
   spec:
     template:
       spec:
         containers:
           - image: IMAGE_BY_DIGEST
             startupProbe:
               httpGet: { path: /healthz/startup }
               periodSeconds: 5
               failureThreshold: 12
             livenessProbe:
               httpGet: { path: /healthz/live }
               periodSeconds: 30
   ```

   On `SIGTERM` an instance has about 10 seconds to stop accepting work and flush.

   **Check:** A deliberately broken image fails its startup probe and never receives traffic.

4. **Roll out through tags.** Test the tagged URL, then shift traffic.

   ```bash
   TOKEN=$(gcloud auth print-identity-token)
   curl -H "Authorization: Bearer $TOKEN" https://canary---api-HASH-REGION_CODE.a.run.app/healthz
   gcloud run services update-traffic api --region=REGION --to-tags=canary=10
   gcloud run services update-traffic api --region=REGION --to-latest
   gcloud run services update-traffic api --region=REGION --to-revisions=api-00041-abc=100   # roll back
   ```

   PowerShell: `$t = gcloud auth print-identity-token; Invoke-RestMethod -Uri $url -Headers @{ Authorization = "Bearer $t" }`. Copy the real tagged URL from `gcloud run services describe`.

   **Check:** Canary error rate and p95 latency match the stable revision before promotion; promotion was confirmed by the user.

5. **Control who can call it.**

   ```bash
   gcloud run services add-iam-policy-binding api --region=REGION \
     --member="serviceAccount:caller@PROJECT_ID.iam.gserviceaccount.com" --role="roles/run.invoker"
   gcloud run services update api --region=REGION --ingress=internal-and-cloud-load-balancing
   ```

   Service-to-service callers fetch an ID token whose audience is the receiving service URL, from the metadata server (`http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=URL` with header `Metadata-Flavor: Google`) or the client library.

   **Check:** Anonymous request gets 403; the caller's request succeeds.

6. **Reach private resources.** Direct VPC egress: `--network=NETWORK --subnet=SUBNET --vpc-egress=private-ranges-only` (or `all-traffic` to force egress through Cloud NAT for a static IP). Cloud SQL: `--add-cloudsql-instances=PROJECT_ID:REGION:INSTANCE`, or connectors (see `cloud-sql-alloydb`).

   **Check:** The app connects to the private IP; egress IP matches the NAT address when allowlisting is required.

7. **Mount secrets correctly.** Env var: `--set-secrets=API_KEY=api-key:3`. File: `--set-secrets=/secrets/api-key=api-key:latest`. Env vars resolve once at instance start; mounted `latest` re-reads on file access. Pin versions for reproducible rollbacks.

   **Check:** Rotating a secret has a documented path (new version, redeploy or rely on the mounted file).

8. **Run batch work as jobs.**

   ```bash
   gcloud run jobs create nightly-export --image=IMAGE_BY_DIGEST --region=REGION \
     --tasks=10 --parallelism=5 --max-retries=3 --task-timeout=30m \
     --service-account=export-runtime@PROJECT_ID.iam.gserviceaccount.com
   gcloud run jobs execute nightly-export --region=REGION --wait
   gcloud scheduler jobs create http nightly-export-trigger --location=REGION \
     --schedule="0 3 * * *" --http-method=POST \
     --uri="https://REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/PROJECT_ID/jobs/nightly-export:run" \
     --oauth-service-account-email=scheduler@PROJECT_ID.iam.gserviceaccount.com
   ```

   Tasks shard work by `CLOUD_RUN_TASK_INDEX` and `CLOUD_RUN_TASK_COUNT` and must be idempotent (retries re-run them). Grant the scheduler account `roles/run.invoker` on the job (verify in the docs).

   **Check:** `gcloud run jobs executions list --job=nightly-export --region=REGION` shows a succeeded execution.

9. **Debug from logs.**

   ```bash
   gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="api" AND severity>=ERROR' \
     --freshness=1h --limit=50 --format="table(timestamp,resource.labels.revision_name,textPayload)"
   ```

   Jobs use `resource.type="cloud_run_job"`.

   **Check:** The root cause is tied to a specific revision and log line before any fix.

## Reference

### Tuning decisions

| Symptom or goal | Setting |
| :--- | :--- |
| CPU-bound handler, latency rises under load | Lower `--concurrency` (for example 10-40), raise `--cpu` |
| I/O-bound async server | Keep 80 or raise toward 250+; load-test first |
| Not thread-safe or one request per process | `--concurrency=1` (expect many more instances) |
| Cold starts hurt | `--min-instances=1+`, `--cpu-boost`, lazy-load heavy clients |
| Work continues after the response | `--no-cpu-throttling`, or move it to a job or queue |
| Long uploads or streaming | Raise `--timeout` (max 60 minutes for services) |
| Runaway cost or downstream overload | `--max-instances` sized to database connections |

### Troubleshooting

| Error | Likely cause | Fix |
| :--- | :--- | :--- |
| Failed to start and listen on the port defined by `PORT` | Listening on `127.0.0.1`, wrong port, crash at boot, or `exec format error` from an ARM-only image | Bind `0.0.0.0:$PORT`; build `--platform linux/amd64`; read startup logs |
| 403 "does not have permission" | No `roles/run.invoker`, missing token, or wrong audience | Grant invoker; send an ID token with the service URL as audience |
| 429 or 503 under load | `--max-instances` reached, quota, or slow startup | Raise limits or concurrency; min instances, CPU boost |
| "Memory limit exceeded" | Memory too low or leak | Raise `--memory`; profile (`memory-leaks`) |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Deploy straight to 100% traffic | `--no-traffic --tag=canary`, then shift | Instant rollback and real-traffic validation |
| Background threads after the response with default CPU | `--no-cpu-throttling` or a job/queue | CPU is throttled between requests, so work stalls |
| Unlimited instances against a small database | Cap `--max-instances` to the connection budget | Scale-out exhausts `max_connections` |
| `--allow-unauthenticated` plus app-level checks only | Invoker IAM or a load balancer with IAP | Defense in depth; scanners hit public URLs |

## Verification checklist

- [ ] Project and region confirmed; a `service.yaml` snapshot exists.
- [ ] Concurrency, CPU, memory, timeout and min/max instances were chosen deliberately.
- [ ] Startup probe and graceful `SIGTERM` handling are in place.
- [ ] Rollout used a tagged revision; promotion and any rollback were confirmed by the user.
- [ ] Invoker IAM and ingress match the intended exposure.
- [ ] Jobs are idempotent and their schedules authenticate with a dedicated account.

## Related

- Knowledge: `cloud-devops`, `gcp-iam`, `cloud-networking`, `cloud-sql-alloydb`, `pubsub-eventarc`, `serverless-functions`, `docker-containers`, `observability-otel`, `memory-leaks`, `load-testing`.
- Workflows: `/dockerize`, `/perf-audit`, `/root-cause`.
- Agents: `cloud-devops-engineer`, `sre-engineer`.
