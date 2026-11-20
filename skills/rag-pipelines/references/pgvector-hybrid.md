# Hybrid retrieval on Postgres with pgvector

Works on Postgres, Cloud SQL for PostgreSQL and AlloyDB (all support the
`vector` extension). Check the installed pgvector version
(`SELECT extversion FROM pg_extension WHERE extname = 'vector';`): HNSW needs
0.5 or later, and iterative index scans need 0.8 or later.

Postgres full-text ranking (`ts_rank_cd`) is not true BM25. It is usually good
enough for the keyword half of hybrid search; if you need BM25 proper, use a
BM25 extension or an external search engine and fuse the ranks the same way.

## Schema

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE chunks (
  chunk_id     bigserial PRIMARY KEY,
  doc_id       text        NOT NULL,
  tenant_id    text        NOT NULL,
  source       text        NOT NULL,           -- URL or repo path
  section      text,
  page         int,
  content      text        NOT NULL,
  content_hash text        NOT NULL,
  embed_model  text        NOT NULL,           -- e.g. gemini-embedding-2
  embedding    vector(768) NOT NULL,
  tsv          tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doc_id, content_hash)
);

CREATE INDEX chunks_embedding_hnsw ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX chunks_tsv_gin        ON chunks USING gin (tsv);
CREATE INDEX chunks_tenant         ON chunks (tenant_id, updated_at);
```

Creating an HNSW index on a large existing table is slow and memory-hungry:
build it during a maintenance window and raise `maintenance_work_mem` for the
session. Confirm with the user before running DDL on a shared database.

## Hybrid query with Reciprocal Rank Fusion

`$1` is the query embedding, `$2` the raw query text, `$3` the tenant.

```sql
WITH vec AS (
  SELECT chunk_id, row_number() OVER (ORDER BY dist) AS r
  FROM (
    SELECT chunk_id, embedding <=> $1::vector AS dist
    FROM chunks
    WHERE tenant_id = $3
    ORDER BY dist
    LIMIT 50
  ) v
),
kw AS (
  SELECT chunk_id, row_number() OVER (ORDER BY rank DESC) AS r
  FROM (
    SELECT chunk_id, ts_rank_cd(tsv, q) AS rank
    FROM chunks, websearch_to_tsquery('english', $2) AS q
    WHERE tenant_id = $3 AND tsv @@ q
    ORDER BY rank DESC
    LIMIT 50
  ) k
)
SELECT c.chunk_id, c.doc_id, c.source, c.section, c.page, c.content,
       COALESCE(1.0 / (60 + vec.r), 0) + COALESCE(1.0 / (60 + kw.r), 0) AS rrf
FROM vec
FULL OUTER JOIN kw USING (chunk_id)
JOIN chunks c USING (chunk_id)
ORDER BY rrf DESC
LIMIT 40;
```

Feed the 40 candidates to the reranker, then keep 5 to 10 for the prompt.

## Filtered vector search

A selective `WHERE` (one small tenant) can starve an approximate index of
matches. Options:

- Raise the candidate list for the session: `SET hnsw.ef_search = 200;`
- On pgvector 0.8+, let the index keep scanning until enough rows pass the
  filter: `SET hnsw.iterative_scan = relaxed_order;`
- For a few very large tenants, use partial indexes or table partitions per tenant.

## Python wiring (psycopg 3 and pgvector-python)

```python
import numpy as np
import psycopg
from pgvector.psycopg import register_vector

# sql/hybrid.sql holds the query above with psycopg named placeholders:
# $1 -> %(qvec)s, $2 -> %(query)s, $3 -> %(tenant)s  (the tenant appears twice)
HYBRID_SQL = open("sql/hybrid.sql", encoding="utf-8").read()

def retrieve(conn: psycopg.Connection, query: str, tenant: str) -> list[tuple]:
    qvec = np.array(embed_query(query), dtype=np.float32)
    with conn.cursor() as cur:
        cur.execute(HYBRID_SQL, {"qvec": qvec, "query": query, "tenant": tenant})
        return cur.fetchall()

conn = psycopg.connect(DSN, autocommit=True)
register_vector(conn)
```

Always pass the user's query as a parameter; never interpolate it into SQL
text.

## Upsert on ingest

```sql
INSERT INTO chunks (doc_id, tenant_id, source, section, page, content, content_hash, embed_model, embedding)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT (doc_id, content_hash) DO UPDATE SET updated_at = now();

-- After ingesting a document, remove chunks that no longer exist in it:
DELETE FROM chunks WHERE doc_id = $1 AND content_hash <> ALL($2::text[]);
```

Deleting rows is destructive: run it only from the ingestion job for the
document being re-ingested, never as an ad hoc cleanup on production without
confirmation.
