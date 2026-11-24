---
name: vector-databases
disable-model-invocation: true
description: >-
  Chooses, configures and evaluates vector stores: pgvector on Cloud SQL or
  AlloyDB, AlloyDB ScaNN indexes, Vertex AI Vector Search, BigQuery and
  Firestore vector search. Covers HNSW and IVF index parameters, distance
  metrics, metadata filtering, hybrid search, re-embedding, and measuring
  recall against exact search. Use when storing embeddings, picking a vector
  database, tuning ANN indexes, or filtered vector queries miss results.
---

# Vector Databases

A vector index trades recall for speed, and filters can silently cut recall
further. Pick the simplest store that meets your scale, tune the index against
exact-search ground truth, and version embeddings with the model that made them.

## When to use

- Adding semantic search, recommendations or retrieval for RAG.
- Choosing between pgvector, AlloyDB, Vertex AI Vector Search, BigQuery or a dedicated vector database.
- Filtered queries return fewer than `k` results, or recall dropped after growth.
- Migrating to a new embedding model.

## When not to use

- Chunking, prompt assembly and answer evaluation for RAG: use `rag-pipelines`.
- Keyword search, facets and relevance tuning: use `search-engines`.
- Embedding generation API details: use `gemini-api`.
- Offline model metrics in general: use `ml-evaluation`.

## Workflow

1. **Size the problem.** Number of vectors now and in a year, dimensions, query rate, latency target, filter fields and their selectivity, update rate, and whether you need joins with relational data.

   **Check:** You can state "N vectors x D dims, Q queries per second at p95 under T ms, filters on F".

2. **Choose the store** with the matrix below. Prefer the database you already run when it fits.

   **Check:** The choice meets scale, filter and consistency needs, with headroom.

3. **Fix the embedding contract.** Record model name and version, dimensions, task type (for example retrieval document versus retrieval query in Gemini embedding models) and normalization. Check current model names and output dimensionality options in the docs.

   **Check:** Every stored vector has `embedding_model` metadata, and query and document embeddings use matching settings.

4. **Create the index with a metric that matches the model**, usually cosine, or inner product on normalized vectors.

   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE TABLE chunks (id bigint PRIMARY KEY, tenant_id uuid NOT NULL, doc_id bigint NOT NULL,
                        content text NOT NULL, embedding vector(768) NOT NULL);
   CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
   CREATE INDEX ON chunks (tenant_id);
   SET hnsw.ef_search = 100;  -- per session or transaction; higher = better recall, slower
   SELECT id, content FROM chunks WHERE tenant_id = $1 ORDER BY embedding <=> $2 LIMIT 10;
   ```

   **Check:** `EXPLAIN` shows the vector index for unfiltered queries, and the B-tree or partial index strategy for selective filters.

5. **Measure recall against exact search** on a sample of real queries (below), then tune `ef_search`, `probes` or the service's equivalents.

   **Check:** Recall@10 meets the target (often 0.95+) at the latency target, with filters applied.

6. **Plan re-embedding.** A new model means new vectors for everything: write to a new column or index, backfill, evaluate, switch reads, then drop the old one. Dropping indexes or old vectors in production needs explicit user confirmation.

   **Check:** Old and new embeddings are never compared with each other.

## Reference

### Store choice

| Store | Fits | Notes |
| :--- | :--- | :--- |
| pgvector (Cloud SQL, AlloyDB, any PostgreSQL) | Up to a few million vectors with relational filters and joins | HNSW or IVFFlat; transactional with your data |
| AlloyDB with ScaNN index | Larger corpora with PostgreSQL semantics and better filtered performance | `alloydb_scann` extension; in-database embedding generation via `google_ml_integration`; verify current syntax |
| Vertex AI Vector Search | Hundreds of millions to billions of vectors, high QPS, managed | Batch or streaming index updates; token and numeric restricts for filtering; separate from your primary data |
| BigQuery `VECTOR_SEARCH` | Batch and analytical similarity over warehouse tables | Optional vector indexes; billed like queries |
| Firestore vector search | App data already in Firestore, moderate scale | `find_nearest` with a vector index; pre-filters need composite indexes |
| Dedicated (Qdrant, Weaviate, Milvus, Pinecone) | Teams wanting specialised features or multi-cloud | Another system to secure, back up and sync |

### pgvector parameters

| Setting | Effect |
| :--- | :--- |
| HNSW `m`, `ef_construction` | Graph density and build quality; higher means better recall, slower builds, more memory |
| `hnsw.ef_search` (default 40) | Candidate list per query; must be at least `LIMIT` |
| IVFFlat `lists` | Clusters; build after loading representative data; roughly rows/1000 up to 1M rows is a common starting point |
| `ivfflat.probes` (default 1) | Clusters searched; raise for recall |
| Operators | `<->` L2, `<#>` negative inner product, `<=>` cosine distance |
| Types | `vector` indexes up to 2,000 dims; `halfvec` up to 4,000 and half the memory |

### Filtering

Approximate indexes return the top candidates first and filter afterwards, so a selective filter can leave fewer than `k` rows.

- pgvector 0.8+: `SET hnsw.iterative_scan = relaxed_order;` keeps scanning until enough rows pass the filter.
- Highly selective filters (one tenant among thousands): partial indexes per large tenant, partitioning by tenant, or exact search on the filtered subset with a B-tree index.
- Managed services: use native restricts and namespaces rather than post-filtering in application code.

### Measuring recall

```sql
BEGIN;
SET LOCAL enable_indexscan = off;   -- force exact search for ground truth
SELECT id FROM chunks WHERE tenant_id = $1 ORDER BY embedding <=> $2 LIMIT 10;
COMMIT;
```

Recall@k = |ANN results intersect exact results| / k, averaged over at least a few hundred real queries. Report p50 and p95 latency alongside recall, and re-run after data growth, parameter changes or model changes. Then measure end-to-end retrieval quality (hit rate, MRR, nDCG) with `rag-pipelines` and `agent-evals` practices.

### Hybrid search

Combine keyword (full-text or BM25) and vector results with reciprocal rank fusion: score = sum over lists of 1 / (60 + rank). Hybrid search fixes exact-term misses (product codes, names) that embeddings handle poorly.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Add a dedicated vector database for 100k vectors | pgvector in the database you already run | Extra system, sync jobs and security surface for no gain |
| Assume ANN recall is fine | Measure against exact search with filters | Recall can fall far below expectations silently |
| Post-filter ANN results in application code | Filter in the index or the query | Results drop below `k` or miss relevant items |
| Mix vectors from different models | Version embeddings and re-embed fully | Distances across models are meaningless |
| Use L2 on unnormalized vectors from a cosine-trained model | Match the metric to the model | Rankings degrade |
| Build IVFFlat on an empty or tiny table | Build after loading representative data | Cluster centres are poor and recall suffers |

## Verification checklist

- [ ] Scale, latency, filter selectivity and update rate are written down.
- [ ] Each vector records its embedding model and version.
- [ ] The distance metric matches the model, and query/document task types match.
- [ ] Recall@k against exact search meets the target with filters applied.
- [ ] p95 latency meets the target at expected load.
- [ ] Re-embedding has a side-by-side migration plan, and destructive steps were confirmed by the user.

## Related

- Knowledge: `rag-pipelines`, `postgres-patterns`, `gemini-api`, `search-engines`, `agent-evals`, `ml-evaluation`, `cloud-sql-alloydb`, `vertex-ai`.
- Agents: `gemini-ai-engineer`, `ml-engineer`, `database-architect`.
