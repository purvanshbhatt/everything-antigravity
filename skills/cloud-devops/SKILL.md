---
name: cloud-devops
description: >-
  Google Cloud overview and router: Cloud Run deploys, Artifact Registry,
  Cloud Build, IAM least privilege and per-service service accounts,
  Workload Identity Federation for keyless CI, Secret Manager, VPC egress,
  and budgets and alerts, with real gcloud commands. Use when deploying a
  service to Google Cloud, wiring CI to GCP, fixing permission errors, or
  setting up a new project; points to deeper skills for GKE, Terraform, CI
  and containers.
---

# Cloud DevOps on Google Cloud

Ship containers to Cloud Run with a dedicated least-privilege identity,
secrets from Secret Manager, keyless CI through Workload Identity Federation,
and a budget alert before the first deploy. Codify it in Terraform once the
shape is stable.

## When to use

- First deploy of a service or job to Google Cloud, or setting up a new project.
- CI needs to push images and deploy without service-account keys.
- `PERMISSION_DENIED`, missing-role, or secret-access errors.
- Private database access from Cloud Run, rollouts and rollbacks, cost guardrails.

## When not to use

- Kubernetes workloads and GKE clusters: use `kubernetes-gke`.
- Infrastructure as code modules, state and drift: use `terraform-iac`.
- Pipeline authoring, caching and matrices: use `ci-cd-github-actions`.
- Dockerfiles and image hardening: use `docker-containers`.
- Logs, metrics, traces and SLO alerts: use `observability-otel`.

## Workflow

Commands use bash line continuations (`\`). In PowerShell replace them with a backtick or put the command on one line. More recipes: [gcloud recipes](references/gcloud-recipes.md).

1. **Confirm context before anything else.**

   ```bash
   gcloud auth list
   gcloud config list
   gcloud projects describe PROJECT_ID --format="value(projectNumber)"
   ```

   **Check:** Active account and project are the ones the user intends. If either is wrong, stop and ask; never deploy to a guessed project.

2. **Enable only the APIs you need.**

   ```bash
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
     cloudbuild.googleapis.com secretmanager.googleapis.com iamcredentials.googleapis.com
   ```

   **Check:** `gcloud services list --enabled` shows them.

3. **Create a runtime identity per service.** One service account per service, granted only the roles it uses, on the narrowest resource (secret, bucket, database instance) rather than the project.

   ```bash
   gcloud iam service-accounts create api-runtime --display-name="api runtime"
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="serviceAccount:api-runtime@PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/cloudsql.client"
   ```

   **Check:** The account has no basic roles (`roles/owner`, `roles/editor`, `roles/viewer`) and no user-managed keys (`gcloud iam service-accounts keys list --iam-account=... --managed-by=user` is empty).

4. **Store secrets in Secret Manager and grant per-secret access.**

   ```bash
   gcloud secrets create db-password --replication-policy=automatic
   printf '%s' "$DB_PASSWORD" | gcloud secrets versions add db-password --data-file=-
   gcloud secrets add-iam-policy-binding db-password \
     --member="serviceAccount:api-runtime@PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```

   **Check:** The secret value never appears in a command line, file in the repo, or log. Let the user enter it themselves when it is a real credential.

5. **Build and push to Artifact Registry.**

   ```bash
   gcloud artifacts repositories create app --repository-format=docker --location=REGION
   gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT_ID/app/api:$(git rev-parse --short HEAD)
   ```

   **Check:** `gcloud artifacts docker images list REGION-docker.pkg.dev/PROJECT_ID/app` shows the tag. Deploy by digest or immutable tag, never `:latest`.

6. **Deploy to Cloud Run, private by default.** Confirm with the user before deploying to any shared or production project.

   ```bash
   gcloud run deploy api \
     --image=REGION-docker.pkg.dev/PROJECT_ID/app/api:TAG \
     --region=REGION \
     --service-account=api-runtime@PROJECT_ID.iam.gserviceaccount.com \
     --no-allow-unauthenticated \
     --set-secrets=DB_PASSWORD=db-password:latest \
     --min-instances=0 --max-instances=10 --concurrency=80 \
     --cpu=1 --memory=512Mi
   ```

   Use `--allow-unauthenticated` only for intentionally public endpoints. For private databases add Direct VPC egress (`--network=NETWORK --subnet=SUBNET --vpc-egress=private-ranges-only`) or a Serverless VPC Access connector (`--vpc-connector=CONNECTOR`).

   **Check:** `gcloud run services describe api --region=REGION --format="value(status.url,status.latestReadyRevisionName)"` returns a ready revision, and a request with an identity token succeeds while an anonymous one gets 403.

7. **Roll out safely.** Deploy with `--no-traffic --tag=canary`, test the tagged URL, then shift traffic gradually and keep the previous revision for rollback.

   ```bash
   gcloud run services update-traffic api --region=REGION --to-tags=canary=10
   gcloud run services update-traffic api --region=REGION --to-latest          # promote
   gcloud run services update-traffic api --region=REGION --to-revisions=api-00041-abc=100   # roll back
   ```

   **Check:** Error rate and latency of the canary match the stable revision before promotion.

8. **Make CI keyless.** Configure Workload Identity Federation for the CI provider (recipe in the reference file) and a deployer service account with `roles/run.developer`, `roles/artifactregistry.writer` and `roles/iam.serviceAccountUser` on the runtime account only.

   **Check:** The pipeline deploys with no JSON key in CI secrets.

9. **Add cost guardrails.** Create a budget with alert thresholds (needs the billing account ID and billing permissions; confirm amounts with the user) and cap `--max-instances` on every service.

   **Check:** `gcloud billing budgets list --billing-account=BILLING_ACCOUNT_ID` shows the budget with thresholds.

## Reference

### Choosing a runtime

| Workload | Use | Why |
| :--- | :--- | :--- |
| Stateless HTTP or gRPC service | Cloud Run service | Scale to zero, revisions, traffic splitting |
| Batch or scheduled task | Cloud Run job plus Cloud Scheduler | Runs to completion, retries, parallel tasks |
| Event-driven glue | Cloud Run (Eventarc or Pub/Sub push) | One model for HTTP and events |
| Stateful sets, sidecar-heavy, custom networking, GPUs at scale | GKE (`kubernetes-gke`) | Full Kubernetes control |
| Long-lived VMs, licensed software | Compute Engine | When containers do not fit |

### IAM roles that are usually enough

| Principal | Roles (scope) |
| :--- | :--- |
| Runtime SA | `roles/secretmanager.secretAccessor` (per secret), `roles/cloudsql.client` (project), `roles/storage.objectViewer` or `objectUser` (per bucket), `roles/pubsub.publisher` (per topic) |
| CI deployer SA | `roles/run.developer`, `roles/artifactregistry.writer` (per repository), `roles/iam.serviceAccountUser` (on the runtime SA only) |
| Humans | Groups, not individuals; `roles/run.viewer`, `roles/logging.viewer` by default; elevated access via temporary grants |

Find unused permissions with IAM recommender: `gcloud recommender recommendations list --recommender=google.iam.policy.Recommender --project=PROJECT_ID --location=global`.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Use the default compute service account | Dedicated SA per service | The default often holds the broad Editor role |
| Download service-account JSON keys for CI | Workload Identity Federation | Long-lived keys get copied and exposed; WIF credentials expire within an hour |
| Pass secrets in `--set-env-vars` | `--set-secrets` from Secret Manager | Env var values are visible in the service config |
| Grant roles at project level by habit | Bind on the specific secret, bucket, topic or repository | Limits blast radius of a compromised workload |
| Deploy `:latest` | Commit-SHA tags or digests | Rollbacks and audits need immutable references |
| Click-ops for long-lived resources | Terraform once the design settles | Undocumented drift and unreproducible environments |
| No budget until the first surprise bill | Budget alerts plus `--max-instances` on day one | Runaway autoscaling or loops cost real money fast |

## Verification checklist

- [ ] Account and project were confirmed with the user before any change.
- [ ] Each service runs as its own SA with no basic roles and no user-managed keys.
- [ ] Secrets come from Secret Manager via `--set-secrets`; none in env vars, repo or logs.
- [ ] Services are private unless intentionally public; anonymous access tested.
- [ ] Images are deployed by immutable tag or digest from Artifact Registry.
- [ ] CI authenticates with Workload Identity Federation, restricted to the repository.
- [ ] Budget alerts exist and every service has `--max-instances`.
- [ ] Production deploys and traffic shifts were confirmed by the user.

## Related

- Knowledge: `kubernetes-gke`, `terraform-iac`, `ci-cd-github-actions`, `docker-containers`, `observability-otel`, `database-design`, `credential-sanitizer`, `sandbox-isolation`.
- Workflows: `/security-scan`, `/verify`, `/root-cause`.
- Agents: `cloud-devops-engineer`, `security-guard`, `database-architect`.
