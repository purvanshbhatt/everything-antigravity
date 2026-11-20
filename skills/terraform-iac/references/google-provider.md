# Google Provider Patterns

Companion to the `terraform-iac` skill. Check the Terraform Registry
(`registry.terraform.io/providers/hashicorp/google`) for the current major
version and its upgrade guide before pinning; the constraints below are
examples, not recommendations frozen in time.

## Layout

```text
infra/
├── bootstrap/            # creates the state buckets; local state, run once by an admin
├── modules/
│   └── service-bucket/   # main.tf variables.tf outputs.tf versions.tf README.md
└── envs/
    ├── dev/              # backend.tf providers.tf main.tf terraform.tfvars (no secrets)
    └── prod/
```

## Versions and providers (root module)

```hcl
# versions.tf
terraform {
  required_version = ">= 1.11"    # write-only arguments need 1.11+; lower it if unused
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"          # check the registry for the current major
    }
  }
}

# providers.tf
provider "google" {
  project                     = var.project_id
  region                      = var.region
  impersonate_service_account = var.deployer_sa   # no key files, locally or in CI
  default_labels = {
    env         = var.env
    owner       = "platform"
    managed_by  = "terraform"
  }
}
```

Reusable modules declare `required_providers` with a minimum version only
(`version = ">= 6.0"`) and never contain a `provider` block.

## State bucket bootstrap

Create the bucket once, outside the stack it will hold (confirm with the user:
this creates billable resources):

```bash
gcloud storage buckets create gs://acme-tfstate-prod --project=PROJECT_ID \
  --location=US --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets update gs://acme-tfstate-prod --versioning
```

Grant `roles/storage.objectAdmin` on that bucket only to the deployer identities.
Then point the root module at it, keeping environment specifics out of code with
a partial configuration:

```hcl
# backend.tf
terraform {
  backend "gcs" {}
}
```

```bash
terraform init -backend-config="bucket=acme-tfstate-prod" -backend-config="prefix=platform/network"
# moving existing local state into the bucket (confirm first):
terraform init -migrate-state -backend-config="bucket=acme-tfstate-prod" -backend-config="prefix=platform/network"
```

## IAM

```hcl
# Additive and safe: grants one role to one member, leaves other members alone.
resource "google_project_iam_member" "run_invoker" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.frontend.email}"
}

# Narrower still: grant on the resource, not the project.
resource "google_secret_manager_secret_iam_member" "api_reads_db_password" {
  secret_id = google_secret_manager_secret.db_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api.email}"
}
```

| Resource kind | Scope of ownership | Use |
| :--- | :--- | :--- |
| `*_iam_member` | One member in one role | Default choice |
| `*_iam_binding` | All members of one role | Only when this stack must own the full member list of that role |
| `*_iam_policy` | The entire policy | Almost never; it removes grants made elsewhere, including Google-managed ones |

## APIs and guard rails

```hcl
resource "google_project_service" "run" {
  project            = var.project_id
  service            = "run.googleapis.com"
  disable_on_destroy = false
}

resource "google_sql_database_instance" "main" {
  # ...
  deletion_protection = true
  lifecycle {
    prevent_destroy = true
  }
}
```

## Secrets without state exposure

```hcl
variable "db_password" {
  type      = string
  sensitive = true
  ephemeral = true        # Terraform 1.10+: never persisted to state or plan
}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "db-password"
  replication {
    auto {}
  }
}

# Write-only argument (Terraform 1.11+ and a provider version that supports it):
resource "google_secret_manager_secret_version" "db_password" {
  secret                 = google_secret_manager_secret.db_password.id
  secret_data_wo         = var.db_password
  secret_data_wo_version = 1          # bump to push a new value
}
```

Confirm the write-only argument names in the provider docs for your version.
If they are unavailable, create the secret container in Terraform and add
versions out-of-band (`gcloud secrets versions add db-password --data-file=-`).

## Module with validation

```hcl
# modules/service-bucket/variables.tf
variable "name" {
  type        = string
  description = "Globally unique bucket name."
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$", var.name))
    error_message = "Bucket names: 3-63 chars, lowercase letters, digits and hyphens."
  }
}

# modules/service-bucket/main.tf
resource "google_storage_bucket" "this" {
  name                        = var.name
  location                    = var.location
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  versioning {
    enabled = true
  }
}

# modules/service-bucket/outputs.tf
output "url" {
  value = google_storage_bucket.this.url
}
```

## Tests (`terraform test`, 1.6+)

```hcl
# modules/service-bucket/tests/bucket.tftest.hcl
variables {
  name     = "acme-test-assets"
  location = "US"
}

run "bucket_is_private" {
  command = plan
  assert {
    condition     = google_storage_bucket.this.public_access_prevention == "enforced"
    error_message = "Bucket must enforce public access prevention."
  }
}
```

`command = plan` tests need no credentials for most assertions; `apply` tests
create real resources and must run only in a sandbox project with consent.

## tflint configuration

```hcl
# .tflint.hcl
plugin "google" {
  enabled = true
  version = "<version>"   # see github.com/terraform-linters/tflint-ruleset-google/releases
  source  = "github.com/terraform-linters/tflint-ruleset-google"
}
```

## CI shape

| Stage | Identity | Action |
| :--- | :--- | :--- |
| Pull request | Planner service account: read-only on resources, read on state | `fmt -check`, `validate`, tflint, trivy, checkov, `plan -out`, post the summary to the PR |
| Merge to main | Applier service account behind a protected environment with required reviewers | Apply the plan artifact produced from the merged commit |
| Nightly | Planner | `plan -detailed-exitcode`; alert on exit 2 |

Plan files contain sensitive values in plaintext. Keep them as short-retention,
private CI artifacts and delete them after apply. Both identities authenticate
with Workload Identity Federation (see `ci-cd-github-actions`).
