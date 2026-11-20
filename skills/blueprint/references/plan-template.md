# Implementation Plan Template

Copy this into Antigravity's implementation-plan artifact (or `docs/plans/<yyyy-mm-dd>-<slug>.md` when the user wants it in the repo). Delete sections that are genuinely empty, but write "None" rather than deleting Risks or Open questions: an empty risk table should be a conclusion, not an omission.

````markdown
# Plan: <feature or change name>
Status: DRAFT | APPROVED <yyyy-mm-dd> | DONE
Branch: <feat/slug> · Base: <main @ short sha>

## 1. Goal
<one sentence: who gets what behaviour>

## 2. Scope
- In: ...
- Out (explicitly): ...

## 3. Acceptance criteria
- [ ] AC1: Given <state>, when <action>, then <observable result>
- [ ] AC2: ...

## 4. Constraints
| Constraint | Source |
| :--- | :--- |
| Node >= 20 | `package.json` `engines` |
| No breaking change to `/v1/orders` | `docs/api.md` |

## 5. Affected code
| File | Role | Change |
| :--- | :--- | :--- |
| `src/checkout/applyCoupon.ts:12` | core logic | modify |
| `src/api/routes/checkout.ts:48` | caller | update call |
| `tests/checkout/applyCoupon.test.ts` | test | add cases |

## 6. Contracts
| Contract | Status | Breaking | Notes |
| :--- | :--- | :--- | :--- |
| `applyCoupon(order: Order, code: string): Result<Order, CouponError>` | CHANGED | no | adds `CouponExpiredError` variant |
| `POST /v1/checkout/coupon` returns 422 `{ "code": "COUPON_EXPIRED" }` | NEW | no | |
| `coupons.expires_at TIMESTAMPTZ NULL` | NEW | no | expand-only migration |

## 7. Risks
| Risk | Likelihood | Impact | Mitigation | Detection |
| :--- | :--- | :--- | :--- | :--- |
| Off-by-one at the expiry instant | M | M | Compare in UTC; boundary tests | AC2 tests |
| Migration locks a large table | L | H | Nullable column, no default, no backfill in the same step | Dry run on staging |

Rollback: <revert / flag off / down-migration (requires user confirmation on a shared database)>

## 8. Steps
### Step 1: <behaviour>
- Files: ...
- Test first: `<file> > <test name>` asserts ...
- Done when: ...
- Parallel: yes | no · Delegate: <subagent or none>
- Rollback: ...

### Step 2: <behaviour>
- ...

## 9. Verification
- `/verify full` gates expected to run: build, tests with coverage, security scan.
- E2E or manual checks: ...

## 10. Open questions
- Q1 (blocking): ...
- Q2 (non-blocking; default assumed: ...): ...

## 11. Deviations (fill in during execution)
- Step N changed because ...
````

## Filling it well

- **Goal:** one sentence a non-engineer would understand. If it needs two, the scope is probably two plans.
- **Acceptance criteria:** observable from outside the code (HTTP response, UI state, row in a table, log line), never "function X is called".
- **Affected code:** every row comes from a `grep_search` or `find_by_name` hit. Include tests and fixtures, not only source files.
- **Contracts:** exact types and payloads. "Returns the order" is not a contract; `Result<Order, CouponError>` is.
- **Risks:** at least consider data, security, performance, compatibility and operations. If a category truly does not apply, say so in one line.
- **Steps:** each step leaves the build green and is small enough to review in one sitting. The first step is usually contracts or types, so later steps (and subagents) can work against them in parallel.
- **Open questions:** blocking questions are asked before approval; non-blocking ones record the default you will assume, so the user can object.
