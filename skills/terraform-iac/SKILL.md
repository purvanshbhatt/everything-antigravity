---
name: terraform-iac
disable-model-invocation: true
description: >-
  Manages infrastructure as code with Terraform or OpenTofu: module layout, GCS
  remote state and locking, per-environment directories, plan review
  discipline, import, moved and removed blocks, drift detection, tflint,
  checkov and trivy policy checks, secrets handling and Google provider
  patterns. Use when writing or reviewing .tf files, before any plan or apply,
  when state drifts, or when bringing existing cloud resources under code.
---

# Terraform IaC

Change infrastructure only through reviewed plans against locked remote state.
The saved plan is the contract: read every line of it, show the user what it
replaces or destroys, and apply exactly that file and nothing else.

**Apply policy.** The agent may run `fmt`, `validate`, `init`, `plan`, `show`,
`state list` and `state show` freely. `apply`, `destroy`, `state mv|rm|push`,
`import` (CLI), `force-unlock`, and any `-auto-approve` on a shared environment
require the user's explicit yes after they have seen the plan summary. Never run
`apply -auto-approve` against shared state without that consent.

## When to use

- Writing or reviewing `.tf` files, modules or backends.
- Any request to plan, apply, import, rename or refactor resources.
- Someone changed infrastructure in the console and state has drifted.
- Setting up policy checks (tflint, checkov, trivy) or a plan/apply pipeline.

## When not to use

- Day-to-day Kubernetes objects inside a cluster: use `kubernetes-gke` (Kustomize, Helm or GitOps).
- Choosing between GCP services or designing the topology: use `cloud-devops` first, then codify here.
- The CI pipeline that runs plan and apply: use `ci-cd-github-actions` (this skill defines what it must enforce).
- Rotating or scrubbing a leaked secret: use `credential-sanitizer`.

## Workflow

1. **Orient before editing.** Use `find_by_name` for `*.tf`, `*.tftest.hcl` and `.terraform.lock.hcl`, then `view_file` the backend, `required_providers` and `required_version`. Run `terraform version` (or `tofu version`) and identify which directory and state the request targets.

   **Check:** You can name the backend bucket and prefix, the provider versions, and the environment being changed.

2. **Verify remote state and locking.** Use a GCS backend with object versioning, uniform bucket-level access and IAM limited to the deployers. GCS locks natively; there is no separate lock table.

   ```hcl
   terraform {
     backend "gcs" {
       bucket = "acme-tfstate-prod"   # one bucket per environment or per trust boundary
       prefix = "platform/network"
     }
   }
   ```

   Bootstrapping the bucket itself is in [Google provider patterns](references/google-provider.md).

   **Check:** `terraform init` reports the `gcs` backend, and `gcloud storage buckets describe gs://BUCKET --format="value(versioning_enabled)"` prints `True`.

3. **Write code in the standard layout.** Root modules per environment (`envs/prod`, `envs/dev`) call reusable modules (`modules/<name>` with `main.tf`, `variables.tf`, `outputs.tf`, `versions.tf`, `README.md`). Provider configuration lives only in root modules. Commit `.terraform.lock.hcl`, and lock for every OS your team uses:

   ```bash
   terraform providers lock -platform=linux_amd64 -platform=darwin_arm64 -platform=windows_amd64
   ```

   **Check:** `terraform fmt -check -recursive` and `terraform validate` both pass.

4. **Run static policy checks.**

   ```bash
   tflint --init && tflint --recursive
   trivy config .
   checkov -d .
   ```

   Suppress a finding only inline with a reason: `# checkov:skip=<CHECK_ID>:<why this is acceptable>` for checkov, `#trivy:ignore:<ID>` for trivy, and a `# tflint-ignore: <rule>` comment for tflint.

   **Check:** No HIGH or CRITICAL findings remain without a written justification.

5. **Plan to a file and review it.**

   ```bash
   terraform plan -input=false -out=tfplan
   terraform show -no-color tfplan > plan.txt
   terraform show -json tfplan > plan.json
   ```

   Review using the checklist in [plan review](references/plan-review.md): the `Plan:` summary line, every `must be replaced` and `forces replacement`, every destroy, every IAM change, and anything you did not intend (drift).

   **Check:** You have shown the user the add, change and destroy counts plus the verbatim list of replaced and destroyed addresses.

6. **Apply only the reviewed plan, after consent.** `terraform apply tfplan` applies exactly what was reviewed and fails if state changed since the plan. Never re-plan inside apply.

   **Check:** The apply counts match the plan, and a follow-up `terraform plan -detailed-exitcode` exits `0` (no changes).

7. **Refactor with blocks, not state surgery.** Use `moved` for renames, `import` for adopting existing resources (with `terraform plan -generate-config-out=generated.tf` to draft the config), and `removed` to stop managing without destroying.

   ```hcl
   moved {
     from = google_storage_bucket.assets
     to   = module.cdn.google_storage_bucket.assets
   }
   import {
     to = google_storage_bucket.logs
     id = "acme-logs"
   }
   removed {
     from = google_compute_instance.legacy
     lifecycle {
       destroy = false
     }
   }
   ```

   **Check:** The plan shows `has moved to` or `will be imported` and zero unintended destroys.

8. **Detect drift on a schedule.** Run `terraform plan -input=false -detailed-exitcode` nightly per environment: exit `0` means no changes, `1` an error, `2` drift or pending changes. Use `terraform plan -refresh-only` to see exactly what changed outside Terraform, then decide with the owner whether to codify it or revert it.

   **Check:** The drift job alerts the owning team on exit `2`, and each drift item ends with either a code change or a revert.

## Patterns

### Environments: directories or workspaces

| Need | Choose | Why |
| :--- | :--- | :--- |
| prod, staging, dev with different projects, permissions or sizes | Directory per environment (`envs/<env>`), separate state buckets | Separate credentials and blast radius; differences are visible in code |
| Short-lived identical copies (per-PR previews, load tests) | CLI workspaces (`terraform workspace new pr-123`) | Same code, isolated state under one backend |
| Many environments with heavy repetition | Directories plus a thin wrapper (Terragrunt or a Makefile) | Keeps each root small without hiding differences |

### Google provider essentials

| Topic | Rule |
| :--- | :--- |
| IAM | Prefer `google_*_iam_member` (additive). `google_*_iam_binding` owns all members of one role. `google_*_iam_policy` replaces the whole policy and can lock you out; avoid it outside dedicated modules |
| APIs | `google_project_service` with `disable_on_destroy = false` so a destroy never turns off an API other stacks use |
| Labels | Provider-level `default_labels` (env, owner, cost-center) on every resource that supports labels |
| Auth | Local: `gcloud auth application-default login` plus provider `impersonate_service_account`. CI: Workload Identity Federation. Never service-account key files |
| Guard rails | `deletion_protection = true` on databases and clusters; `lifecycle { prevent_destroy = true }` on stateful resources |

Version pins, the state bucket bootstrap and full examples are in [Google provider patterns](references/google-provider.md).

### Secrets

- State stores every attribute in plaintext, including `sensitive = true` values. Treat the state bucket as secret: restrict IAM, enable versioning, and consider a customer-managed encryption key.
- Create the `google_secret_manager_secret` container in Terraform; add secret versions out-of-band, or with write-only arguments (Terraform 1.11+, where the provider supports them) so values never reach state.
- Never put secrets in `*.tfvars` committed to Git, in `default` values or in outputs. Pass them through `TF_VAR_name` environment variables from a secret manager in CI.

### OpenTofu

OpenTofu (`tofu`) is a drop-in fork for most configurations and adds features
such as client-side state encryption. Pick one binary per state: check the
compatibility notes before switching, and never alternate `terraform` and `tofu`
against the same state.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `terraform apply -auto-approve` on shared environments | `plan -out`, review, consent, `apply tfplan` | The applied change can differ from anything a human read |
| Local state or state in Git | GCS backend with versioning and locking | Lost or concurrent state corrupts infrastructure |
| `terraform state mv` / `rm` for refactors | `moved` and `removed` blocks reviewed in a PR | Blocks are declarative, reviewable and repeatable across environments |
| `google_project_iam_policy` for a single grant | `google_project_iam_member` | Authoritative policies silently remove other grants |
| One root module for every environment | Directory per environment with shared modules | One bad apply should not reach prod and dev together |
| Unpinned providers and no lock file | `required_providers` constraints plus committed `.terraform.lock.hcl` | Provider upgrades change plans without warning |
| `force-unlock` because a plan is "stuck" | Confirm no other run holds the lock, then ask the user | Breaking a live lock causes concurrent writes to state |
| Ignoring `forces replacement` lines | Stop and explain each replacement to the user | Replacement means destroy then create: data loss and downtime |

## Verification checklist

- [ ] Remote state in GCS with versioning; nobody outside the deployers can read it.
- [ ] `fmt -check`, `validate`, tflint, trivy and checkov all pass, or each skip has a reason.
- [ ] Plan saved to a file; replacements, destroys and IAM changes listed to the user verbatim.
- [ ] Apply ran only on the reviewed plan file, with explicit user consent.
- [ ] A post-apply plan shows no changes.
- [ ] No secrets in code, tfvars, outputs or CI logs; providers and Terraform version pinned.
- [ ] Refactors used `moved`, `import` or `removed` blocks with zero unintended destroys.

## Related

- Agents: `cloud-devops-engineer` (GCP design and IaC changes), `security-guard` (IAM and policy review), `code-reviewer` (plan and diff review).
- Workflows: `/code-review`, `/security-scan`, `/checkpoint` (before risky applies).
- Knowledge: `cloud-devops`, `kubernetes-gke`, `ci-cd-github-actions`, `credential-sanitizer`, `security-audit`.
