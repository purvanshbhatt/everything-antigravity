---
name: gcp-iam
disable-model-invocation: true
description: >-
  Designs and audits Google Cloud IAM: resource hierarchy, predefined and
  custom roles, conditional and time-bound grants, service accounts without
  keys, impersonation, workload identity, organization policies, Policy
  Troubleshooter, Policy Analyzer and audit logs. Use when fixing
  PERMISSION_DENIED, granting or reviewing access, removing service account
  keys, setting org guardrails, or running a least-privilege review.
---

# Google Cloud IAM

Grant the smallest role on the smallest resource for the shortest time, to
groups and service accounts rather than people, and prove every change with
Policy Troubleshooter or Policy Analyzer. `cloud-devops` covers the first
per-service setup; this skill goes deeper on design, debugging and audits.

## When to use

- `PERMISSION_DENIED`, `IAM_PERMISSION_DENIED` or "does not have X permission" errors.
- Granting access to a person, group, CI system or workload.
- Removing service account keys, setting up impersonation for local development.
- Organization policy guardrails or a periodic least-privilege and key audit.

## When not to use

- First Cloud Run deploy and its runtime account: use `cloud-devops` and `cloud-run`.
- GKE Workload Identity wiring inside the cluster: use `kubernetes-gke`.
- Broad posture review across services (Security Command Center): use `cloud-security-posture`.
- End-user login for your application: use `auth-patterns`.

## Workflow

Commands use bash continuations (`\`). In PowerShell use a backtick or one line.

1. **Pin down the exact principal, permission and resource.** Read the error: it names the permission (for example `run.services.update`) and usually the resource. Confirm which identity made the call.

   ```bash
   gcloud auth list
   gcloud config get-value auth/impersonate_service_account
   ```

   **Check:** You can write the triple "principal X needs permission Y on resource Z".

2. **Ask Policy Troubleshooter before changing anything.**

   ```bash
   gcloud policy-intelligence troubleshoot-policy iam \
     //cloudresourcemanager.googleapis.com/projects/PROJECT_ID \
     --principal-email=api-runtime@PROJECT_ID.iam.gserviceaccount.com \
     --permission=secretmanager.versions.access
   ```

   It reports which bindings, conditions and deny policies apply. If access is denied by a deny policy or an org policy, a new allow binding will not help.

   **Check:** You know why access is denied, not just that it is.

3. **Choose the role.** Prefer predefined roles scoped to the resource. Inspect before granting:

   ```bash
   gcloud iam roles describe roles/secretmanager.secretAccessor
   gcloud iam roles list --filter="name:roles/run." --format="value(name,title)"
   ```

   Create a custom role only when predefined roles are clearly too broad, and keep it small:

   ```bash
   gcloud iam roles create appDeployer --project=PROJECT_ID --title="App deployer" \
     --permissions=run.services.get,run.services.update,run.revisions.list --stage=GA
   ```

   **Check:** No basic role (`roles/owner`, `roles/editor`, `roles/viewer`) is proposed for a workload.

4. **Grant on the narrowest resource, optionally time-bound.** Confirm every IAM change with the user first.

   ```bash
   gcloud secrets add-iam-policy-binding db-password \
     --member="serviceAccount:api-runtime@PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"

   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="group:oncall@example.com" --role="roles/run.admin" \
     --condition='expression=request.time < timestamp("2026-12-01T00:00:00Z"),title=incident-123,description=temporary access'
   ```

   Prefer `add-iam-policy-binding` and `remove-iam-policy-binding` over `set-iam-policy`, which replaces the whole policy and can drop bindings added since you read it.

   **Check:** Re-run Policy Troubleshooter; it now reports access granted through the intended binding only.

5. **Use impersonation instead of keys for humans and local tools.** Grant `roles/iam.serviceAccountTokenCreator` on the service account to a group, then:

   ```bash
   gcloud storage ls gs://BUCKET --impersonate-service-account=SA_EMAIL
   gcloud auth application-default login --impersonate-service-account=SA_EMAIL   # for client libraries
   gcloud config set auth/impersonate_service_account SA_EMAIL                    # session default
   gcloud config unset auth/impersonate_service_account
   ```

   **Check:** `gcloud iam service-accounts keys list --iam-account=SA_EMAIL --managed-by=user` is empty.

6. **Use federation for anything outside Google Cloud.** CI and other clouds use Workload Identity Federation (GitHub recipe in `cloud-devops`). GKE pods use Workload Identity Federation for GKE, where a Kubernetes service account is a principal, for example `principal://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/PROJECT_ID.svc.id.goog/subject/ns/NAMESPACE/sa/KSA`. Verify the current principal format in the GKE docs.

   **Check:** Every federated provider has an attribute condition that pins the repository, branch or namespace.

7. **Set organization guardrails.** Inspect the effective policy, then apply a policy file (needs `roles/orgpolicy.policyAdmin`; confirm with the user).

   ```bash
   gcloud org-policies list --project=PROJECT_ID
   gcloud org-policies describe iam.allowedPolicyMemberDomains --project=PROJECT_ID --effective
   gcloud org-policies set-policy policy.yaml
   ```

   ```yaml
   # policy.yaml
   name: projects/PROJECT_ID/policies/iam.disableServiceAccountKeyCreation
   spec:
     rules:
       - enforce: true
   ```

   Several constraints now have `iam.managed.*` equivalents; check which one the org uses in the current docs.

   **Check:** `describe --effective` shows the enforcement on the target project.

8. **Audit regularly.**

   ```bash
   gcloud asset search-all-iam-policies --scope=organizations/ORG_ID --query="policy:roles/owner"
   gcloud asset search-all-iam-policies --scope=projects/PROJECT_ID --query="policy:allUsers"
   gcloud asset analyze-iam-policy --organization=ORG_ID --identity="user:alice@example.com"
   gcloud recommender insights list --insight-type=google.iam.serviceAccount.Insight \
     --project=PROJECT_ID --location=global
   gcloud logging read 'protoPayload.methodName="SetIamPolicy"' --project=PROJECT_ID \
     --freshness=7d --limit=20 \
     --format="table(timestamp,protoPayload.authenticationInfo.principalEmail,resource.type)"
   ```

   **Check:** Findings are listed with owner and proposed fix; removals are confirmed with the user and done by disabling first (`gcloud iam service-accounts disable SA_EMAIL`) where reversible.

## Reference

### Principal identifiers

| Prefix | Meaning |
| :--- | :--- |
| `user:` / `group:` | Google account / Google group (prefer groups) |
| `serviceAccount:` | Service account email |
| `domain:` | Everyone in a Workspace or Cloud Identity domain |
| `principal://` / `principalSet://` | Federated identities and workload identity pools |
| `allUsers` / `allAuthenticatedUsers` | Public: anyone, or any Google account. Treat as public |

### High-risk permissions

| Role or permission | Why it is dangerous |
| :--- | :--- |
| `roles/iam.serviceAccountUser` (`iam.serviceAccounts.actAs`) | Attach the SA to a resource and run as it |
| `roles/iam.serviceAccountTokenCreator` | Mint tokens for the SA directly |
| `roles/iam.serviceAccountKeyAdmin` | Create exportable long-lived keys |
| `resourcemanager.projects.setIamPolicy` | Grant anything to anyone in the project |
| `roles/editor` | Thousands of permissions; often on default compute SA |

Grant these on a single service account, never project-wide, and to groups with a business reason.

### Hierarchy rules

- Allow policies inherit downward: organization, folder, project, resource. A grant cannot be revoked lower down; use a deny policy or move the grant.
- Service agents (`service-PROJECT_NUMBER@gcp-sa-*.iam.gserviceaccount.com`) are managed by Google; do not remove their roles.
- Admin Activity audit logs are always on; Data Access logs are off by default for most services and must be enabled for sensitive data.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Grant `roles/editor` to fix a denial | Troubleshoot, then grant the specific role on the resource | Editor persists and hides future mistakes |
| Download a key to "test locally" | Impersonation via `--impersonate-service-account` | Keys outlive their purpose and leak |
| Grant `serviceAccountUser` at project level | Grant it on the one SA a deployer attaches | Project-level actAs lets them run as every SA |
| `set-iam-policy` from an old export | `add-` and `remove-iam-policy-binding` | Overwrites bindings added since the export |
| Permanent break-glass grants | Conditional grants with an expiry, or Privileged Access Manager | Standing privilege is the attack surface |
| Bind individuals | Bind groups | Offboarding becomes one group change |

## Verification checklist

- [ ] The principal, permission and resource triple was written down.
- [ ] Policy Troubleshooter confirmed the cause before and the fix after.
- [ ] Grants are on the narrowest resource, to groups or SAs, with no basic roles for workloads.
- [ ] No user-managed SA keys remain unless documented with an owner and rotation.
- [ ] Every IAM and org policy change was confirmed by the user.
- [ ] An audit query was run and findings recorded.

## Related

- Knowledge: `cloud-devops`, `cloud-run`, `kubernetes-gke`, `cloud-security-posture`, `secrets-management`, `terraform-iac`, `auth-patterns`.
- Workflows: `/security-scan`.
- Agents: `security-guard`, `cloud-devops-engineer`, `compliance-auditor`.
