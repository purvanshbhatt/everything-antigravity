---
name: cloud-security-posture
description: >-
  Finds and fixes cloud misconfigurations: public exposure, over-broad IAM,
  service-account keys, missing org policies and logging gaps, using Security
  Command Center, Cloud Asset Inventory, IAM Recommender, Prowler and IaC
  scanners, with fixes landed through Terraform. Use when auditing a Google
  Cloud (or AWS/Azure) org or project, reviewing least privilege, or setting
  preventive guardrails.
---

# Cloud Security Posture

Most cloud breaches start with a public resource, a leaked long-lived key or a
role far broader than needed. Inventory what exists, close exposure first,
shrink privilege next, then add guardrails so the same mistake cannot recur.

## When to use

- Auditing a Google Cloud organization, folder or project (or an AWS account / Azure subscription).
- Security Command Center or a scanner reports a pile of findings and you need a plan.
- Least-privilege review before an audit (SOC 2, ISO 27001) or after a team change.
- Designing preventive org policies and detective controls for a new landing zone.

## When not to use

- Designing IAM roles and service accounts for a new app: use `gcp-iam`.
- Container and cluster hardening: use `container-security`.
- Writing the Terraform itself: use `terraform-iac`.
- Application code vulnerabilities: use `security-audit`.

## Workflow

1. **Confirm scope and access.** Get the org, folders and projects in scope. Use a read-only identity (Security Reviewer, Cloud Asset Viewer, Recommender Viewer). Every step until step 6 is read-only.

   **Check:** You can list the in-scope projects and the identity you are using has no write roles.

2. **Inventory exposure.**

   ```bash
   gcloud asset search-all-iam-policies --scope=organizations/<ORG_ID> \
     --query="policy:allUsers OR policy:allAuthenticatedUsers"
   gcloud asset search-all-resources --scope=organizations/<ORG_ID> \
     --asset-types="compute.googleapis.com/Instance,sqladmin.googleapis.com/Instance"
   gcloud compute firewall-rules list --filter="sourceRanges:0.0.0.0/0" --project=<PROJECT>
   ```

   **Check:** You have a list of every public principal binding, internet-open firewall rule and public IP, each tagged intended or unintended.

3. **Pull managed findings.** Enable Security Command Center (Standard at minimum) and export active findings by severity. Run an open-source scanner for a second view (`prowler gcp`, `prowler aws`, `prowler azure`; see `--help` for scoping flags). Scan IaC with `trivy config .` or `checkov -d .`. Command syntax for `gcloud scc` changes between versions; check `gcloud scc findings list --help`.

   **Check:** Findings are deduplicated into one table: resource, issue, severity, exposure, owner.

4. **Review privilege.**

   ```bash
   gcloud recommender recommendations list --project=<PROJECT> --location=global \
     --recommender=google.iam.policy.Recommender
   gcloud iam service-accounts keys list --iam-account=<SA_EMAIL> --managed-by=user
   gcloud asset analyze-iam-policy --organization=<ORG_ID> --identity="user:<EMAIL>"
   ```

   Flag basic roles (Owner, Editor) on humans and service accounts, user-managed keys, default compute service accounts with Editor, and cross-project grants nobody can explain.

   **Check:** Each high-privilege grant has a named owner and justification, or is on the removal list.

5. **Prioritize by exploitability.** Order: public data or compute exposure, then long-lived keys, then admin-level privilege, then missing logging, then hygiene. Use the severity rubric in `security-audit`.

   **Check:** The top ten items are understood by the resource owners.

6. **Fix through code, with confirmation.** Change IAM, firewall and bucket settings in Terraform (or the team's IaC), not the console. Show the plan diff and ask the user for explicit confirmation before applying, because removing a binding or rule can break production. Stage risky removals: monitor usage (IAM Recommender, audit logs) before removal.

   **Check:** Each fix is a reviewed IaC change; `terraform plan` shows no drift afterwards.

7. **Add preventive guardrails.** Apply org policies at the org or folder level (table below), starting in dry-run where supported, and VPC Service Controls around sensitive data projects.

   **Check:** Recreating a fixed misconfiguration in a sandbox project is denied by policy.

8. **Make it continuous.** Route High/Critical SCC findings to on-call or tickets, schedule a monthly IAM review, and add IaC scanning to CI.

## Reference

### Org policy constraints worth enforcing (verify names in current docs)

| Constraint | Prevents |
| :--- | :--- |
| `iam.disableServiceAccountKeyCreation` | New long-lived service-account keys |
| `iam.allowedPolicyMemberDomains` | Grants to identities outside your domains |
| `storage.publicAccessPrevention` | Public buckets and objects |
| `storage.uniformBucketLevelAccess` | Object ACLs that bypass IAM |
| `compute.vmExternalIpAccess` | VMs with external IPs |
| `sql.restrictPublicIp` | Cloud SQL instances with public IP |
| `compute.requireOsLogin` | Unmanaged SSH keys on VMs |
| `compute.skipDefaultNetworkCreation` | Permissive default VPCs in new projects |
| `iam.automaticIamGrantsForDefaultServiceAccounts` | Editor granted to default service accounts |

Newer organizations may already have some of these enforced by default; check with `gcloud org-policies list --organization=<ORG_ID>`.

### Equivalent services on other clouds

| Need | Google Cloud | AWS | Azure |
| :--- | :--- | :--- | :--- |
| Posture findings | Security Command Center | Security Hub, AWS Config | Defender for Cloud |
| Unused access | IAM Recommender, Policy Analyzer | IAM Access Analyzer | Entra access reviews |
| Preventive policy | Organization Policy Service | Service Control Policies | Azure Policy |
| Threat detection | SCC threat detection | GuardDuty | Defender plans |

### Logging must-haves

Admin Activity audit logs are always on; enable Data Access audit logs for sensitive services (they cost money), keep an org-level log sink to a locked bucket or BigQuery dataset, and alert on IAM policy changes and key creation.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Fix findings in the console | Change IaC, review, apply | Console fixes drift back on the next apply |
| Remove "unused" roles blindly | Check Recommender and audit logs, then stage removal | Rarely used roles often back batch jobs and break-glass paths |
| Grant Editor to a service account to unblock a deploy | Grant the specific predefined role | Editor on a service account is project takeover via that workload |
| Rotate service-account keys forever | Eliminate keys with Workload Identity Federation | The safest key is one that does not exist |
| Treat every finding as equal | Rank by internet exposure and data sensitivity | Teams burn out on hygiene while public data stays public |
| Enforce new org policies org-wide at once | Dry-run, fix violators, then enforce by folder | Sudden enforcement breaks running workloads |

## Verification checklist

- [ ] Scope and read-only identity confirmed before any scan.
- [ ] Public bindings, open firewall rules and public IPs inventoried and tagged.
- [ ] Findings from SCC and an independent scanner deduplicated and ranked.
- [ ] Basic roles and user-managed keys removed or justified with owners.
- [ ] Fixes landed through IaC after explicit user confirmation.
- [ ] Preventive org policies and alerting are in place.

## Related

- Knowledge: `gcp-iam`, `terraform-iac`, `container-security`, `cloud-networking`, `secrets-management`, `aws-essentials`, `azure-essentials`, `security-audit`.
- Workflows: `/threat-modeling`, `/security-scan`.
- Agents: `security-guard`, `cloud-devops-engineer`, `compliance-auditor`.
