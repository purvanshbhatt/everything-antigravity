---
name: firestore-data-modeling
disable-model-invocation: true
description: >-
  Designs Cloud Firestore data models: documents versus subcollections,
  denormalization and fan-out, query and composite index planning, hotspot and
  write-rate limits, counters, pagination, how security rules constrain query
  shape, and read/write cost control. Use when designing Firestore collections,
  a query needs an index, rules reject a query, or the Firestore bill or
  latency is too high.
---

# Firestore Data Modeling

Firestore bills per document read and write and has no joins, so the model is
the query plan. Shape documents around screens, duplicate what each screen
needs, and design security rules and queries together, because rules are not
filters.

## When to use

- New Firestore (Native mode) collections for a web, Flutter or mobile app.
- "The query requires an index", "Missing or insufficient permissions" on a list query, or slow writes on one document.
- Firestore costs climb with listeners, counts or rule lookups.

## When not to use

- MongoDB or Firestore with MongoDB compatibility workloads using Mongo drivers: use `mongodb`.
- Relational data with heavy joins and transactional reporting: use `database-design` with Cloud SQL or AlloyDB.
- Analytics over Firestore data: export to BigQuery and use `bigquery`.
- Authentication flows and custom claims design: use `auth-patterns`.

## Workflow

1. **Inventory screens and their queries.** For each screen: which documents it shows, filters, sort, page size, whether it listens in real time, and who may see it.

   **Check:** Each screen is served by one query or a handful of document gets.

2. **Draft the tree.** Top-level collections for entities queried across owners; subcollections for data that belongs to one parent and is listed under it. Write one example document per collection with field types.

   **Check:** No document can approach 1 MiB or receive more than about one sustained write per second.

3. **Denormalize deliberately.** Copy display fields (name, avatar) into the documents that list them. Record who owns each copy and how it is refreshed, usually a Cloud Functions Firestore trigger (`onDocumentWritten`) that fans out updates. Triggers are at-least-once, so make the fan-out idempotent.

   **Check:** Every duplicated field has a named source of truth and update path.

4. **Write rules together with queries.** A list query succeeds only if every document it could return passes the rule, so the query must carry the same constraint the rule checks.

   ```text
   match /projects/{id} {
     allow read: if request.auth != null && request.auth.uid in resource.data.memberIds;
   }
   ```

   The client query must include `where("memberIds", "array-contains", uid)`; without it the whole query is denied.

   **Check:** Rules unit tests (Emulator Suite with `@firebase/rules-unit-testing`) cover allowed and denied cases for each query.

5. **Declare indexes in code.** Keep composite indexes and single-field exemptions in `firestore.indexes.json`, test against the emulator (`firebase emulators:start --only firestore`), and deploy with `firebase deploy --only firestore:indexes`.

   **Check:** No production query depends on an index created only by clicking the console link.

6. **Estimate cost** per screen view: documents read (including listener updates and rule `get()` calls) times daily views.

   **Check:** The estimate is recorded and the top screen is not reading hundreds of documents per view.

## Reference

### Limits that shape the model (verify against current docs)

| Limit | Value | Design consequence |
| :--- | :--- | :--- |
| Document size | 1 MiB | Move growing lists to subcollections |
| Sustained writes per document | About 1 per second | Shard counters; avoid one "stats" document |
| Index entries per document | 40,000 | Exempt large maps and arrays from indexing |
| `in`, `not-in`, `array-contains-any` | Up to 30 values | Chunk larger lists |
| Rule `get()`/`exists()` calls | 10 per single-document request or query, 20 for batches and transactions | Keep authz data in few documents or custom claims |
| Batched write or transaction | Up to 500 writes | Chunk bulk jobs |

### Hotspots

Sequential values in an indexed field (timestamps, incrementing IDs) concentrate writes on one index range. Use auto-generated document IDs, add an index exemption for a high-rate timestamp field you never query, and ramp new traffic gradually (the documented 500/50/5 rule: start at up to 500 operations per second, grow 50% every 5 minutes).

### Patterns

| Need | Pattern |
| :--- | :--- |
| Count or total | `count()`, `sum()`, `average()` aggregation queries; billed per batch of index entries, not per document |
| High-rate counter | Distributed counter: N shard documents, sum them on read |
| Pagination | Query cursors (`startAfter(lastSnapshot)`) with `limit()`; never `offset()`, which still bills skipped documents |
| Feed or inbox | Per-user subcollection written by fan-out |
| Cross-parent listing | Collection group query on a subcollection name, with a collection-group index |
| Expiring data | TTL policy on a timestamp field (`gcloud firestore fields ttls update expireAt --collection-group=sessions --enable-ttl`; verify flags) |
| Roles | Custom claims for coarse roles (`request.auth.token.admin`); a membership document for per-resource roles |

### Transactions

Client SDKs use optimistic transactions that retry on contention; server SDKs take pessimistic locks. Keep transactions small, read before write, and never run a transaction on a hot document from many clients at once.

### Cost control

- Real-time listeners bill one read per changed document plus the initial result set; detach them when screens close.
- Each rule `get()` is a billed read. Cache role data in custom claims when it changes rarely.
- Export for analytics (`gcloud firestore export gs://<bucket>`) or stream to BigQuery with the extension instead of scanning collections in the app.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Model tables plus client-side joins | Denormalize per screen | Each join is N extra billed reads and round trips |
| Expect rules to filter results | Put the rule's constraint in the query | Rules reject the whole query instead of filtering |
| One global counter document | Sharded counter or aggregation query | One document sustains only about one write per second |
| Monotonic document IDs | Auto IDs | Sequential keys create write hotspots |
| `offset()` pagination | Cursors | Skipped documents are still billed |
| Arrays that grow forever in one document | Subcollection | Size limit and rewrite cost on every update |
| Create indexes only in the console | `firestore.indexes.json` in source control | Environments drift and deploys break |

## Verification checklist

- [ ] Each screen maps to one query or a few gets, with an estimated read cost.
- [ ] No document can exceed 1 MiB or a sustained write per second.
- [ ] Every duplicated field has a source of truth and an idempotent update path.
- [ ] Rules tests in the emulator cover allowed and denied cases for every query.
- [ ] Composite indexes and exemptions live in `firestore.indexes.json`.
- [ ] Listeners are detached when not visible; pagination uses cursors.

## Related

- Knowledge: `database-design`, `mongodb`, `auth-patterns`, `flutter-mobile`, `bigquery`, `test-data-management`, `finops-cost`.
- Workflows: `/security-scan` (rules review).
- Agents: `database-architect`, `mobile-engineer`.
