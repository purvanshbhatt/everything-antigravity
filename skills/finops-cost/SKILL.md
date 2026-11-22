---
name: finops-cost
description: >-
  Controls cloud spend with FinOps practice, Google Cloud first: billing export
  to BigQuery, label-based cost allocation, budgets and alerts, idle and
  rightsizing recommendations, committed use and Spot discounts, the usual cost
  drivers (logging, egress, BigQuery scans, idle capacity) and unit costs per
  request, tenant or user. Use when the bill jumps, before buying commitments,
  when setting budgets, or when asked what a feature or customer costs.
---

# FinOps and Cloud Cost

Make cost visible, owned and explained per unit of business value, then cut
waste before buying discounts. The agent analyses and proposes. Deleting
resources, resizing production and purchasing commitments are the user's
decisions and need an explicit yes.

## When to use

- The bill rose and nobody knows why, or a cost anomaly alert fired.
- Setting up cost visibility: billing export, labels, budgets, dashboards.
- Rightsizing, cleaning idle resources, or deciding on committed use discounts.
- Answering "what does this feature, tenant or request cost us?"

## When not to use

- LLM token spend and model choice: use `llm-cost-routing`.
- Pricing your own product to customers: use `pricing-strategy` or `unit-economics`.
- BigQuery query and table design in depth: use `bigquery`.
- Architecture decisions where cost is one factor among many: use `software-architecture` and bring this skill's numbers.

## Workflow

1. **Turn on detailed visibility.** Enable Cloud Billing export to BigQuery (standard usage cost, plus detailed and pricing exports) in the Cloud Billing console. Data accrues only from the day it is enabled, so do this first.

   **Check:** A table named like `gcp_billing_export_v1_<BILLING_ACCOUNT_ID>` exists and has rows for the last day.

2. **Find the drivers.** Query net cost (cost plus credits) by service, SKU, project and month.

   ```sql
   SELECT
     invoice.month,
     service.description AS service,
     sku.description AS sku,
     ROUND(SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)), 2) AS net_cost
   FROM `billing.gcp_billing_export_v1_XXXXXX`
   WHERE invoice.month IN ('202610', '202611')
   GROUP BY 1, 2, 3
   ORDER BY net_cost DESC
   LIMIT 30;
   ```

   **Check:** The top 10 SKUs explain most of the spend, and month-over-month deltas are listed.

3. **Allocate with labels.** Require `team`, `env`, `service` and `cost-center` on every labelable resource, enforced in IaC (`default_labels` in Terraform, a stack transformation in Pulumi). Measure coverage:

   ```sql
   SELECT IFNULL((SELECT value FROM UNNEST(labels) WHERE key = 'team'), 'UNLABELLED') AS team,
          ROUND(SUM(cost), 2) AS cost
   FROM `billing.gcp_billing_export_v1_XXXXXX`
   WHERE invoice.month = '202611'
   GROUP BY team ORDER BY cost DESC;
   ```

   **Check:** Unlabelled spend is under 10 percent, and each team has a named cost owner.

4. **Set budgets and alerts.** Budgets alert; they do not stop spending.

   ```bash
   gcloud billing budgets create --billing-account=BILLING_ACCOUNT_ID \
     --display-name="prod monthly" --budget-amount=5000USD \
     --filter-projects=projects/acme-prod \
     --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 \
     --threshold-rule=percent=1.0,basis=forecasted-spend
   ```

   Verify flags against current gcloud docs. In PowerShell replace the trailing `\` with a backtick. For automated reactions, connect the budget to a Pub/Sub topic.

   **Check:** Each production project has a budget with actual and forecast thresholds routed to its owner.

5. **Remove waste.** List candidates, show them to the user and delete only what they approve.

   ```bash
   gcloud compute disks list --filter="-users:*" --format="table(name,zone,sizeGb)"
   gcloud compute addresses list --filter="status=RESERVED"
   gcloud recommender recommendations list --project=acme-prod --location=us-central1-a \
     --recommender=google.compute.instance.IdleResourceRecommender
   ```

   Other recommenders cover machine types, idle disks and commitments; check the Recommender docs for current IDs. Snapshot a disk before deleting it if the owner is unsure.

   **Check:** Each candidate is marked keep, resize or delete by its owner; savings are estimated per item.

6. **Rightsize, then commit.** Resize from at least two weeks of utilisation data. Only then consider committed use discounts (resource-based or spend-based) for the stable baseline, and Spot VMs for interruptible batch work. Model the break-even; the user decides on any purchase.

   **Check:** The commitment covers a baseline below the minimum steady usage of the last 30 to 90 days.

7. **Report unit costs.** Divide labelled service cost by a business metric (requests, active users, tenants, orders) and track the trend monthly.

   **Check:** A dashboard shows cost per unit over time, and each owner reviews it monthly.

## Reference

### Common Google Cloud cost drivers

| Driver | Check | Lever |
| :--- | :--- | :--- |
| Idle or oversized VMs | Recommender, utilisation | Rightsize, schedule dev shutdown, Spot for batch |
| Cloud Run | Min instances, CPU always allocated | Min instances 0 off-peak, request-based billing where latency allows |
| GKE | Requests vs actual usage | Rightsize requests, cluster autoscaler, Autopilot for spiky teams |
| Cloud SQL | HA and size in non-prod | Smaller tiers and no HA in dev, stop when idle |
| Cloud Logging | Ingestion volume by log name | Exclusion filters on debug and health-check logs, sampling |
| BigQuery on-demand | Bytes scanned per query | Partition and cluster, `--maximum_bytes_billed`, avoid `SELECT *` |
| Network egress | Cross-region and internet SKUs | Co-locate services and data, CDN for static content |
| Cloud Storage | Class and age of objects | Lifecycle rules, Autoclass, delete old versions |
| Artifact Registry | Old image versions | Cleanup policies |

### Other clouds

AWS: Cost Explorer, Cost and Usage Reports, Budgets, Compute Optimizer, Savings Plans. Azure: Cost Management exports, budgets, Advisor, reservations and savings plans. The workflow is the same; table and field names differ.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Buy commitments first | Remove waste and rightsize, then commit to the baseline | You lock in paying for waste for 1 to 3 years |
| Treat budgets as caps | Alert owners; automate shutdowns only for non-prod | Budgets notify; spending continues |
| Optimise the biggest number blindly | Rank by savings per effort and risk | A 2 percent saving on a critical database can cost an outage |
| Central team owns every cost | Labels plus a named owner per team | People optimise what they see and own |
| Delete "unused" resources on sight | Confirm with the owner, snapshot first | Idle by metric is not always unneeded |
| Report total cost only | Report cost per unit of value | Growth raises totals; efficiency is the real signal |

## Verification checklist

- [ ] Billing export to BigQuery is on and queried, not just the console view.
- [ ] Label coverage measured; unlabelled spend under 10 percent or a plan to get there.
- [ ] Budgets with actual and forecast thresholds exist for every production project.
- [ ] Every deletion, resize or purchase had explicit user approval.
- [ ] Savings estimates and unit costs are recorded and re-checked next month.

## Related

- Agents: `cloud-devops-engineer`, `data-analyst`.
- Knowledge: `bigquery`, `llm-cost-routing`, `unit-economics`, `terraform-iac`, `cloud-run`, `kubernetes-gke`, `observability-otel`, `cloud-storage-gcs`.
