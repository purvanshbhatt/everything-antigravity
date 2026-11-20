# Plan Review

Companion to the `terraform-iac` skill. A plan is reviewed when every
replacement, destroy and permission change has been read and explained to the
user, and nothing in it is a surprise.

## Reading the symbols

| Symbol | Meaning | Risk |
| :--- | :--- | :--- |
| `+` | create | Low; check names, regions and cost |
| `~` | update in place | Usually low; read every changed attribute |
| `-` | destroy | High; confirm intent with the user |
| `-/+` | destroy, then create (replacement) | Highest: downtime and data loss for stateful resources |
| `+/-` | create, then destroy (`create_before_destroy`) | Medium; check for name collisions and quota |
| `<=` | read a data source | Low; may reveal drift if it changes every run |

Any line containing `# forces replacement` names the attribute that triggered a
`-/+`. Values shown as `(known after apply)` on IDs can cascade replacements
into dependent resources; follow them.

## Review order

1. The `Plan: X to add, Y to change, Z to destroy.` line. If Z > 0, stop and
   list each destroyed address.
2. Every `-/+` and `+/-`, with its `forces replacement` attribute.
3. IAM resources (`*_iam_*`), service accounts, firewall rules, VPC and routing,
   organization policies.
4. Stateful resources: databases, buckets, disks, Pub/Sub subscriptions, KMS keys.
5. Changes to resources the code change did not touch. These are drift or a
   provider upgrade; explain them before applying.
6. Anything that changes on every run (perpetual diff): usually an API
   normalizing a value; fix with the canonical value or a narrow `ignore_changes`.

## Extract the risky actions

```bash
# bash + jq: every non-no-op action
jq -r '.resource_changes[] | select(.change.actions != ["no-op"]) | "\(.change.actions | join("/"))\t\(.address)"' plan.json
# only deletes and replacements
jq -r '.resource_changes[] | select(.change.actions | index("delete")) | .address' plan.json
```

```powershell
# PowerShell
$plan = Get-Content plan.json -Raw | ConvertFrom-Json
$plan.resource_changes |
  Where-Object { $_.change.actions -contains 'delete' } |
  ForEach-Object { '{0}  {1}' -f ($_.change.actions -join '/'), $_.address }
```

## Summary to present before asking for consent

```markdown
**Plan for envs/prod (state: gs://acme-tfstate-prod/platform/network)**
- 3 to add, 2 to change, 1 to destroy
- Replacements: google_compute_instance.bastion (forces replacement: zone)
- Destroys: google_compute_firewall.legacy_ssh
- IAM: + roles/run.invoker for serviceAccount:frontend@...
- Unexpected: none
Apply `tfplan` exactly as reviewed? (yes/no)
```

## Common replacement triggers on Google Cloud

| Resource | Attributes that typically force replacement |
| :--- | :--- |
| `google_storage_bucket` | `name`, `location` |
| `google_sql_database_instance` | `name`, `region` |
| `google_container_cluster` | `name`, `location` |
| `google_compute_instance` | `name`, `zone`, boot disk source image |
| `google_service_account` | `account_id` |
| `google_container_node_pool` | Some `node_config` fields; which ones varies by provider version |

The provider docs mark these per attribute; always trust the plan output over
this table.

## Rules for flags

- `-target=ADDR`: recovery only, never routine. It skips dependencies and leaves
  the rest of the plan unreviewed; follow it with a full plan.
- `-replace=ADDR`: the explicit way to force a replacement (instead of
  `terraform taint`). Still needs consent.
- `-refresh=false`: only for speed in local iteration; never for the plan you apply.
- `-lock=false`: never against shared state.

## After apply

- Run `terraform plan -detailed-exitcode`; anything other than exit `0` means
  the apply did not converge or something else changed state.
- Delete local `tfplan`, `plan.json` and `plan.txt`: they contain sensitive values.
- Record what changed in the walkthrough artifact or PR description.
