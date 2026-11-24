---
name: mongodb
disable-model-invocation: true
description: >-
  Models and operates MongoDB: embed-versus-reference decisions, schema design
  patterns, compound indexes with the ESR rule, explain plans, aggregation
  pipelines, multi-document transactions, schema validation, sharding keys, and
  Atlas operations (Performance Advisor, backups, network and user access).
  Use when designing collections, writing aggregations, fixing slow MongoDB
  queries, or running an Atlas cluster.
---

# MongoDB

Model documents around how the application reads them, index for the exact
query shapes you run, and let `explain("executionStats")` decide whether an
index works. MongoDB is flexible at write time and unforgiving at read time if
the model ignores access patterns.

## When to use

- Designing collections, choosing what to embed and what to reference.
- A query or aggregation is slow, or `COLLSCAN` shows up in logs or the profiler.
- Writing aggregation pipelines, transactions or `$jsonSchema` validation.
- Choosing a shard key, or operating a MongoDB Atlas cluster.

## When not to use

- Firestore on Google Cloud: use `firestore-data-modeling` (similar ideas, different limits and billing).
- Relational data with heavy cross-entity joins and constraints: use `database-design` and `postgres-patterns`.
- Vector search over embeddings: use `vector-databases`.

## Workflow

1. **List the access patterns.** For each screen or API call: the filter, sort, projection, frequency, and whether related data is read together.

   **Check:** Every collection maps to named queries, and you know which ones are hot.

2. **Choose the document shape** with the rules below. Write a sample document for each collection and estimate its maximum size.

   **Check:** No document can grow without bound, and every document stays well under the 16 MB limit.

3. **Add validation.** Enforce required fields and types with a `$jsonSchema` validator. Use `validationLevel: "moderate"` when existing documents may not comply yet.

   ```javascript
   db.createCollection("orders", { validator: { $jsonSchema: {
     bsonType: "object", required: ["customerId", "status", "createdAt"],
     properties: { status: { enum: ["pending", "paid", "shipped"] }, total: { bsonType: "decimal" } } } } })
   ```

   **Check:** An insert missing `status` fails in `mongosh`.

4. **Index each hot query with ESR order** (Equality, Sort, Range), then prove it.

   ```javascript
   db.orders.createIndex({ customerId: 1, createdAt: -1, total: 1 })
   db.orders.find({ customerId: id, total: { $gt: 100 } }).sort({ createdAt: -1 }).explain("executionStats")
   ```

   **Check:** The winning plan is `IXSCAN` with no blocking `SORT` stage, and `totalDocsExamined` is close to `nReturned`.

5. **Clean up indexes.** `db.orders.aggregate([{ $indexStats: {} }])` shows usage. Hide a suspect index (`db.orders.hideIndex("name")`) before dropping it.

   **Check:** Each remaining index serves a named query.

6. **Operate safely.** Before destructive operations (dropping collections or indexes, `reshardCollection`, restores over live data), confirm a recent backup or snapshot and get explicit user confirmation.

   **Check:** The user approved the operation and a restore point exists.

## Patterns

### Embed or reference

| Embed when | Reference when |
| :--- | :--- |
| Data is read together with the parent | Data is read independently or by many parents |
| One-to-few, bounded (addresses, line items) | One-to-many unbounded (comments, events, logs) |
| Child has no life of its own | Child is updated often by different writers |

### Schema design patterns

| Pattern | Use for |
| :--- | :--- |
| Subset | Keep the latest N children embedded; the full history lives in another collection |
| Extended reference | Copy a few stable fields of the referenced document (name, not price) to avoid `$lookup` |
| Bucket | Group time-series points per entity per hour or day; or use native time series collections |
| Computed | Maintain counters or totals on write instead of aggregating on every read |
| Outlier | Flag the rare oversized parent and overflow its children into a separate collection |
| Schema versioning | `schemaVersion` field; migrate lazily on read or in batches |

### Aggregation pipelines

- Put `$match` and `$project` first so they can use indexes and shrink documents; a `$sort` immediately after `$match` can use an index too.
- `$lookup` is a per-document join: index the foreign field, and prefer an extended reference for hot paths.
- Stages over the per-stage memory limit (100 MB) spill to disk only when disk use is allowed; check your server version's default.
- `$facet` runs sub-pipelines on the same input; `$merge` writes results incrementally into a collection (on-demand materialized views).
- Check a pipeline with `db.orders.explain("executionStats").aggregate([...])`.

### Transactions

Multi-document transactions require a replica set or sharded cluster and default to a 60-second lifetime. Use the driver's callback API (`session.withTransaction(...)`), which retries `TransientTransactionError` and unknown commit results. Keep them small; a model that needs transactions on every request usually should embed instead. Use write concern `majority` for data that must survive failover.

### Sharding and scale

A shard key needs high cardinality, even frequency and non-monotonic writes. A monotonically increasing key (timestamp, ObjectId) sends all inserts to one shard; use a hashed key or a compound key that leads with a well-distributed field. Every hot query should include the shard key, or it becomes a scatter-gather across all shards. Changing a key later needs `reshardCollection` (5.0+), which is heavy.

### Atlas operations

- Network access lists or private endpoints only, never `0.0.0.0/0`. One database user per service with least-privilege roles; keep connection strings in Secret Manager, not code.
- Use Performance Advisor and the Query Profiler for index suggestions, then verify each with `explain`.
- Enable continuous cloud backup and test a restore to a scratch cluster.
- Create one `MongoClient` per process and reuse it; size `maxPoolSize` against the cluster's connection limit, which matters for serverless and Cloud Run instances.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Unbounded arrays (all comments in the post) | Subset or bucket pattern | Documents grow, rewrite and hit 16 MB |
| Normalize every entity like SQL tables | Embed what is read together | Each `$lookup` is a join on every read |
| Index fields in the order they appear in the query | ESR: equality, sort, range | Wrong order forces in-memory sorts or wide scans |
| `skip()` for deep pagination | Range on `_id` or a sort key | `skip` walks every skipped document |
| Create a client per request | One pooled client per process | Connection storms exhaust cluster limits |
| Trust Performance Advisor blindly | Verify with `explain`, watch write cost | Every index slows writes and uses RAM |

## Verification checklist

- [ ] Access patterns are written down and each collection shape serves them.
- [ ] No unbounded arrays; maximum document size is estimated.
- [ ] `$jsonSchema` validation covers required fields and enums.
- [ ] Hot queries show `IXSCAN`, no blocking sort, and examined close to returned.
- [ ] Transactions use the callback API and stay small.
- [ ] Atlas access is restricted, backups are on, and destructive operations were confirmed by the user.

## Related

- Knowledge: `firestore-data-modeling`, `database-design`, `backend-patterns`, `vector-databases`, `secrets-management`.
- Agents: `database-architect`, `backend-engineer`.
