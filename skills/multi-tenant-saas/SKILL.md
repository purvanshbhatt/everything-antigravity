---
name: multi-tenant-saas
description: >-
  Designs multi-tenant SaaS: pool, bridge and silo isolation models, tenant
  resolution and context propagation, Postgres row-level security,
  tenant-aware caches, search, storage and jobs, noisy-neighbor quotas,
  per-tenant encryption keys, onboarding and offboarding, and usage metering
  for billing. Use when adding tenancy to an app, choosing shared vs dedicated
  databases, or auditing for cross-tenant data leaks.
---

# Multi-Tenant SaaS

The defining bug of multi-tenant systems is one customer seeing another's
data, and it rarely comes from the main query path. It comes from a cache key,
a background job, a search index, an export or an admin tool that forgot the
tenant. Pick an isolation model per tier, make the tenant context impossible
to omit, and test for leaks across every storage layer.

## When to use

- Turning a single-customer app into SaaS, or adding organizations and workspaces.
- Choosing between shared tables, schema per tenant and dedicated deployments.
- Enterprise customers ask for data residency, dedicated infrastructure or their own keys.
- One tenant's load degrades others; or a security review asks how isolation is enforced.

## When not to use

- User authentication, sessions and SSO mechanics: use `auth-patterns`.
- General schema design and indexing: use `database-design` and `postgres-patterns`.
- Pricing and packaging decisions: use `pricing-strategy`; payment integration: `payments-stripe`.
- Regulatory obligations: `gdpr-privacy` and `soc2-compliance` (not legal advice).

## Workflow

1. **Choose isolation per tier.** Use the model table below. Most products run pooled for self-serve tiers and offer bridge or silo for enterprise. Record the choice and the upgrade path between models with `/architecture-decision`.

   **Check:** The ADR states which tiers map to which model and how a tenant moves between them.

2. **Resolve the tenant once, from a trusted source.** Derive it from the authenticated identity (a token claim or membership lookup), or from a verified subdomain or custom domain mapped server-side. Never trust a tenant ID from the request body or an unverified header. Users in several tenants select one explicitly, and the server checks membership.

   **Check:** Changing a tenant ID in a request body or URL returns 404 for resources of another tenant.

3. **Propagate tenant context everywhere.** Store it in request-scoped context (AsyncLocalStorage, `contextvars`, `context.Context`) and carry it into logs, traces, job payloads and message attributes. Workers re-establish the context from the job before touching data.

   **Check:** Every log line and job record for a request includes `tenant_id`.

4. **Enforce isolation in the database, not only in code.** Pool model: `tenant_id` on every tenant-owned table, leading every composite index and every unique constraint (`UNIQUE (tenant_id, email)`), plus Postgres row-level security as a backstop. The application role must not own tables or have `BYPASSRLS`. Set the tenant per transaction (`SET LOCAL`), which also works with transaction-mode poolers.

   **Check:** With no tenant set, queries as the app role return zero rows or fail; they never return data.

5. **Make every other store tenant-aware.** Cache keys prefixed `t:{tenant}:`; search documents carry `tenant_id` with a server-enforced filter (or tenant tokens); object storage paths `tenants/<id>/...` with per-tenant access checks on signed URLs; queues fair across tenants; analytics exports filtered. Admin and support tools use audited impersonation, never raw cross-tenant queries.

   **Check:** A two-tenant integration test reads every endpoint, export, search and file download as tenant A with tenant B's IDs and gets nothing.

6. **Contain noisy neighbors.** Per-tenant rate limits and quotas (requests, storage, seats, jobs), per-tenant concurrency caps in workers, statement timeouts, and separate pools or silos for the heaviest tenants. Expose usage to tenants before you enforce limits.

   **Check:** A load test from one tenant at 10x its quota leaves other tenants' p95 latency within SLO.

7. **Encrypt to the isolation promise.** Shared keys for pooled tiers; per-tenant keys (Cloud KMS, customer-managed keys) for enterprise; destroying a tenant's key (crypto-shredding) supports offboarding where backups cannot be edited.

   **Check:** The key hierarchy and key-to-tenant mapping are documented and tested in a restore drill.

8. **Automate the lifecycle.** Onboarding provisions records, defaults, DNS and limits idempotently. Offboarding exports data, then deletes it on a documented schedule including caches, indexes, files and backups (or their keys). Deleting a tenant's data is irreversible: require explicit confirmation and a dry-run listing.

   **Check:** Provisioning and deprovisioning a test tenant leave no orphaned rows, files or index documents.

9. **Meter usage for billing.** Emit usage events (`tenant_id`, metric, quantity, timestamp, idempotency key) to an append-only ledger, aggregate per billing period, and report to the billing provider from the ledger so re-runs do not double-bill.

   **Check:** Replaying a day's usage events produces the same invoice totals.

## Patterns

### Isolation models

| Model | Shape | Strengths | Costs |
| :--- | :--- | :--- | :--- |
| Pool | Shared tables with `tenant_id` | Cheapest, simplest operations, easy cross-tenant analytics | Leak risk; noisy neighbors; per-tenant restore is hard |
| Bridge | Schema or database per tenant on shared servers | Per-tenant backup and restore, clearer isolation | Migrations fan out to every schema; connection count grows |
| Silo | Dedicated stack or project per tenant | Strongest isolation, residency, custom keys | Highest cost; fleet management and upgrades |

### Postgres row-level security

```sql
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;          -- applies to the table owner too
CREATE POLICY tenant_isolation ON invoices
  USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Per request, inside the transaction (parameterized from the app):
SELECT set_config('app.tenant_id', $1, true);          -- true = local to this transaction
```

With `missing_ok` set to `true`, a never-set tenant yields NULL and matches no rows; once set earlier in the session it reverts to an empty string, which fails the `uuid` cast. Either way a missing context fails closed. Superusers and roles with `BYPASSRLS` skip policies; keep migrations and app traffic on different roles.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Accept `tenantId` from the client body | Derive from identity, verify membership | Trivial cross-tenant access |
| Rely only on `WHERE tenant_id = ?` in code | Code filter plus RLS backstop | One forgotten filter leaks data |
| Unique constraints without `tenant_id` | `UNIQUE (tenant_id, ...)` | Tenants collide and existence leaks via errors |
| Cache keys without a tenant prefix | `t:{tenant}:...` keys | One tenant is served another's cached data |
| Jobs that run without tenant context | Tenant in payload, context restored in worker | Background paths bypass isolation |
| Global limits only | Per-tenant quotas and fair queues | One tenant degrades everyone |
| Delete tenants by hand | Scripted, confirmed offboarding with dry run | Orphans and accidental deletes |

## Verification checklist

- [ ] Isolation model per tier is recorded in an ADR.
- [ ] Tenant comes only from trusted identity or verified domain mapping.
- [ ] RLS (or schema or database separation) backs up application filters; app role cannot bypass it.
- [ ] Caches, search, storage, jobs, exports and admin tools are tenant-scoped and leak-tested.
- [ ] Per-tenant quotas and fair scheduling are load-tested.
- [ ] Onboarding, offboarding and usage metering are automated, idempotent and audited.

## Related

- Knowledge: `postgres-patterns`, `auth-patterns`, `database-design`, `redis-caching`, `search-engines`, `payments-stripe`, `secrets-management`, `api-security`, `gdpr-privacy`, `soc2-compliance`.
- Workflows: `/threat-modeling`, `/architecture-decision`.
- Agents: `security-guard`, `database-architect`, `compliance-auditor`.
