---
name: recommender-systems
description: >-
  Designs recommender systems: objective and guardrails, impression logging,
  popularity and co-visitation baselines, candidate generation with matrix
  factorization, two-tower retrieval and content embeddings, ranking with
  gradient boosting, re-ranking for diversity and business rules, cold start,
  offline metrics such as recall@k and NDCG, and A/B testing. Use when
  building recommendations, related items, personalized feeds or ranked
  search results.
---

# Recommender Systems

A recommender is retrieval plus ranking inside a feedback loop. Ship a strong
non-personalized baseline first, log impressions from day one, and decide with
online tests, because offline metrics only approximate user behaviour.

## When to use

- "Recommended for you", "related items", "frequently bought together", feed ranking, personalized email picks.
- Personalizing the order of search results or a catalogue.
- A recommender exists but engagement is flat, results feel repetitive, or new items never surface.

## When not to use

- Semantic search or question answering over documents: `rag-pipelines`, `search-engines`.
- Choosing and tuning a vector store: `vector-databases`.
- Experiment design and analysis details: `ab-testing`.

## Workflow

1. **Frame the objective and constraints.** Pick the target (click, purchase, watch time, retention) and the guardrails (diversity, freshness, exposure for new items or creators, revenue, policy). Record catalogue size, user count, interaction volume and the latency budget, and the shape: user-to-item, item-to-item or query-to-item.

   **Check:** the objective, guardrails and latency budget are written down.

2. **Log the right events.** Impressions with request ID, surface, position, item list and model version; clicks, conversions and dwell keyed to the same request ID. Without impressions you cannot compute CTR, train rankers with negatives, or correct position bias.

   **Check:** any conversion joins back to the impression and model version that produced it.

3. **Build baselines.** Most popular per segment and time window, trending, and item-to-item co-visitation with time decay. They are often hard to beat.

   ```sql
   -- BigQuery: items viewed in the same session over the last 30 days
   WITH s AS (
     SELECT DISTINCT session_id, item_id
     FROM `proj.ds.events`
     WHERE event = 'view' AND ts > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
   )
   SELECT a.item_id AS item, b.item_id AS related, COUNT(*) AS together
   FROM s AS a JOIN s AS b ON a.session_id = b.session_id AND a.item_id != b.item_id
   GROUP BY item, related
   QUALIFY ROW_NUMBER() OVER (PARTITION BY item ORDER BY together DESC) <= 50
   ```

   Drop sessions with extreme item counts first (bots and crawlers dominate pair counts).

   **Check:** baseline offline metrics are recorded on a time-based test split.

4. **Generate candidates from several sources.** Union a few hundred to a few thousand candidates per request from co-visitation, matrix factorization (implicit ALS, or BigQuery ML `model_type='matrix_factorization'`), two-tower retrieval (TensorFlow Recommenders or TorchRec) served through an ANN index (`vector-databases`), and content embeddings (Gemini embeddings of titles, descriptions or images) for items without history.

   **Check:** candidate recall@N against future interactions is reported per source and for the union.

5. **Rank for precision.** Features: user aggregates, item popularity, age and price, context (time, device, surface), and crosses (user-category affinity, user-item embedding similarity). Start with gradient-boosted trees using a ranking objective (LightGBM `lambdarank`, XGBoost `rank:ndcg`); move to neural rankers when scale justifies it. Train on logged impressions. Correct position bias (position as a training feature fixed at serving time, or inverse propensity weighting). Build features point-in-time: only values known at impression time.

   **Check:** NDCG@k beats the baseline on a time-split test, and a test asserts that no feature timestamp is later than its impression.

6. **Re-rank with explicit rules.** Diversity (MMR or category caps), freshness boosts, removal of already-purchased or ineligible items, inventory filters, exploration slots (epsilon-greedy or bandits), and policy rules, all in a separate, versioned, logged layer.

   **Check:** rules live in config with a version recorded on every response.

7. **Plan for cold start.** New users: popular in segment, onboarding choices, context such as locale and referrer. New items: content embeddings plus guaranteed exploration traffic. A managed option on Google Cloud is Vertex AI Search for commerce (formerly Recommendations AI); check current naming and fit.

   **Check:** metrics are reported separately for new users and new items.

8. **Evaluate offline, decide online.** Split by time (train before T, test after). Report recall@k, NDCG@k, MAP or hit rate, catalogue coverage, novelty and diversity, and calibration if predicted CTR feeds other systems (`ml-evaluation`). Then A/B test with guardrails over at least one or two full weekly cycles and watch for novelty effects (`ab-testing`).

   **Check:** the launch decision links the offline report and the A/B result.

9. **Serve within budget.** Precompute candidates and embeddings in batch; online, fetch candidates, read features from a low-latency store (`redis-caching`), score, re-rank, and fall back to the popular list on timeout. Log model and rules versions per request.

   **Check:** a load test meets the p95 budget per stage, and the fallback path is tested.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Randomly split interactions | Split by time | Future interactions leak into training |
| Train on clicks without impressions | Log impressions and positions | No true negatives; position bias |
| Optimize CTR alone | Objective plus guardrails | Clickbait and short-term wins |
| Ship on offline metrics | Confirm with an A/B test | Offline and online often disagree |
| Personalize before a baseline | Popular plus co-visitation first | Unknown bar; wasted complexity |
| Join today's feature values to past events | Point-in-time feature joins | Leakage inflates offline scores |

## Verification checklist

- [ ] Objective, guardrails and latency budget are written.
- [ ] Impressions and outcomes join on request ID and model version.
- [ ] Baselines are measured; candidate recall is reported per source.
- [ ] Ranking features are point-in-time correct; position bias is handled.
- [ ] Re-ranking rules are versioned and logged.
- [ ] Cold-start cohorts have their own metrics; the A/B result backs the launch.

## Related

- Knowledge: `vector-databases`, `rag-pipelines`, `search-engines`, `ab-testing`, `ml-evaluation`, `bigquery`, `redis-caching`, `product-analytics`, `responsible-ai`.
- Agents: `ml-engineer`, `data-engineer`, `data-analyst`.
