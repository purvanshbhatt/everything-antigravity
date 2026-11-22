---
name: cloud-sql-alloydb
description: >-
  Runs managed PostgreSQL and MySQL on Google Cloud: choosing Cloud SQL
  editions or AlloyDB, sizing, high availability, private IP, connecting via
  Auth Proxy or language connectors with IAM database auth, connection
  budgets, backups and point-in-time recovery, read replicas and pools, and
  migrations and upgrades. Use when creating, connecting to, sizing, restoring
  or migrating a Cloud SQL or AlloyDB database.
---

# Cloud SQL and AlloyDB

Provision managed databases on private IP with HA, backups and deletion
protection from day one, connect with IAM identities instead of passwords, size
connection pools against `max_connections`, and rehearse restores before you
need them.

## When to use

- Creating a Cloud SQL or AlloyDB instance, or choosing between them.
- Connection errors, "too many connections", or connecting from Cloud Run, GKE or a laptop.
- Backups, point-in-time recovery, clones, read replicas, failover tests.
- Migrating into Cloud SQL/AlloyDB, or a major version upgrade.

## When not to use

- Schema design and indexing: use `database-design` and `postgres-patterns`.
- Query tuning from plans: use `sql-optimization`.
- Schema migration tooling and expand/contract: use `database-migrations`.
- Document data: use `firestore-data-modeling`; analytics: use `bigquery`.

## Workflow

Commands use bash continuations (`\`). In PowerShell use a backtick or one line. Creating, resizing, failing over, restoring and deleting instances cost money or cause downtime: get explicit user confirmation for each.

1. **Choose the engine and size.**

   | Need | Choice |
   | :--- | :--- |
   | Standard OLTP, Postgres/MySQL/SQL Server | Cloud SQL Enterprise |
   | Higher performance, faster maintenance, data cache | Cloud SQL Enterprise Plus |
   | Postgres with heavy reads, analytics on live data, large scale | AlloyDB (read pools, columnar engine) |

   Start from measured CPU, memory and IOPS; for new apps begin small (2 vCPU) with storage auto-increase and resize later.

   **Check:** The choice, tier and estimated monthly cost were agreed with the user.

2. **Prepare private networking.** Private IP needs private services access on the VPC (once per VPC):

   ```bash
   gcloud compute addresses create google-managed-services-VPC --global \
     --purpose=VPC_PEERING --prefix-length=16 --network=VPC
   gcloud services vpc-peerings connect --service=servicenetworking.googleapis.com \
     --ranges=google-managed-services-VPC --network=VPC
   ```

   Private Service Connect is the alternative when peering ranges are scarce; see `cloud-networking`.

   **Check:** `gcloud services vpc-peerings list --network=VPC` shows the peering.

3. **Create the instance with production defaults.**

   ```bash
   gcloud sql instances create app-pg --database-version=POSTGRES_16 \
     --edition=enterprise --tier=db-custom-2-8192 --region=REGION \
     --availability-type=REGIONAL \
     --network=projects/PROJECT_ID/global/networks/VPC --no-assign-ip \
     --backup-start-time=03:00 --enable-point-in-time-recovery --retained-backups-count=14 \
     --maintenance-window-day=SUN --maintenance-window-hour=2 \
     --database-flags=cloudsql.iam_authentication=on \
     --insights-config-query-insights-enabled --storage-auto-increase --deletion-protection
   gcloud sql users set-password postgres --instance=app-pg --prompt-for-password
   ```

   Check supported `--database-version` values in the current docs. Let the user type the admin password at the prompt.

   AlloyDB equivalent (the cluster create needs an initial password; read it from a variable the user sets):

   ```bash
   gcloud alloydb clusters create app-cluster --region=REGION --network=VPC --password="$ALLOYDB_PASSWORD"
   gcloud alloydb instances create app-primary --cluster=app-cluster --region=REGION \
     --instance-type=PRIMARY --cpu-count=2 --availability-type=REGIONAL
   gcloud alloydb instances create app-read --cluster=app-cluster --region=REGION \
     --instance-type=READ_POOL --cpu-count=2 --read-pool-node-count=2
   ```

   **Check:** `gcloud sql instances describe app-pg --format="value(settings.availabilityType,settings.backupConfiguration.enabled,ipAddresses)"` shows `REGIONAL`, `True` and only a private address.

4. **Connect with IAM database auth.** Grant the runtime service account `roles/cloudsql.client` and `roles/cloudsql.instanceUser`, then create the DB user (Postgres drops `.gserviceaccount.com`):

   ```bash
   gcloud sql users create api-runtime@PROJECT_ID.iam --instance=app-pg --type=cloud_iam_service_account
   ```

   Then `GRANT` only the needed schema privileges in SQL. From the app, use a connector (Python `cloud-sql-python-connector`, Java Cloud SQL socket factory, Go `cloud.google.com/go/cloudsqlconn`, Node `@google-cloud/cloud-sql-connector`) with IAM auth enabled. From Cloud Run, the connector or `--add-cloudsql-instances` (Unix socket at `/cloudsql/PROJECT_ID:REGION:app-pg`).

   **Check:** The app connects without any password in config or Secret Manager.

5. **Connect from a laptop through the Auth Proxy.**

   ```bash
   cloud-sql-proxy --auto-iam-authn --private-ip PROJECT_ID:REGION:app-pg --port 5432
   alloydb-auth-proxy projects/PROJECT_ID/locations/REGION/clusters/app-cluster/instances/app-primary
   ```

   On Windows run `cloud-sql-proxy.exe` with the same arguments. Private IP requires a network path (VPN, IAP tunnel to a bastion, or Cloud Shell in the VPC).

   **Check:** `psql "host=127.0.0.1 user=YOU@example.com dbname=app"` connects using your IAM identity.

6. **Budget connections.** `max_instances x pool_size per instance + admin headroom <= max_connections`. Cap Cloud Run `--max-instances` and GKE replicas accordingly, or add a pooler (PgBouncer, or managed connection pooling where your edition offers it; verify).

   **Check:** Under load test, peak connections stay below 80% of `max_connections`.

7. **Prove backups and recovery.**

   ```bash
   gcloud sql backups create --instance=app-pg --description="pre-change"
   gcloud sql backups list --instance=app-pg
   gcloud sql instances clone app-pg app-pg-restore-test --point-in-time="2026-11-20T10:00:00.000Z"
   ```

   Restore drills go to a clone; `gcloud sql backups restore BACKUP_ID --restore-instance=TARGET` overwrites the target and needs explicit confirmation. Delete drill clones afterwards (confirm).

   **Check:** A clone came up, the app's smoke queries pass against it, and the measured restore time is recorded as the RTO.

8. **Migrate and upgrade safely.** Use Database Migration Service for continuous replication from on-prem or other clouds with a short cutover; `pg_dump` / `gcloud sql import sql app-pg gs://BUCKET/dump.sql --database=app` for small datasets (the instance service account from `gcloud sql instances describe app-pg --format="value(serviceAccountEmailAddress)"` needs read access to the bucket). For major versions, rehearse `gcloud sql instances patch CLONE --database-version=NEW_VERSION` on a clone first, take a backup, then upgrade production in a window.

   **Check:** The rehearsal on a clone succeeded and app tests passed against it before production was touched.

## Reference

### Operations cheat sheet

| Task | Command |
| :--- | :--- |
| Read replica | `gcloud sql instances create app-pg-r1 --master-instance-name=app-pg --region=REGION` |
| Test HA failover (downtime) | `gcloud sql instances failover app-pg` |
| Stop a dev instance | `gcloud sql instances patch app-pg-dev --activation-policy=NEVER` |
| Export | `gcloud sql export sql app-pg gs://BUCKET/app.sql.gz --database=app` |
| Operations log | `gcloud sql operations list --instance=app-pg --limit=10` |

### Common errors

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| `FATAL: remaining connection slots are reserved` | Pool sizes x instances exceed `max_connections` | Cap instances, shrink pools, add a pooler |
| Connection timeout from Cloud Run | No VPC path to private IP | Direct VPC egress or connector with `--private-ip` |
| IAM login fails | Flag off, missing `instanceUser` role, or wrong username format | Enable `cloudsql.iam_authentication`, grant role, drop `.gserviceaccount.com` |
| Import permission denied | Instance SA cannot read the bucket | Grant it `roles/storage.objectViewer` on that bucket |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Public IP with authorized networks `0.0.0.0/0` | Private IP plus Auth Proxy or connectors | Exposed databases are scanned within minutes |
| Static DB passwords in env vars | IAM database authentication | No rotation burden, per-identity audit |
| Zonal instances for production | `--availability-type=REGIONAL` | Zone failure becomes an outage |
| Trust backups you have never restored | Scheduled clone-restore drills | Untested backups fail when needed |
| Upgrade the major version in place first | Rehearse on a clone | Extensions and planner changes break apps |
| Leave dev instances running | `--activation-policy=NEVER` off-hours | Instances bill 24/7 |

## Verification checklist

- [ ] Engine, tier and cost were agreed; instance is private, regional HA, deletion-protected.
- [ ] Backups and PITR are on; a clone restore was rehearsed and timed.
- [ ] Apps connect with IAM auth through a connector or the proxy; no DB passwords in config.
- [ ] Connection budget is computed and enforced by instance caps or a pooler.
- [ ] Every create, resize, failover, restore and delete was confirmed by the user.

## Related

- Knowledge: `postgres-patterns`, `mysql-mariadb`, `database-design`, `database-migrations`, `sql-optimization`, `backup-dr`, `cloud-networking`, `gcp-iam`, `cloud-run`, `vector-databases`.
- Agents: `database-architect`, `cloud-devops-engineer`, `sql-reviewer`.
