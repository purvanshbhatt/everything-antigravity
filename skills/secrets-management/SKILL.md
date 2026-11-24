---
name: secrets-management
disable-model-invocation: true
description: >-
  Stores, injects and rotates secrets: Google Secret Manager with
  per-secret IAM, Vault and dynamic credentials, runtime injection on
  Cloud Run, GKE and VMs, keyless CI with Workload Identity Federation,
  rotation without downtime, BuildKit build secrets, and stopping leaks through
  env vars, logs, images and Git. Use when adding a credential to an app,
  moving secrets out of .env files or code, planning rotation, or auditing
  secret access.
---

# Secrets Management

Secrets live in one managed store, are fetched at runtime by a workload
identity, are readable only by the workload that needs them, and can be
rotated without a deploy freeze. The agent never needs to see a secret value:
ask the user to run commands that take a value, and never echo, log or commit one.

## When to use

- An app needs a new API key, database password, signing key or token.
- Secrets sit in `.env` files, code, CI variables, images or Terraform state.
- Designing rotation, or responding to "who can read this secret?"
- CI uses long-lived service account keys.

## When not to use

- A secret has already leaked: use `credential-sanitizer` first (revoke and rotate, then clean history).
- Choosing encryption algorithms or key hierarchies: use `cryptography`.
- IAM roles and service accounts in general: use `gcp-iam`.
- EAG's own guardrails against writing keys into files: see `agent-shield`.

## Workflow

1. **Inventory.** Scan the repo and history, then list where secrets are configured today.

   ```bash
   gitleaks git .          # history; older gitleaks: gitleaks detect --source .
   gitleaks dir .          # working tree (verify subcommands for your gitleaks version)
   eag shield --file .env.example
   ```

   Also check CI variables, Dockerfiles (`ENV`, `ARG`), Kubernetes manifests, Terraform outputs and app config files with `grep_search`.

   **Check:** A table lists each secret, where it lives now, who uses it, and its owner.

2. **Create each secret in the store with narrow access.**

   ```bash
   gcloud secrets create db-password --replication-policy=automatic
   gcloud secrets add-iam-policy-binding db-password \
     --member=serviceAccount:api@acme-prod.iam.gserviceaccount.com \
     --role=roles/secretmanager.secretAccessor
   ```

   Ask the user to add the value so it never passes through the agent or shell history: `read -rs V && printf %s "$V" | gcloud secrets versions add db-password --data-file=-`. PowerShell appends a newline when piping to native commands, so on Windows write the value to a protected temp file with `Set-Content -NoNewline`, pass `--data-file=<path>`, then delete the file.

   **Check:** `gcloud secrets get-iam-policy db-password` shows only the intended accessors, granted per secret rather than per project.

3. **Inject at runtime with workload identity.**

   | Platform | Method |
   | :--- | :--- |
   | Cloud Run | `--set-secrets=DB_PASSWORD=db-password:3` (env) or `--set-secrets=/secrets/db=db-password:latest` (file) |
   | GKE | Workload Identity Federation for GKE plus the Secret Manager add-on (CSI) or External Secrets Operator |
   | Compute Engine | Attached service account; fetch with the client library at startup |
   | CI (GitHub Actions) | `google-github-actions/auth` with Workload Identity Federation; no JSON keys |
   | Vault | Kubernetes or cloud auth method; dynamic credentials with leases |

   Env-var secrets on Cloud Run resolve when an instance starts, so pin a version and redeploy to roll. File mounts referencing `latest` pick up new versions when read.

   **Check:** The app starts with no secret values in its config files, image or deploy manifests.

4. **Plan rotation.** Rotate with overlap: add a new version, make consumers accept both (or roll consumers), switch, then disable the old version. Secret Manager rotation schedules only publish a Pub/Sub notification; a function you own performs the rotation. Prefer dynamic, short-lived credentials (Vault database engine, IAM database authentication) where available.

   **Check:** A rotation was performed in staging without downtime, and the runbook records the steps.

5. **Close leak paths.** Apply the leak table below, add a pre-commit secret scan, and redact secrets in logging middleware.

   **Check:** The pre-commit hook blocks a test commit containing a fake key, and logs show `[REDACTED]` for sensitive fields.

6. **Audit access.** Enable Data Access audit logs for Secret Manager in production and alert on access by unexpected principals.

   **Check:** An access by a test principal appears in the audit log within minutes.

Disabling a version can break running consumers, and `gcloud secrets versions destroy` is irreversible: both need the user's explicit yes.

## Patterns

### Where secrets leak

| Leak path | Prevention |
| :--- | :--- |
| Environment variables | Visible in `/proc/<pid>/environ`, crash reports, child processes and debug pages; prefer file mounts for high-value secrets |
| Docker images | Never `ENV` or `ARG` secrets; use BuildKit: `RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci` with `docker build --secret id=npmrc,src=.npmrc .` |
| Logs and errors | Redact by key name; never log request headers or connection strings |
| Terraform or Pulumi state | State stores values in plaintext; restrict state access, use write-only arguments or add versions out of band |
| CI logs | Use masked secrets; avoid `set -x` around secret use |
| Git | `.env` in `.gitignore`, commit `.env.example` with placeholders, pre-commit scanning |
| Frontend bundles | Anything shipped to the browser is public; keep keys server-side |

### Reading a secret in code (Python)

```python
from google.cloud import secretmanager

def read_secret(project: str, name: str, version: str = "latest") -> str:
    client = secretmanager.SecretManagerServiceClient()
    path = f"projects/{project}/secrets/{name}/versions/{version}"
    return client.access_secret_version(name=path).payload.data.decode("utf-8")
```

Fetch once at startup or cache with a short TTL; Secret Manager has request quotas.

### Vault essentials

`vault kv get -field=password secret/app/db` for static secrets; `vault read database/creds/app-role` for a short-lived database user with a lease. Renew or re-read before the lease expires.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Service account JSON keys in CI | Workload Identity Federation | Keys are long-lived and leak |
| One project-wide `secretAccessor` grant | Per-secret IAM bindings | Every workload can read every secret |
| Secrets in `.env` committed "temporarily" | `.env.example` plus a secret store | Git history keeps them forever |
| Pass secrets as CLI arguments | stdin, files or the client library | Arguments appear in `ps` output and shell history |
| Rotate by replacing in place | Add version, overlap, switch, disable old | In-place swaps cause outages |
| Paste secrets into the agent chat | Have the user run the command | Transcripts and logs persist |

## Verification checklist

- [ ] No secrets in code, images, manifests, CI logs or committed env files; scanner is clean.
- [ ] Each secret has per-secret IAM limited to its consumers.
- [ ] Workloads and CI authenticate with workload identity, not key files.
- [ ] A zero-downtime rotation was exercised and documented.
- [ ] Audit logging is on for production secrets.
- [ ] Destroying or disabling versions had explicit user consent.

## Related

- Agents: `security-guard`, `cloud-devops-engineer`.
- Workflows: `/security-scan`.
- Knowledge: `credential-sanitizer`, `agent-shield`, `gcp-iam`, `cryptography`, `cloud-run`, `kubernetes-gke`, `terraform-iac`, `docker-containers`.
