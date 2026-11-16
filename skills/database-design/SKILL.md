---
name: database-design
description: "Model scalable relational (PostgreSQL, Cloud SQL) and NoSQL (Firestore, BigQuery) database schemas with query optimization."
---

# Database Design & Optimization

## Overview
Architect reliable, high-performance database schemas, indexing strategies, and data access pipelines across SQL and NoSQL engines.

## Schema Modeling Guidelines
1. **Relational Systems (PostgreSQL / Cloud SQL)**:
   - Enforce domain constraints at the database level (NOT NULL, foreign keys, CHECK constraints).
   - Use UUIDv7 or ULID for globally unique primary keys that preserve temporal locality.
   - Comprehensive indexing: Composite indexes matching query filter order (Equality -> Range -> Sort).
2. **Analytical Warehousing (Google BigQuery)**:
   - Partition tables by day or ingestion time to prevent scanning full datasets.
   - Cluster by high-cardinality query keys to reduce query byte read charges.
3. **Document Stores (Google Cloud Firestore)**:
   - Model for query access patterns rather than purely normalized entities.
   - Keep subcollection depths shallow and maintain composite index definitions in `firestore.indexes.json`.
4. **Zero-Downtime Migration Pattern**:
   - Step 1: Add new nullable column.
   - Step 2: Deploy code writing to both old and new columns.
   - Step 3: Backfill historical data.
   - Step 4: Deploy code reading from new column.
   - Step 5: Drop old column in next migration.
