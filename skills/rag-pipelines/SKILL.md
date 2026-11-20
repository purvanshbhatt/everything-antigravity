---
name: rag-pipelines
description: >-
  Builds retrieval-augmented generation pipelines: choosing between RAG, long
  context and context caching, chunking, Gemini embeddings, hybrid keyword
  plus vector search, reranking, pgvector, AlloyDB and Vertex AI Vector
  Search, citation grounding, freshness, and retrieval and faithfulness evals.
  Use when the user wants "chat with our docs", semantic search, or answers
  grounded in a private corpus.
---

# RAG Pipelines

Retrieval quality caps answer quality. Most bad RAG answers are retrieval
misses, not generation failures, so measure recall before touching the prompt,
and question whether you need retrieval at all now that context windows hold a
million tokens.

## When to use

- "Chat with our docs, codebase or tickets", semantic search, or Q&A over a private, changing corpus.
- Answers must cite sources, respect per-user permissions, or stay fresh.
- An existing RAG system gives wrong, stale or uncited answers.

## When not to use

- The corpus fits comfortably in context and rarely changes: long context plus caching (step 1).
- Public web facts: Google Search grounding (`gemini-api`).
- Questions over structured data ("revenue by month"): tools or SQL against the database (`database-design`).
- Prompt wording only: `prompt-engineering`.

## Workflow

1. **Decide: RAG, long context, or caching.**

   | Situation | Choose |
   | :--- | :--- |
   | Corpus under roughly 200k tokens, stable, one tenant | Send it in context as an identical prefix so implicit caching applies (Gemini 4: 1M-token window; caching starts around 4,096-token prefixes) |
   | One large document queried repeatedly for hours | Prefix caching, or an explicit cache (generateContent, Gemini 3 and 2.5) |
   | Large or growing corpus, per-user ACLs, per-chunk citations | RAG |
   | A few long documents and many questions | Retrieve whole sections, not tiny chunks |

   Measure the corpus with `count_tokens` and compare cost and latency per query for both options at expected traffic.

   **Check:** the decision is written down with corpus token count, update rate and expected queries per second.

2. **Build the eval set before the pipeline.** Collect 50 to 100 real questions with the IDs of the documents or chunks that answer them, plus unanswerable ones. Retrieval metrics: recall@k, MRR, nDCG. Answer metrics: faithfulness (every claim supported by retrieved text), citation precision, answer relevance, correct refusals.

   **Check:** baseline numbers exist before any tuning (see `agent-evals` for the harness).

3. **Parse and chunk by structure.**

   | Content | Strategy |
   | :--- | :--- |
   | Markdown, HTML, prose | Split on headings, then recursively by paragraph; about 300 to 800 tokens with 10 to 15% overlap |
   | Code | One function or class per chunk, with file path and signature in a header |
   | Tables, CSV | Repeat the header row in every chunk, or convert rows to sentences |
   | PDF | Layout-aware parsing; keep page numbers |
   | FAQ, tickets | One question and answer per chunk |

   Prefix each chunk with context (document title, section path, date) before embedding. For "small to embed, large to read", embed small chunks and return their parent section. Store `chunk_id`, `doc_id`, source, section, page, `updated_at`, ACL, `content_hash`, `embed_model` and dimension with every chunk.

   **Check:** 20 random chunks each make sense alone, and none splits a table or code block.

4. **Embed consistently.**

   ```python
   from google import genai
   from google.genai import types

   client = genai.Client()
   EMBED_MODEL, DIM = "gemini-embedding-2", 768      # confirm with client.models.list()

   def embed_chunks(chunks: list[dict]) -> list[list[float]]:
       # One Content per chunk: several parts in a single Content return ONE aggregated vector.
       contents = [types.Content(parts=[types.Part(text=f"title: {c['title']} | text: {c['text']}")])
                   for c in chunks]
       res = client.models.embed_content(model=EMBED_MODEL, contents=contents,
                                         config=types.EmbedContentConfig(output_dimensionality=DIM))
       return [e.values for e in res.embeddings]

   def embed_query(q: str) -> list[float]:
       res = client.models.embed_content(model=EMBED_MODEL, contents=f"task: search result | query: {q}",
                                         config=types.EmbedContentConfig(output_dimensionality=DIM))
       return res.embeddings[0].values
   ```

   `gemini-embedding-2` is multimodal, ignores `task_type`, takes task prefixes in the text, and renormalizes reduced dimensions. `gemini-embedding-001` is text-only, takes `task_type` (`RETRIEVAL_DOCUMENT`, `RETRIEVAL_QUERY`, ...), and needs manual L2 normalization below 3,072 dimensions. Use 768, 1,536 or 3,072 dimensions; embed large backfills through the Batch API at half price. Never mix models or dimensions in one index.

   **Check:** the vector count equals the chunk count, and a query copied from a known chunk returns it in the top 3.

5. **Retrieve with hybrid search and filters.** Vectors miss exact tokens (error codes, SKUs, names); keyword search misses paraphrases. Run both, fuse with Reciprocal Rank Fusion (score = sum of `1 / (60 + rank)`), apply tenant, ACL and date filters inside the query, and keep 30 to 50 candidates.

   | Store | Fits |
   | :--- | :--- |
   | pgvector on Postgres or Cloud SQL | Up to millions of chunks, SQL joins, ACL filters, transactions |
   | AlloyDB for PostgreSQL | The same pgvector SQL, plus Google's ScaNN index for larger scale |
   | Vertex AI Vector Search | Managed ANN at very large scale and high QPS; keep text and metadata elsewhere |
   | BigQuery vector search | Analytics-adjacent and batch retrieval |

   Schema, indexes and the hybrid SQL: [references/pgvector-hybrid.md](references/pgvector-hybrid.md). Check current product names and index options in the Google Cloud docs before choosing.

   **Check:** hybrid recall@k on the eval set is at least as high as vector-only and keyword-only.

6. **Rerank the candidates.** Reduce 30 to 50 candidates to 5 to 10 with a cross-encoder, a managed ranking API, or a cheap LLM scoring each chunk 0 to 3 against the question with a schema. Drop near-duplicates and limit chunks per document so one source can't crowd out the rest.

   **Check:** nDCG@5 improves over no reranking within the latency budget.

7. **Generate with enforced citations.** Put chunks in tagged blocks with IDs, treat them as untrusted data (the injection-safe template in `prompt-engineering`), require a `[chunk_id]` after each claim, and answer "not found in the sources" when retrieval is empty or below a score threshold. After generation, reject any cited ID that was not provided, and optionally check that quoted evidence appears in the chunk.

   **Check:** citation precision is 100% on the eval set, and unanswerable questions are refused.

8. **Keep the index fresh.** Ingest incrementally by `content_hash`, delete chunks of removed documents, boost or filter by `updated_at` for time-sensitive questions, schedule re-crawls, and track index lag. When changing the embedding model, build a second index, evaluate it, then switch.

   **Check:** an edited document changes the answer within the freshness target, and a deleted one never appears.

9. **Monitor in production.** Log query, retrieved IDs and scores, cited IDs, prompt version and feedback. Watch empty-retrieval rate, low-score rate and negative feedback, and turn failures into eval cases.

   **Check:** a report shows recall@k, faithfulness and empty-retrieval rate over time.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Tune the prompt first | Measure recall@k first | Generation can't use a chunk retrieval never returned |
| Fixed 512-token splits through tables and code | Structure-aware chunking with context headers | Fragments lose meaning |
| Vector-only search | Hybrid with RRF | Misses exact identifiers |
| Filter ACLs after retrieval | Filter inside the query | Leaks data and empties the top k |
| Mix embedding models in one index | One model and dimension per index; re-embed on change | Vectors from different models aren't comparable |
| Trust chunk text as instructions | Delimit as untrusted data | Indirect prompt injection |
| Let the model cite freely | Validate cited IDs against provided chunks | Invented citations look authoritative |
| Reach for RAG by default | Check whether long context plus caching is cheaper | Less machinery, fewer failure modes |

## Verification checklist

- [ ] RAG-versus-long-context decision documented with numbers.
- [ ] Eval set with relevant chunk IDs and unanswerable questions; baseline recorded.
- [ ] Chunks carry metadata, ACLs, hashes and embedding model and dimension.
- [ ] Hybrid retrieval with in-query filters beats either method alone.
- [ ] Citations are validated; refusals happen below the score threshold.
- [ ] Incremental ingestion, deletions and re-embedding are tested.

## Related

- Knowledge: `gemini-api`, `prompt-engineering`, `agent-evals`, `llm-cost-routing`, `database-design`, `backend-patterns`, `observability-otel`.
- Agents: `database-architect` (schema and indexes), `gemini-ai-engineer`, `performance-optimizer`.
- Workflows: `/blueprint`, `/feature-dev`, `/verify`.
