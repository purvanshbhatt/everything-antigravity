# gcloud recipes

Replace `PROJECT_ID`, `PROJECT_NUMBER`, `REGION`, `OWNER/REPO` and account
names. Bash continuations (`\`) become backticks in PowerShell.

## Workload Identity Federation for GitHub Actions

```bash
gcloud iam workload-identity-pools create github \
  --location=global --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github-oidc \
  --location=global --workload-identity-pool=github \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository=='OWNER/REPO'"

gcloud iam service-accounts create ci-deployer --display-name="CI deployer"

gcloud iam service-accounts add-iam-policy-binding \
  ci-deployer@PROJECT_ID.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/OWNER/REPO"
```

The `--attribute-condition` is mandatory in practice: without it any GitHub repository could exchange tokens against your pool. Tighten further with `assertion.ref=='refs/heads/main'` for production deployers.

Workflow side (pin actions to a full commit SHA in production; check the action's README for the current major version):

```yaml
permissions:
  contents: read
  id-token: write
steps:
  - uses: actions/checkout@v4
  - uses: google-github-actions/auth@v2
    with:
      workload_identity_provider: projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github-oidc
      service_account: ci-deployer@PROJECT_ID.iam.gserviceaccount.com
  - uses: google-github-actions/setup-gcloud@v2
  - run: gcloud run deploy api --image="$IMAGE" --region=REGION
```

Grant the deployer:

```bash
gcloud artifacts repositories add-iam-policy-binding app --location=REGION \
  --member="serviceAccount:ci-deployer@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:ci-deployer@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.developer"
gcloud iam service-accounts add-iam-policy-binding api-runtime@PROJECT_ID.iam.gserviceaccount.com \
  --member="serviceAccount:ci-deployer@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

## Cloud Build

```yaml
# cloudbuild.yaml
steps:
  - name: gcr.io/cloud-builders/docker
    args: ["build", "-t", "${_IMAGE}:${SHORT_SHA}", "."]
  - name: gcr.io/cloud-builders/docker
    args: ["push", "${_IMAGE}:${SHORT_SHA}"]
  - name: gcr.io/google.com/cloudsdktool/cloud-sdk
    entrypoint: gcloud
    args: ["run", "deploy", "api", "--image=${_IMAGE}:${SHORT_SHA}", "--region=${_REGION}"]
substitutions:
  _IMAGE: REGION-docker.pkg.dev/PROJECT_ID/app/api
  _REGION: REGION
options:
  logging: CLOUD_LOGGING_ONLY
```

`SHORT_SHA` is populated for trigger-based builds; for manual runs pass `--substitutions=SHORT_SHA=$(git rev-parse --short HEAD)` with `gcloud builds submit --config=cloudbuild.yaml`. Run builds as a dedicated service account (`serviceAccount:` field in the config), not the legacy Cloud Build default.

## Local development without keys

```bash
gcloud auth application-default login                       # ADC for client libraries
gcloud auth print-identity-token                            # call a private Cloud Run URL as yourself
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" https://api-xyz-uc.a.run.app/health
gcloud run services proxy api --region=REGION --port=8080   # local proxy to a private service
```

Impersonate a service account to reproduce its permissions (needs `roles/iam.serviceAccountTokenCreator` on it):

```bash
gcloud run services list --impersonate-service-account=api-runtime@PROJECT_ID.iam.gserviceaccount.com
```

## Private networking

```bash
# Direct VPC egress (no connector resource)
gcloud run deploy api --image=IMAGE --region=REGION \
  --network=default --subnet=default --vpc-egress=private-ranges-only

# Serverless VPC Access connector (older pattern)
gcloud compute networks vpc-access connectors create run-conn \
  --region=REGION --network=default --range=10.8.0.0/28
gcloud run deploy api --image=IMAGE --region=REGION --vpc-connector=run-conn
```

Cloud SQL from Cloud Run: `--add-cloudsql-instances=PROJECT_ID:REGION:INSTANCE` (Unix socket via the built-in connector) or private IP over VPC egress plus IAM database authentication.

## Logs and debugging

```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="api" AND severity>=ERROR' \
  --limit=50 --freshness=1h --format=json
gcloud run revisions list --service=api --region=REGION
gcloud run services describe api --region=REGION --format=yaml
```

## Budgets and alerts

```bash
gcloud billing accounts list
gcloud billing budgets create --billing-account=BILLING_ACCOUNT_ID \
  --display-name="PROJECT_ID monthly" --budget-amount=200USD \
  --filter-projects=projects/PROJECT_ID \
  --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 \
  --threshold-rule=percent=1.0,basis=forecasted-spend
```

Budgets alert; they do not stop spend. For a hard stop, route the budget's Pub/Sub notifications to a function that scales services down or detaches billing, and agree on that behaviour with the user first.

## Organisation guardrails worth enabling

| Constraint | Effect |
| :--- | :--- |
| `iam.disableServiceAccountKeyCreation` | Blocks new user-managed SA keys |
| `iam.allowedPolicyMemberDomains` | Only your domain's identities can be granted roles |
| `run.allowedIngress` | Restrict Cloud Run ingress settings |
| `gcp.resourceLocations` | Keep resources in approved regions |

Applying organisation policies affects every project under the node: get explicit approval from the user and the org admin.
