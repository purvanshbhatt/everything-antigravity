# Enforcement configs, layouts and templates

## Module layouts (feature first, layers inside)

```text
src/                         # TypeScript
  orders/
    domain/        order.ts, money.ts, ports.ts      # no framework imports
    application/   place-order.ts                    # use cases, transaction boundary
    adapters/      http/, postgres/, stripe/         # framework and SDK code
    index.ts                                         # the module's only public API
  billing/ ...
  main.ts                                            # composition root

app/                         # Python
  orders/{domain,application,adapters}/__init__.py
  main.py

internal/                    # Go: internal/ is compiler-enforced privacy
  orders/
    order.go service.go      # domain + use cases, ports as small interfaces
    postgres/ httpapi/       # adapters import orders, never the reverse
cmd/api/main.go              # wiring
```

## dependency-cruiser (JavaScript / TypeScript)

```bash
npx depcruise --init                      # generates .dependency-cruiser.js or .cjs
npx depcruise src --config .dependency-cruiser.cjs
npx depcruise src --config .dependency-cruiser.cjs --output-type dot | dot -T svg > deps.svg   # needs Graphviz
```

```js
// .dependency-cruiser.cjs (add to the generated `forbidden` array)
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      severity: 'error',
      from: { path: '^src/[^/]+/domain/' },
      to: { path: '(^src/[^/]+/(adapters|application)/)|node_modules' },
    },
    {
      name: 'no-deep-imports-across-modules',
      comment: 'Other modules must import through index.ts',
      severity: 'error',
      from: { path: '^src/([^/]+)/' },
      to: { path: '^src/([^/]+)/(?!index\\.ts$)', pathNot: '^src/$1/' },
    },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: { tsConfig: { fileName: 'tsconfig.json' } },
};
```

To ratchet on a legacy codebase, generate a baseline of known violations and fail only on new ones:

```bash
npx depcruise src --config .dependency-cruiser.cjs --output-type baseline > .dependency-cruiser-known-violations.json
npx depcruise src --config .dependency-cruiser.cjs --ignore-known
```

## import-linter (Python)

```toml
# pyproject.toml
[tool.importlinter]
root_package = "app"

[[tool.importlinter.contracts]]
name = "Layers inside orders"
type = "layers"
layers = [
    "app.orders.adapters",
    "app.orders.application",
    "app.orders.domain",
]

[[tool.importlinter.contracts]]
name = "Domain is framework free"
type = "forbidden"
source_modules = ["app.orders.domain", "app.billing.domain"]
forbidden_modules = ["fastapi", "sqlalchemy", "google.cloud"]

[[tool.importlinter.contracts]]
name = "Modules are independent"
type = "independence"
modules = ["app.orders", "app.billing"]
```

Run with `lint-imports` (install `import-linter` in the dev dependencies). Higher layers may import lower ones; the reverse fails. To ban third-party packages, `include_external_packages = true` must be set under `[tool.importlinter]`.

## ArchUnit (Java / Kotlin on the JVM)

```java
@AnalyzeClasses(packages = "com.acme.shop")
class ArchitectureTest {
  @ArchTest
  static final ArchRule layers = layeredArchitecture().consideringAllDependencies()
      .layer("Adapters").definedBy("..adapters..")
      .layer("Application").definedBy("..application..")
      .layer("Domain").definedBy("..domain..")
      .whereLayer("Adapters").mayNotBeAccessedByAnyLayer()
      .whereLayer("Application").mayOnlyBeAccessedByLayers("Adapters")
      .whereLayer("Domain").mayOnlyBeAccessedByLayers("Application", "Adapters");

  @ArchTest
  static final ArchRule domainIsPure = noClasses().that().resideInAPackage("..domain..")
      .should().dependOnClassesThat().resideInAnyPackage("org.springframework..", "jakarta.persistence..");

  @ArchTest
  static final ArchRule noCycles = slices().matching("com.acme.shop.(*)..").should().beFreeOfCycles();
}
```

ArchUnit's `FreezingArchRule.freeze(rule)` records existing violations and fails only on new ones (the ratchet).

## Go

- Put module internals under `internal/`; the compiler rejects imports from outside the parent tree.
- Keep interfaces (ports) in the consuming package, small (one to three methods).
- For explicit deny lists use the `depguard` linter in golangci-lint, or `go list -deps ./internal/orders/... | grep <forbidden>` as a CI script. Check the current golangci-lint docs for the config schema, which changed between v1 and v2.

## ADR template (Nygard format, extended)

```markdown
# NNNN. <Decision in a short noun phrase>

- Status: Proposed | Accepted | Superseded by NNNN | Deprecated
- Date: YYYY-MM-DD
- Deciders: <names or roles>

## Context
The forces at play: drivers (with numbers), constraints, what is true today.

## Options considered
1. <Option A>: pros, cons, cost, reversibility.
2. <Option B>: ...
3. Do nothing: what happens if we don't decide.

## Decision
We will <decision>, because <the driver it satisfies best>.

## Consequences
- Positive: ...
- Negative / accepted risk: ...
- Follow-ups: fitness functions, migrations, docs to update.
```

Store ADRs in `docs/adr/`, number them monotonically, never edit an accepted ADR's decision: supersede it with a new one and link both ways.

## Fitness functions (examples)

| Driver | Fitness function | Where it runs |
| :--- | :--- | :--- |
| Modularity | dependency-cruiser / import-linter / ArchUnit rules, zero cycles | Every PR |
| Latency | k6 `thresholds: { http_req_duration: ['p(95)<200'] }` against staging | Nightly or pre-release |
| Front-end weight | Bundle-size budget (for example size-limit) | Every PR |
| Deployability | Build plus test time under N minutes | CI dashboard alert |
| Security | No high CVEs (`osv-scanner`, `npm audit`, `pip-audit`) | Every PR |
| Data ownership | No cross-module SQL (grep or query-log check for foreign table names) | Every PR |

Start with the two or three that guard the top drivers; a dashboard of twenty ignored checks is worse than none.
