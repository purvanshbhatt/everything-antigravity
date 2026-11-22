---
name: test-data-management
description: >-
  Manages test data so suites are fast, isolated and safe: factories
  (factory_boy, FactoryBot, fishery), minimal fixtures, idempotent seeds,
  per-test isolation with transactions, truncation, per-worker or template
  databases and Testcontainers, deterministic fakes and clocks, and masked or
  synthetic data. Use when tests share or leak state, fixtures are hard to
  maintain, or a team wants production-like data in lower environments.
---

# Test Data Management

Each test should build exactly the data it needs, in isolation, with values
that make the intent obvious. Shared mutable fixtures and raw production
copies are the two biggest sources of flaky tests and privacy incidents.

## When to use

- Tests fail when run in parallel or in a different order.
- Giant JSON fixtures or SQL dumps nobody dares to edit.
- Setting up seed data for local development, demos or preview environments.
- Someone asks for "a copy of production" in staging or on a laptop.

## When not to use

- Test strategy and the red-green-refactor loop: use `tdd-testing` or `/tdd`.
- pytest fixture mechanics in depth: use `python-testing`.
- Endpoint-level test design: use `api-testing`.
- Legal basis, DPIAs and data mapping for personal data: use `gdpr-privacy`.

## Workflow

1. **Inventory the current data sources for tests**: fixture files, seed scripts, shared databases, dumps, and hard-coded IDs.

   **Check:** You know which tests depend on shared state (run the suite in random order and in parallel to expose them).

2. **Introduce factories with valid defaults.** Every factory produces a valid object with no arguments; tests override only the fields they assert on. Use sequences for unique fields.

   ```python
   import factory
   from myapp.models import Order, User

   class UserFactory(factory.Factory):
       class Meta:
           model = User
       email = factory.Sequence(lambda n: f"user{n}@example.test")
       name = factory.Faker("name")
       role = "member"

   class OrderFactory(factory.Factory):
       class Meta:
           model = Order
       user = factory.SubFactory(UserFactory)
       status = "paid"
       total_cents = 1999

   refunded = OrderFactory(status="refunded")   # the test states only what matters
   ```

   Use the ORM-specific base (`factory.alchemy.SQLAlchemyModelFactory`, `factory.django.DjangoModelFactory`) when factories must persist rows.

   **Check:** Tests read as "given an order with status refunded", with no unrelated literals.

3. **Isolate every test.** Pick one strategy per suite (table below) and enforce it in shared fixtures.

   **Check:** The suite passes with `pytest -n auto`, `vitest --sequence.shuffle`, `go test -shuffle=on -p 4 ./...` or your runner's equivalent.

4. **Make randomness and time deterministic.** Seed fakers (`Faker.seed(1234)` in Python, `faker.seed(123)` in faker-js), and freeze time (`time-machine` or `freezegun`, Jest or Vitest fake timers, an injected clock in Go or Java).

   **Check:** A failing test reproduces with the same data on rerun.

5. **Write idempotent seeds for dev and preview environments.** Seeds upsert by natural key so they can run repeatedly (`npx prisma db seed`, `python manage.py loaddata`, `bin/rails db:seed`, or a script). Keep demo seeds separate from test fixtures.

   **Check:** Running the seed twice leaves the same row counts.

6. **Guard destructive resets.** Any script that truncates, drops or reseeds must refuse non-local or production targets, and resetting a shared environment needs explicit user confirmation.

   ```python
   from urllib.parse import urlparse

   def assert_safe_target(database_url: str) -> None:
       host = urlparse(database_url).hostname or ""
       if host not in {"localhost", "127.0.0.1", "::1"} and not host.endswith(".test"):
           raise SystemExit(f"Refusing to reset database on host {host!r}")
   ```

   **Check:** Pointing the reset script at a staging URL exits with an error.

## Reference

### Isolation strategies

| Strategy | Speed | Caveats |
| :--- | :--- | :--- |
| Transaction per test, rolled back | Fastest | Code under test must use the same connection; breaks with code that commits or uses other connections |
| Truncate tables after each test | Medium | Order of truncation matters with foreign keys (`TRUNCATE ... CASCADE` in PostgreSQL) |
| Database per worker | Fast in parallel | Name it from the worker ID (pytest-xdist sets `PYTEST_XDIST_WORKER`, for example `gw0`) |
| PostgreSQL template database | Fast clone | `CREATE DATABASE test_gw0 TEMPLATE app_template;` needs no other connections to the template |
| Testcontainers | Realistic, disposable | Container start time; reuse one container per session |
| Unique tenant or prefix per test | Works on shared deployed environments | Requires tenant-aware cleanup jobs |

### Fixtures versus factories

| Use | When |
| :--- | :--- |
| Factories | Default for unit and integration tests |
| Small static fixtures | Golden files: parser inputs, API response samples, regression cases |
| Recorded responses | Third-party APIs, refreshed on a schedule and scrubbed of secrets |
| Snapshots of large datasets | Performance tests only, never as the default test setup |

### Production-like data

Copying production data into lower environments is a privacy decision, not a technical shortcut. Get approval from the data owner first, and prefer the options from the top of this list:

1. **Synthetic data** generated from schemas and distributions (factories at scale, or generators driven by profiled statistics).
2. **Subset plus mask**: extract a referentially intact subset, then mask direct identifiers (names, emails, phones, addresses, free text) and generalize quasi-identifiers (birth date to year, postcode to region).
3. **Deterministic pseudonymization** with a keyed hash (HMAC) so joins still work. Keep the key out of lower environments. Pseudonymized data can still be personal data under GDPR.

Tools: Google Cloud Sensitive Data Protection for discovery and de-identification, the PostgreSQL Anonymizer extension for masking rules, and custom scripts with factories. Scan the result for leftover PII before releasing it, and restrict access and retention in the target environment.

### Language equivalents

| Ecosystem | Factories and fakes |
| :--- | :--- |
| Python | factory_boy, Faker, Hypothesis for property-based generation |
| Ruby | FactoryBot, Faker |
| JavaScript and TypeScript | fishery or plain builder functions, @faker-js/faker |
| Go | Builder functions with functional options, `testing/quick` or rapid |
| JVM | Builders or Instancio, Datafaker |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| One shared fixture database for all tests | Per-test isolation strategy | Order-dependent, unparallelizable suites |
| Hard-coded IDs like `user_id = 1` | Factories returning created objects | Collisions and hidden coupling |
| Huge fixture files | Factories plus small golden files | Nobody understands or updates them |
| Unseeded random data | Seeded fakers and frozen clocks | Failures cannot be reproduced |
| Raw production dumps on laptops | Synthetic or masked subsets with approval | Privacy breach and compliance exposure |
| Reset scripts without target checks | Host allowlist and confirmation | One wrong URL wipes a shared environment |

## Verification checklist

- [ ] Factories produce valid objects by default, and tests override only asserted fields.
- [ ] The suite passes in random order and in parallel.
- [ ] Fakers are seeded and time is controlled.
- [ ] Seeds are idempotent and separate from test fixtures.
- [ ] Reset scripts refuse non-local targets; shared resets were confirmed by the user.
- [ ] Any production-derived data was approved, masked or synthesized, and scanned for PII.

## Related

- Knowledge: `tdd-testing`, `python-testing`, `api-testing`, `gdpr-privacy`, `database-migrations`, `orm-patterns`.
- Workflows: `/tdd`, `/e2e`.
- Agents: `test-engineer`, `compliance-auditor`.
