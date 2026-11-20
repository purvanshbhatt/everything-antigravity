# CODEMAP Template

Fill this in for `/codebase-onboard`. Every row cites a path, ideally `file:line`. Keep it under ~300 lines: link to code, don't paste it. Never record secret values; environment variables are listed by name only. The sample rows show the expected level of detail; replace them.

````markdown
# CODEMAP: <repository name>
Last updated: <yyyy-mm-dd> at <short commit sha> · Owners: <team, or see CODEOWNERS>

## 1. Purpose
<Two sentences: what this system does and for whom.>

## 2. Stack
| Concern | Choice | Evidence |
| :--- | :--- | :--- |
| Language / runtime | TypeScript, Node 20 | `package.json` `engines` |
| Framework | Next.js (app router) | `apps/web/app/` |
| Data | PostgreSQL via Prisma | `packages/db/prisma/schema.prisma` |
| Package manager | pnpm workspaces | `pnpm-workspace.yaml` |
| Deploy | Cloud Run via GitHub Actions | `.github/workflows/deploy.yml` |

## 3. Commands
| Task | Command | Source | Verified |
| :--- | :--- | :--- | :--- |
| Install | `pnpm install` | README | yes |
| Dev server | `pnpm dev` | `package.json` | no |
| Type-check | `pnpm typecheck` | `.github/workflows/ci.yml` | yes |
| Tests | `pnpm test` | `ci.yml` | yes |
| Build | `pnpm build` | `ci.yml` | no |

## 4. Layout
```text
apps/web/        Next.js UI and API route handlers
apps/worker/     Queue consumers
packages/core/   Domain logic; no I/O
packages/db/     Prisma client and repositories
infra/           Terraform
```

## 5. Entry points
| Unit | Entry | Notes |
| :--- | :--- | :--- |
| Web app | `apps/web/app/layout.tsx:1` | Root layout |
| HTTP API | `apps/web/app/api/**/route.ts` | Route handlers |
| Worker | `apps/worker/src/main.ts:12` | Consumes the `orders` queue |

## 6. Architecture
Layers, with arrows pointing at what each layer may import:

```text
UI -> application -> domain <- data access <- infrastructure
```

Known violations (facts, not judgments):
- `packages/core/src/pricing.ts:7` imports the Prisma client directly.

## 7. Request trace: <most important user action>
1. `apps/web/app/checkout/page.tsx:40` form submit calls `POST /api/checkout`
2. `apps/web/app/api/checkout/route.ts:15` validates the body with the `CheckoutInput` schema; checks the session
3. `packages/core/src/checkout.ts:88` `placeOrder()` prices the cart and applies coupons
4. `packages/db/src/orders.ts:30` inserts the order and lines in one transaction
5. Side effect: publishes `order.created` (`packages/core/src/events.ts:12`); consumed at `apps/worker/src/orders.ts:20`
6. Errors: domain errors map to HTTP codes in `apps/web/lib/http-errors.ts:5`

## 8. Key modules
| Module | Responsibility | Public interface | Depends on |
| :--- | :--- | :--- | :--- |
| `packages/core/src/checkout.ts` | Order placement | `placeOrder()` | pricing, db repositories |

## 9. Data
| Store | Schema source | Migrations | Notes |
| :--- | :--- | :--- | :--- |
| PostgreSQL | `packages/db/prisma/schema.prisma` | `packages/db/prisma/migrations/` | Soft deletes via `deletedAt` |

## 10. Configuration
| Env var (name only) | Read at | Required |
| :--- | :--- | :--- |
| `DATABASE_URL` | `packages/db/src/client.ts:3` | yes |

## 11. Conventions
- Errors: domain functions return `Result`; only route handlers throw HTTP errors.
- Logging: structured logger from `packages/core/src/log.ts`; no `console.log`.
- Tests: colocated `*.test.ts`; factories in `packages/core/test/factories.ts`.
- Commits and branches: Conventional Commits; `feat/*`, `fix/*` branches; squash merge.

## 12. Hot spots and risks
| File | Why | Evidence |
| :--- | :--- | :--- |
| `packages/core/src/pricing.ts` | Most-changed file in 90 days | `git log` churn count |

## 13. Open questions
- <Things you could not determine, and who might know.>
````

## Refresh rules

- Update the `Last updated` line and commit sha on every refresh.
- When a section no longer matches the code, fix the section; don't append contradicting notes.
- If the repository is large, keep one CODEMAP per top-level package and link them from a short root CODEMAP.
