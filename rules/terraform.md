---
trigger: glob
globs: "**/*.tf, **/*.tfvars, **/*.hcl"
description: Terraform and HCL infrastructure-as-code conventions
---

# Terraform

## Safety

- `terraform apply`, `terraform destroy`, `state rm`, `state mv`, `import` and `-replace` change real infrastructure or state: run them only after explicit user confirmation for that specific action.
- Always `terraform plan -out=tfplan`, show the summary (add/change/destroy counts and every `-/+` replacement or destroy), and apply that saved plan, never a fresh unreviewed apply.
- Never use `-auto-approve` outside CI pipelines that require an approved plan.
- Protect stateful resources (databases, buckets with data, KMS keys) with `lifecycle { prevent_destroy = true }` and provider deletion protection flags where available.

## State

- Use a remote backend with locking and encryption (for example GCS, or S3 with locking enabled). Never commit `*.tfstate`, `*.tfstate.backup` or `.terraform/`.
- Never edit state by hand. Refactor with `moved {}` blocks; adopt existing resources with `import {}` blocks reviewed through a plan.
- Separate state per environment (directories or workspaces, per project convention); never share one state across prod and non-prod.

## Versions

- Pin `required_version` and every provider in `required_providers` with a pessimistic constraint (`~> 5.0`). Commit `.terraform.lock.hcl`.
- Pin module sources to a version (`version = "~> 2.1"`) or git tag (`?ref=v2.1.0`), never a branch.
- Do not upgrade providers as a side effect of another change.

## Secrets

- No secrets in `.tf` or committed `.tfvars`. Read them from a secret manager data source or CI-injected variables.
- Mark secret variables and outputs `sensitive = true`. State still stores them, so restrict state access.
- Prefer ephemeral values and write-only arguments where your Terraform and provider versions support them; check the docs for your version.

## Code style

- Run `terraform fmt -recursive` and `terraform validate`; lint with `tflint` and scan with `trivy config` or `checkov` when available.
- Every variable has `type` and `description`; add `validation` blocks for constrained inputs. Every output has a `description`.
- Use `for_each` with stable keys instead of `count` for collections, so removing one item does not shift every address.
- `snake_case` names that do not repeat the resource type (`google_storage_bucket.assets`, not `.assets_bucket`).
- Reusable modules contain no `provider` blocks and no hard-coded project IDs, regions or account numbers; pass them in.
- Keep modules small and single-purpose; avoid deep module nesting.
- Apply consistent labels/tags (owner, environment, cost center) to every resource that supports them.

## Security defaults

- Least-privilege IAM: specific roles on specific resources; no primitive Owner/Editor roles or `*` actions for workloads.
- No `0.0.0.0/0` ingress to SSH, RDP or database ports. No public buckets or objects unless explicitly intended and commented.
- Enable encryption at rest, access logging and versioning on storage holding important data.
