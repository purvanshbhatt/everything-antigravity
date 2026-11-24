---
name: orm-patterns
disable-model-invocation: true
description: >-
  Uses ORMs and query builders well: Prisma, Drizzle, SQLAlchemy 2.0 and
  TypeORM. Covers detecting and fixing N+1 queries with eager loading,
  transaction scoping, optimistic locking, bulk operations, migrations from
  ORM models, connection pooling in serverless, and safe raw SQL escape
  hatches. Use when writing data access code with an ORM, an endpoint issues
  too many queries, or ORM-generated SQL is slow or wrong.
---

# ORM Patterns

An ORM saves typing, not thinking. Know the SQL each call produces, load
related data on purpose, keep transactions short and explicit, and drop to
parameterized raw SQL when the ORM gets in the way.

## When to use

- Writing repositories, services or resolvers with Prisma, Drizzle, SQLAlchemy or TypeORM.
- An endpoint issues dozens or hundreds of queries, or lazy loading fails in async code.
- Deciding where transactions begin and end, or adding optimistic locking.
- ORM-generated migrations or raw SQL need review.

## When not to use

- Tuning a specific slow SQL statement: use `sql-optimization`.
- Migration rollout strategy (expand/contract, backfills, CI): use `database-migrations`.
- Schema design and constraints: use `database-design`.
- Framework-specific ORMs covered elsewhere (Django, Active Record, Eloquent, EF Core): see `python-fastapi`, `rails`, `laravel` or `aspnet-core`.

## Workflow

1. **Turn on query logging in development and tests.**

   | ORM | How |
   | :--- | :--- |
   | Prisma | `new PrismaClient({ log: ['query'] })` |
   | Drizzle | `drizzle(client, { logger: true })` |
   | SQLAlchemy | `create_engine(url, echo=True)` |
   | TypeORM | `logging: true` in the DataSource options |

   **Check:** You can see every statement an endpoint runs.

2. **Count queries per request** in an integration test for each list or detail endpoint, and assert an upper bound.

   **Check:** The count does not grow with the number of rows returned.

3. **Fix N+1 with explicit loading** (table below). In SQLAlchemy, set `lazy="raise"` on relationships (or use `raiseload("*")`) so accidental lazy loads fail loudly, which is mandatory under asyncio where lazy loads raise `MissingGreenlet`.

   **Check:** The query count for a page of 50 items is constant (typically 1-3).

4. **Scope transactions explicitly** around one unit of work. Use the transaction handle (`tx`, `manager`, `session`) for every call inside it, and never do network calls to other services inside a database transaction.

   **Check:** A forced exception mid-transaction leaves no partial writes (test it).

5. **Review generated migrations and raw SQL.** Read the SQL the ORM's migration tool emits, and confirm every raw query is parameterized. Applying migrations to shared databases follows `database-migrations` and needs explicit user confirmation.

   **Check:** `grep_search` finds no string-built SQL (`$queryRawUnsafe`, f-strings or template literals passed to raw query functions with user input).

## Patterns

### Eager loading

| ORM | Load related rows |
| :--- | :--- |
| Prisma | `prisma.user.findMany({ include: { posts: true } })`; use `select` to fetch only needed fields |
| Drizzle | `db.query.users.findMany({ with: { posts: true } })` (needs relations declared and the schema passed to `drizzle()`), or an explicit join |
| SQLAlchemy | `select(User).options(selectinload(User.posts))` for collections; `joinedload` for many-to-one |
| TypeORM | `find({ relations: { posts: true } })` or `createQueryBuilder("u").leftJoinAndSelect("u.posts", "p")` |

`selectinload` issues one extra `IN` query per relationship and avoids the row multiplication of joined collection loading; prefer it for one-to-many.

### Transactions

```typescript
// Prisma interactive transaction: every call uses tx, not prisma
await prisma.$transaction(async (tx) => {
  const acct = await tx.account.update({ where: { id: from }, data: { balance: { decrement: amount } } });
  if (acct.balance < 0) throw new Error("insufficient funds");   // throws roll back
  await tx.account.update({ where: { id: to }, data: { balance: { increment: amount } } });
}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
```

```python
# SQLAlchemy 2.0: commit on success, roll back on exception
with Session(engine) as session, session.begin():
    order = session.get(Order, order_id, with_for_update=True)
    order.status = "paid"
```

Drizzle: `await db.transaction(async (tx) => { ... })`. TypeORM: `await dataSource.transaction(async (manager) => { ... })`. Retry serialization failures and deadlocks with backoff at the transaction boundary.

### Optimistic locking

| ORM | Mechanism |
| :--- | :--- |
| SQLAlchemy | `__mapper_args__ = {"version_id_col": version}`; stale updates raise `StaleDataError` |
| TypeORM | `@VersionColumn()`, checked with `lock: { mode: "optimistic", version }` on reads |
| Prisma, Drizzle | `updateMany`/`update ... where id = ? and version = ?`, then treat zero affected rows as a conflict |

### Bulk operations

Prisma `createMany` (no nested relations), Drizzle `db.insert(t).values([...])`, SQLAlchemy `session.execute(insert(Model), list_of_dicts)`, TypeORM `createQueryBuilder().insert().values([...])`. Chunk large arrays (for example 1,000 rows) to stay under driver parameter limits.

### Raw SQL escape hatches

| ORM | Safe (parameterized) | Unsafe |
| :--- | :--- | :--- |
| Prisma | ``prisma.$queryRaw`SELECT * FROM t WHERE id = ${id}` `` | `$queryRawUnsafe` with interpolated input |
| Drizzle | ``db.execute(sql`select * from t where id = ${id}`)`` | `sql.raw(userInput)` |
| SQLAlchemy | `session.execute(text("select * from t where id = :id"), {"id": id})` | f-strings inside `text()` |
| TypeORM | `dataSource.query("select * from t where id = $1", [id])` | String concatenation |

Use raw SQL for window functions, CTEs, bulk upserts and reporting queries; keep results typed (Prisma `$queryRaw<Row[]>`, SQLAlchemy `.mappings()`).

### Migrations and pooling

- Prisma Migrate, `drizzle-kit generate` plus `drizzle-kit migrate`, Alembic autogenerate, TypeORM `migration:generate`. `drizzle-kit push`, `prisma db push` and TypeORM `synchronize: true` are for local prototyping only.
- Serverless and Cloud Run scale out instances, each with its own pool. Cap pool size per instance so `instances x pool` stays under the database's connection limit, or put a pooler in front (PgBouncer, or the managed pooling your database offers).

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Access relations in a loop | Eager load or batch with `IN` | One query per row (N+1) |
| Fetch whole entities for a list view | `select` only displayed columns | Wide rows waste I/O and memory |
| Call the global client inside a transaction callback | Use `tx` / `manager` / `session` | Those writes escape the transaction |
| HTTP calls inside a transaction | Do them before or after, or use an outbox | Locks are held while the network stalls |
| `synchronize: true` or `db push` against shared databases | Versioned, reviewed migrations | Untracked and possibly destructive schema changes |
| Interpolate input into raw SQL | Tagged templates or bound parameters | SQL injection |
| Trust ORM defaults for pool size in serverless | Size pools against instance count | Connection exhaustion under scale-out |

## Verification checklist

- [ ] Query logging is on in development, and endpoints have query-count assertions.
- [ ] Relationships are eager-loaded on purpose; accidental lazy loads raise.
- [ ] Transactions use the transaction handle and contain no remote calls.
- [ ] Concurrent edits are protected by optimistic locking or row locks.
- [ ] All raw SQL is parameterized.
- [ ] Pool size times maximum instances fits the database connection limit.

## Related

- Knowledge: `database-design`, `sql-optimization`, `database-migrations`, `postgres-patterns`, `backend-patterns`, `python-fastapi`, `typescript-patterns`.
- Agents: `sql-reviewer`, `typescript-reviewer`, `python-reviewer`, `backend-engineer`.
