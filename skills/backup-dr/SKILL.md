---
name: backup-dr
description: >-
  Designs and proves backups and disaster recovery: RPO and RTO per data tier,
  the 3-2-1 rule with immutable copies, Cloud SQL point-in-time recovery,
  Cloud Storage versioning and retention, disk snapshot schedules, Firestore
  backups, cross-region DR patterns, restore drills and retention policy. Use
  when setting up backups, after a scare, before a compliance audit, or when
  asked "could we recover if this region or database disappeared?"
---

# Backups and Disaster Recovery

A backup that has never been restored is a hope, not a backup. Define RPO and
RTO with the business, automate copies that an attacker or a bad script cannot
delete, and prove recovery with timed drills. Never restore over a live
database: restore to a new instance, verify, then cut over with the user's yes.

## When to use

- New service or data store: deciding what to back up, how often, for how long.
- Auditors or customers ask for RPO, RTO and restore evidence.
- After a near miss: an accidental delete, a ransomware scare, a regional outage.
- Planning multi-region or failover for critical services.

## When not to use

- Recovering from an incident happening right now: run `incident-response`, then use this skill's restore steps.
- Schema changes and rollbacks: use `database-migrations`.
- Retention rules driven by privacy law: use `gdpr-privacy` alongside this skill.
- Database HA and connection setup: use `cloud-sql-alloydb`.

## Workflow

1. **Inventory and tier the data.** List every data store (databases, buckets, disks, queues with state, secrets, IaC state) with its owner. Agree a tier with the business using the table below.

   **Check:** Every store has an owner, a tier, and a written RPO and RTO.

2. **Map current protection and gaps.** For each store record backup type, frequency, retention, location, who can delete backups and the last successful restore.

   **Check:** The gap list names each store whose protection does not meet its tier.

3. **Configure backups (3-2-1).** Three copies, two different media or services, one in another region or project, and at least one immutable.

   ```bash
   # Cloud SQL for PostgreSQL: backups plus PITR (MySQL uses --enable-bin-log; verify against current docs)
   gcloud sql instances patch orders-db --backup-start-time=03:00 --enable-point-in-time-recovery
   # Persistent disks: snapshot schedule
   gcloud compute resource-policies create snapshot-schedule daily-14d --region=europe-west1 \
     --daily-schedule --start-time=04:00 --max-retention-days=14
   gcloud compute disks add-resource-policies data-disk --zone=europe-west1-b --resource-policies=daily-14d
   # Cloud Storage: versioning and soft delete
   gcloud storage buckets update gs://acme-uploads --versioning --soft-delete-duration=7d
   ```

   Firestore supports PITR and scheduled backups (`gcloud firestore backups schedules create`); GKE has Backup for GKE; the Backup and DR service offers backup vaults with enforced retention. Logical exports add a portable copy: `pg_dump -Fc -f app.dump "$DATABASE_URL"` or `mysqldump --single-transaction --routines --triggers app > app.sql`.

   **Check:** Each store's backup frequency is at least as tight as its RPO, and one copy lives outside the primary region.

4. **Protect the backups.** Store copies in a separate project with narrow IAM so a compromised production identity cannot delete them. Use retention policies or vaults with enforced retention for immutability. Locking a bucket retention policy is irreversible; get explicit consent first. If data uses customer-managed keys, protect the keys too: destroying a key destroys every backup encrypted with it.

   **Check:** No production service account can delete or overwrite backup copies.

5. **Design DR for a region loss.** Choose the pattern per tier from the table, codify the target environment in IaC, and write the failover runbook, including DNS or load balancer changes.

   **Check:** The runbook names the trigger, the decision maker, each step and the expected duration.

6. **Run a timed restore drill.** Restore into an isolated project or a new instance, never over production.

   ```bash
   gcloud sql instances clone orders-db orders-db-drill --point-in-time="2026-11-20T09:00:00Z"
   pg_restore --list app.dump > /dev/null && pg_restore -d restore_test --no-owner app.dump
   ```

   Verify row counts, checksums or reconciliation totals against the source, then run the application's smoke tests against the restored copy. Delete drill resources afterwards, with the user's consent.

   **Check:** Measured restore time is within the RTO, data loss within the RPO, and the drill report is saved.

7. **Monitor and repeat.** Alert on failed or missing backups, and on backup age older than the RPO. Drill Tier 0 and 1 at least quarterly and after major changes.

   **Check:** A deliberately skipped backup raises an alert, and the drill calendar has owners.

## Reference

### Tiers and DR patterns

| Tier | Typical RPO | Typical RTO | Pattern |
| :--- | :--- | :--- | :--- |
| 0 critical | Seconds | Minutes | Active-active multi-region, or synchronous replica with automatic failover |
| 1 important | 15 min or less | 1 hour or less | Warm standby: cross-region replica, IaC ready, scaled down |
| 2 standard | 24 hours | 24 hours | Pilot light or backup and restore with IaC |
| 3 archival | Days | Days | Backups only |

Multi-region costs roughly double or more; reserve it for tiers whose downtime cost justifies it.

### Restore drill report

```text
Store: orders-db  Tier: 1  Backup used: PITR 2026-11-20T09:00Z
Started: 10:02 UTC  Usable: 10:41 UTC  RTO target: 60 min  -> PASS
Data check: row counts match for 14/14 tables; ledger totals reconcile
Issues found: replica user missing grants (runbook step 7 updated)
```

### Retention

Keep daily backups for weeks, monthly for a year or as required by contract or regulation. Document that data deleted for privacy requests ages out of backups within the retention window, and restore drills must not resurrect it into production.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Backups in the same project and region | Copy to another project and region | One compromise or outage takes both |
| Restore over production to recover | Restore to a new instance, verify, cut over | A bad restore destroys the remaining good data |
| Count replicas as backups | Keep point-in-time backups too | Replication copies deletes and corruption instantly |
| Never test restores | Timed drills with integrity checks | Backups fail silently: missing grants, bad dumps, lost keys |
| Same admin can delete data and backups | Separate IAM and immutable retention | Ransomware and insiders target backups first |
| Ignore IaC state and secrets | Back up Terraform or Pulumi state and Secret Manager config | You cannot rebuild what you cannot describe |

## Verification checklist

- [ ] Every data store has an owner, tier, RPO and RTO.
- [ ] Copies follow 3-2-1 with one immutable and one off-region.
- [ ] Production identities cannot delete backups.
- [ ] A timed restore drill met RPO and RTO, with a saved report.
- [ ] Alerts fire on failed, missing or stale backups.
- [ ] Restores and irreversible locks had explicit user consent.

## Related

- Agents: `sre-engineer`, `cloud-devops-engineer`, `database-architect`, `compliance-auditor`.
- Workflows: `/postmortem` (after a data-loss incident).
- Knowledge: `cloud-sql-alloydb`, `cloud-storage-gcs`, `firestore-data-modeling`, `incident-response`, `chaos-engineering`, `gdpr-privacy`, `terraform-iac`.
