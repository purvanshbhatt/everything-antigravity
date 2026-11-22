---
name: search-engines
description: >-
  Builds product and site search with Elasticsearch, OpenSearch, Meilisearch,
  Typesense, Postgres full-text or Vertex AI Search: engine choice, mappings
  and analyzers, indexing pipelines from the source of truth, zero-downtime
  reindex with aliases, relevance tuning measured with judgment lists, facets,
  typo tolerance and hybrid keyword plus vector search. Use when adding search,
  fixing poor relevance or rebuilding an index.
---

# Search Engines

Search quality is a measurement problem disguised as a configuration problem.
Teams tweak boosts until one complaint goes away and three new ones appear.
Build a judgment list first, keep the database as the source of truth with a
replayable indexing pipeline, and change relevance one measured step at a time.

## When to use

- Adding keyword, faceted or typo-tolerant search to a product, catalog, docs site or admin tool.
- Users complain that results are irrelevant, or zero-result rates are high.
- Mappings must change, or the index drifted from the database and needs a rebuild.
- Combining keyword and semantic (vector) retrieval.

## When not to use

- Retrieval for LLM answers (chunking, grounding, evaluation of answers): use `rag-pipelines`.
- Choosing and tuning a vector store on its own: use `vector-databases`.
- Log search and analytics dashboards: use `observability-otel`.
- Simple filters on a few thousand rows: a database index is enough (`database-design`).

## Workflow

1. **Build a judgment list before touching config.** Pull 50-200 real queries from logs (head, torso and long tail), and for each record the results that should rank in the top 5 with graded relevance (0-3). Track nDCG@10 and zero-result rate as the baseline.

   **Check:** The judgment list is versioned in the repo and a script computes the baseline metrics.

2. **Design the search document.** One document per result type, denormalized with everything needed to match, filter, sort and display. Classify each field: searchable (full text), filterable or facetable (exact), sortable, display-only. Include `tenant_id` or visibility fields for authorization filters.

   **Check:** Every field has a role, and no query needs a join at search time.

3. **Pin mappings and settings.** Disable dynamic mapping (`"dynamic": "strict"`), choose language analyzers, use multi-fields for text plus exact (`title` and `title.raw`), and exact numeric types for prices. Meilisearch and Typesense equivalents: `searchableAttributes`, `filterableAttributes`, `sortableAttributes`, ranking rules; Typesense collection fields with `facet: true`.

   **Check:** Indexing a document with an unexpected field fails in tests instead of silently creating a mapping.

4. **Feed the index from the source of truth.** Database changes flow through an outbox or change data capture to an indexer that upserts by entity ID with the bulk API and sends deletes as deletes. Use the entity's version as an external version so a late, older update cannot overwrite a newer one. Keep a full backfill job that can rebuild from scratch.

   **Check:** Index document count matches the database for a sample tenant, and a backfill is idempotent.

5. **Reindex with zero downtime.** Create a new versioned index (`products_v2`), backfill it (with `refresh_interval` set to `-1` during bulk load, restored afterwards), replay changes that arrived during the backfill, compare metrics, then atomically swap the alias. Delete the old index only after a soak period and explicit user confirmation.

   **Check:** Reads go through the alias only; the swap is a single `_aliases` call.

6. **Write queries in two contexts.** Filters (tenant, visibility, price range, facets) go in filter context: cached and unscored. Text matching goes in query context with field boosts, fuzziness for typos, synonyms, and recency or popularity signals via `function_score` or ranking rules.

   **Check:** Authorization filters are added server-side on every query, never by the client.

7. **Tune relevance one change at a time.** Change one boost, synonym set or analyzer, re-run the judgment list (Elasticsearch and OpenSearch offer `_rank_eval`), and keep the change only if the metric improves without regressions on the head queries. Online, watch click-through, zero-result rate and query reformulation.

   **Check:** Every relevance change in the history has a before and after metric.

8. **Add semantic retrieval as hybrid, not replacement.** Add a vector field (embeddings from Gemini or another embedding model), run keyword and kNN retrieval, and fuse with reciprocal rank fusion or score normalization. Evaluate on the same judgment list; vectors help vague and conversational queries and often hurt exact SKU or name lookups.

   **Check:** Hybrid beats keyword-only on nDCG@10 without losing exact-match queries.

9. **Secure and operate.** Browsers get search-only scoped keys (Meilisearch tenant tokens, Typesense scoped API keys, Elasticsearch API keys limited to read on one alias); admin keys stay server-side. Monitor p95 latency, indexing lag, rejected bulk requests, heap and disk watermarks; size shards to tens of gigabytes rather than hundreds of tiny shards.

   **Check:** No admin or write key appears in client bundles (`grep_search` the build output).

## Reference

### Engine choice (verify current features and licences)

| Engine | Strengths | Watch out for |
| :--- | :--- | :--- |
| Elasticsearch / OpenSearch | Full query DSL, aggregations, scale, vectors | Cluster operations; mapping explosions; licences differ |
| Meilisearch | Excellent defaults, typo tolerance, instant search | Fewer query DSL options; check scaling model for your size |
| Typesense | Fast, typo tolerant, Raft clustering, vectors | Indexed data is held in RAM |
| Postgres full text (`tsvector`, `pg_trgm`) | No new system, transactional | Limited relevance tooling at scale |
| Vertex AI Search | Managed semantic plus keyword search on Google Cloud | Less low-level control; per-query cost |

### Mapping and query (Elasticsearch or OpenSearch)

```json
PUT products_v2
{ "mappings": { "dynamic": "strict", "properties": {
    "id":        { "type": "keyword" },
    "tenant_id": { "type": "keyword" },
    "title":     { "type": "text", "analyzer": "english", "fields": { "raw": { "type": "keyword" } } },
    "brand":     { "type": "keyword" },
    "price":     { "type": "scaled_float", "scaling_factor": 100 },
    "updated":   { "type": "date" } } } }

GET products/_search
{ "query": { "bool": {
    "must":   [{ "multi_match": { "query": "running shoes", "fields": ["title^3", "brand^2"], "fuzziness": "AUTO" } }],
    "filter": [{ "term": { "tenant_id": "t-42" } }, { "range": { "price": { "lte": 120 } } }] } },
  "aggs": { "brands": { "terms": { "field": "brand" } } } }

POST _aliases
{ "actions": [ { "remove": { "index": "products_v1", "alias": "products" } },
               { "add":    { "index": "products_v2", "alias": "products" } } ] }
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Tune boosts from individual complaints | Judgment list plus nDCG before and after | Fixes for one query silently break others |
| Dynamic mapping in production | Strict, explicit mappings | Mapping explosions and wrong field types |
| Treat the index as the source of truth | Rebuildable pipeline from the database | You cannot recover from drift or corruption |
| Reindex in place | Versioned index plus alias swap | Downtime and half-built results |
| Filters inside scoring queries | Filter context | Slower queries and scores skewed by filters |
| Admin key in the frontend | Scoped search-only keys | Anyone can rewrite or delete the index |
| Replace keyword search with vectors | Hybrid with fusion, measured | Exact lookups regress |

## Verification checklist

- [ ] A versioned judgment list and baseline metrics exist.
- [ ] Mappings or settings are explicit and strict.
- [ ] Indexing is driven by an outbox or CDC with versioned upserts and a rebuild job.
- [ ] Reindexing uses an alias swap; old indexes are removed only with confirmation.
- [ ] Authorization and tenant filters are enforced server-side on every query.
- [ ] Each relevance change records its metric impact.

## Related

- Knowledge: `vector-databases`, `rag-pipelines`, `event-driven-architecture`, `database-design`, `multi-tenant-saas`, `ml-evaluation`, `postgres-patterns`.
- Agents: `backend-engineer`, `data-engineer`, `performance-optimizer`.
