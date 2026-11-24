---
name: fintech-ledgers
disable-model-invocation: true
description: >-
  Builds money-handling systems correctly: double-entry ledgers with
  immutable postings, integer minor units and explicit rounding, idempotent
  money movement with state machines, holds and reversals, concurrency-safe
  balances, reconciliation against PSP and bank reports, and audit trails.
  Use when designing wallets, balances, payouts, billing credits or any
  system that moves or records money. Not financial or legal advice.
---

# Fintech Ledgers

Record every movement of value as a balanced, immutable journal entry, make
every money-moving request idempotent, and reconcile your books against the
outside world daily. Balances are derived facts; postings are the truth.

> Not financial, accounting or legal advice. Licensing (for example money transmission), safeguarding and accounting treatment need qualified professionals; verify obligations with them.

## When to use

- Designing wallets, stored balances, credits, payouts, marketplaces or escrow.
- Integrating a payment provider or bank and tracking what actually settled.
- Fixing balance drift, double charges or "money appeared from nowhere" bugs.
- Preparing financial data for finance teams, auditors or regulators.

## When not to use

- Payment provider integration details (checkout, subscriptions, webhooks): use `payments-stripe`.
- Card data scope and PCI: use `pci-dss`.
- Revenue forecasting and models: use `financial-modeling`.
- General schema design: use `database-design` or `postgres-patterns`.

## Workflow

1. **Define the chart of accounts.** List accounts for each party and purpose: customer wallets, provider clearing, fees revenue, FX, suspense, reserves. Give each a currency and a normal side (debit or credit).

   **Check:** Every product flow (deposit, purchase, refund, payout, fee, chargeback) can be written as postings between named accounts.

2. **Model entries and postings.** One journal entry per business event, two or more postings, amounts in integer minor units, and the sum per currency equal to zero.

   ```sql
   CREATE TABLE journal_entries (
     id              uuid PRIMARY KEY,
     idempotency_key text UNIQUE NOT NULL,
     description     text NOT NULL,
     effective_at    timestamptz NOT NULL,
     created_at      timestamptz NOT NULL DEFAULT now(),
     reverses_id     uuid REFERENCES journal_entries(id)
   );
   CREATE TABLE postings (
     id         bigserial PRIMARY KEY,
     entry_id   uuid NOT NULL REFERENCES journal_entries(id),
     account_id uuid NOT NULL REFERENCES accounts(id),
     amount     bigint NOT NULL CHECK (amount <> 0),   -- minor units: + debit, - credit
     currency   char(3) NOT NULL
   );
   REVOKE UPDATE, DELETE ON journal_entries, postings FROM app_role;
   ```

   **Check:** This query returns zero rows, in tests and in a daily production job:

   ```sql
   SELECT entry_id, currency FROM postings GROUP BY entry_id, currency HAVING sum(amount) <> 0;
   ```

3. **Never mutate; reverse.** Corrections are new entries that reverse (fully or partially) earlier ones, linked by `reverses_id`.

   **Check:** The application role cannot update or delete postings; a correction leaves the original intact.

4. **Make money movement idempotent.** Every external request carries an idempotency key. Store the key with a hash of the request and the result; a retry with the same key returns the stored result; the same key with a different payload is rejected. Pass your own idempotency key to the provider as well.

   **Check:** A test that sends the same transfer twice concurrently produces exactly one entry and one provider call.

5. **Use explicit state machines for external transfers.** For example `created -> pending -> settled | failed | returned`. Post a hold or pending entry when you initiate, then settle or reverse it when the provider confirms through a webhook or report. Transitions are validated and logged.

   **Check:** Every transfer in a non-terminal state older than its SLA appears on an alert or work queue.

6. **Protect balances under concurrency.** Either derive balances from postings, or maintain a balance row updated in the same database transaction with a row lock (`SELECT ... FOR UPDATE`) or optimistic version check. Enforce non-negative constraints where the product requires them.

   **Check:** A parallel test of many debits against one account never overdraws it and the final balance equals the sum of postings.

7. **Reconcile daily.** Match internal postings to provider and bank settlement reports by external reference and amount. Classify breaks: missing internally, missing externally, amount mismatch, timing. Breaks go to a suspense account and a human queue; never auto-adjust silently.

   **Check:** A reconciliation report exists per day with zero unexplained breaks older than the agreed tolerance.

8. **Keep an audit trail.** Record actor, reason, request ID and source system for each entry and every manual adjustment; require four-eyes approval for manual entries above a threshold. Any manual production adjustment requires explicit user confirmation.

## Reference

### Money representation

| Rule | Detail |
| :--- | :--- |
| Integer minor units or exact decimals | `bigint` cents, or `numeric`/`Decimal`; never binary floats |
| Currency exponent varies | ISO 4217: JPY has 0 decimals, USD 2, KWD and BHD 3; read it from a table, never assume 2 |
| Round once, explicitly | State the rounding mode (half-up, half-even) required by contract or regulation |
| Allocate remainders | Splitting 100 into 3 gives 34, 33, 33; the sum must equal the original |
| FX | Separate postings per currency through an FX account; store rate, source and timestamp |

### Allocation without losing a cent

```python
def allocate(total: int, weights: list[int]) -> list[int]:
    shares = [total * w // sum(weights) for w in weights]
    remainder = total - sum(shares)
    for i in sorted(range(len(weights)), key=lambda i: -weights[i])[:remainder]:
        shares[i] += 1
    return shares   # sum(shares) == total
```

### Build or buy

Purpose-built ledgers (for example TigerBeetle, Formance, or a provider's ledger product) handle balancing, idempotency and scale; a Postgres ledger is fine when volume is moderate and the team owns reconciliation.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `balance = balance + amount` with no entry | Balanced postings; balance derived or updated atomically | Single-entry updates cannot be audited or reconciled |
| Store money as `float` | Integer minor units or decimal | 0.1 + 0.2 is not 0.3 in binary floating point |
| Edit or delete a posting to fix a mistake | Reversal entries | Mutation destroys the audit trail |
| Retry provider calls without an idempotency key | Keys end to end, stored with results | Retries after timeouts double-charge customers |
| Trust webhooks as the only source of truth | Webhooks plus daily report reconciliation | Webhooks are delayed, duplicated and sometimes lost |
| Treat pending funds as available | Separate pending and available balances | Returns and chargebacks arrive days later |

## Verification checklist

- [ ] Every business event maps to a balanced entry between named accounts.
- [ ] Amounts are integer minor units or exact decimals with currency exponents from data.
- [ ] Postings are append-only; corrections are reversals.
- [ ] Idempotency is enforced end to end and tested under concurrency.
- [ ] Daily reconciliation runs and breaks are worked to zero.
- [ ] Manual adjustments require approval and confirmation; the not-financial-advice caveat was given.

## Related

- Knowledge: `payments-stripe`, `pci-dss`, `postgres-patterns`, `database-design`, `webhooks`, `event-driven-architecture`, `cryptography`, `financial-modeling`.
- Workflows: `/threat-modeling`, `/write-spec`.
- Agents: `database-architect`, `backend-engineer`, `compliance-auditor`.
