---
name: feature-flags
description: >-
  Uses feature flags safely: release, experiment, ops kill-switch and
  entitlement flag types, targeting and percentage rollouts with sticky
  bucketing, server vs client evaluation, OpenFeature and providers such as
  Firebase Remote Config, fail-safe defaults, testing both paths, and flag
  debt cleanup with owners and expiry dates. Use when shipping behind a flag,
  planning a gradual rollout or kill switch, choosing a provider, or removing
  stale flags.
---

# Feature Flags

Flags separate deploy from release, which makes rollouts gradual and rollback
instant. Unmanaged, they become a combinatorial explosion of untested paths,
leaked roadmap details and dead code. Treat each flag as a short-lived,
owned piece of configuration with a type, a safe default and a removal date.

## When to use

- Shipping incomplete or risky work to production behind a toggle (trunk-based development).
- Gradual rollouts (internal, 1%, 10%, 50%, 100%) with a fast rollback.
- Kill switches for expensive or fragile features (a third-party integration, an AI feature).
- Gating features by plan or customer; choosing a flag provider; cleaning up stale flags.

## When not to use

- Experiment design, sample sizes and statistical analysis: use `ab-testing`.
- Long-lived application configuration (timeouts, URLs): use config files and `secrets-management`.
- Release versioning, changelogs and rollback of deployments: use `/release-management`.
- Authorization: entitlements may use flags, but access control belongs in `auth-patterns`.

## Workflow

1. **Classify the flag.** Pick a type from the table below; the type decides lifetime, owner and who may change it.

   **Check:** The flag's type, owner and expected removal date are written down before the first line of code.

2. **Register it with metadata.** Key (`checkout.new-flow`), type, description, owner, created date, expiry date, linked ticket, default value, and the metric that decides success. Keep definitions in the provider and mirror them in the repo (a `flags.yaml` or typed constants) so code search finds every use.

   **Check:** Every flag key used in code exists in the registry, and vice versa.

3. **Evaluate once at the edge of the decision.** Resolve the flag once per request or job and pass the result down; branch in one place, ideally by choosing an implementation (strategy) rather than scattering `if` checks.

   **Check:** `grep_search` for the flag key returns one evaluation site per service.

4. **Make defaults fail safe.** The in-code default is what users get when the provider is unreachable, slow or misconfigured: choose the old, proven behaviour for release flags, and normal operation for kill switches (they act only when explicitly set). Bound provider initialization time and keep the last known values.

   **Check:** A test with the provider unavailable shows the default path and acceptable startup time.

5. **Keep sensitive evaluation on the server.** Client-side flag payloads are visible to users: flag names, rules and variants can reveal unreleased products. Evaluate server-side for anything sensitive, and send the client only the resolved values it needs.

   **Check:** The client bundle and flag payload contain no unreleased product names or targeting rules.

6. **Roll out deliberately.** Internal users, then 1%, 5%, 25%, 50%, 100%, holding each step long enough to read guardrail metrics (error rate, latency, conversion). Bucket deterministically by hashing flag key plus a stable targeting key so users keep their variant. Changing production flag targeting is a user-visible production change: confirm each step with the user and note who approved it.

   **Check:** Rollback criteria are written before the first step, and turning the flag off was rehearsed in staging.

7. **Test both paths.** Unit tests cover on and off; CI runs critical suites with the flag forced each way (OpenFeature in-memory provider or provider overrides). Avoid testing every combination of flags; keep flags independent instead.

   **Check:** Coverage shows both branches of every active release flag executed in CI.

8. **Observe flag state.** Attach the flag key and variant to logs and trace spans for affected requests, and record flag change events (who, when, what) next to deploys on dashboards.

   **Check:** An error spike can be correlated to a flag change from the dashboard alone.

9. **Remove flags promptly.** Once at 100% (or abandoned) for the agreed soak period, delete the flag in code and in the provider in one change, including tests and dead branches. Alert on flags past expiry and cap open release flags per team.

   **Check:** No release flag is older than its expiry date in the registry report.

## Patterns

### Flag types

| Type | Purpose | Lifetime | Changed by |
| :--- | :--- | :--- | :--- |
| Release | Hide unfinished or risky code, gradual rollout | Days to weeks | Engineering |
| Experiment | Compare variants against a metric | One experiment | Product with analytics |
| Ops (kill switch) | Degrade or disable a feature under load or failure | Long-lived, reviewed | On-call |
| Permission or entitlement | Plan or customer gating | Long-lived; often belongs in billing or entitlements | Product and sales operations |

### OpenFeature evaluation (TypeScript, server)

```ts
import { OpenFeature } from '@openfeature/server-sdk';

await OpenFeature.setProviderAndWait(provider);   // flagd, Flagsmith, Unleash, GrowthBook, LaunchDarkly, ...
const flags = OpenFeature.getClient();

const useNewCheckout = await flags.getBooleanValue('checkout.new-flow', false, {
  targetingKey: user.id, plan: user.plan, country: user.country,
});
```

OpenFeature keeps call sites vendor-neutral; swap providers without touching evaluation code. For mobile and web apps on Firebase, Remote Config provides rollouts and A/B testing tied to Google Analytics.

### Sticky percentage bucketing

```ts
import { createHash } from 'node:crypto';

export function bucket(flagKey: string, targetingKey: string): number {
  const digest = createHash('sha256').update(`${flagKey}:${targetingKey}`).digest();
  return digest.readUInt32BE(0) % 10_000;            // 0..9999, 0.01% resolution
}
export const isEnabled = (flagKey: string, userId: string, percent: number) =>
  bucket(flagKey, userId) < percent * 100;
```

Including the flag key gives each flag an independent population; raising the percentage only adds users, never reshuffles them.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Flags with no owner or expiry | Registry with owner, ticket and expiry | Flag debt accumulates into untestable code |
| The same check copied into ten files | One evaluation, pass the decision down | Partial rollouts behave inconsistently |
| Default that enables the new path | Default to the proven path | A provider outage releases unfinished work |
| Random per-request bucketing | Hash of flag key plus stable ID | Users flip between variants |
| Reuse an old flag key for a new feature | New key per feature | Stale targeting rules apply to new code |
| Unreleased product names in client flags | Server-side evaluation, neutral keys | Leaks roadmap to anyone with dev tools |
| Nested flags depending on each other | Independent flags or one multi-variant flag | Combinations nobody tested |

## Verification checklist

- [ ] Flag type, owner, default, success metric and expiry are registered.
- [ ] One evaluation site per service; the default path is the safe path.
- [ ] Sensitive flags are evaluated server-side only.
- [ ] Rollout steps, guardrail metrics and rollback criteria are written and confirmed.
- [ ] Both paths are tested in CI.
- [ ] A removal ticket exists, and stale flags are reported automatically.

## Related

- Knowledge: `ab-testing`, `product-analytics`, `ci-cd-github-actions`, `observability-otel`, `tech-debt`, `secrets-management`.
- Workflows: `/release-management`, `/feature-dev`.
- Agents: `sre-engineer`, `product-manager`.
