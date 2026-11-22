---
name: platform-engineering
description: >-
  Builds internal developer platforms as products: finding developer friction,
  golden paths from repo template to production, self-service infrastructure
  through reviewed IaC modules, a service catalog (Backstage catalog-info.yaml),
  production-readiness scorecards and adoption metrics such as DORA and time to
  first deploy. Use when standardising how teams build and ship services,
  creating service templates, or deciding what a platform team should build.
---

# Platform Engineering

A platform is a product whose users are developers. Its job is to make the
right way the easy way: a paved golden path that most teams choose because it
is faster, not because it is mandated. Start thin (docs, templates, modules)
and automate only what people actually repeat.

## When to use

- Several teams solve the same problems differently: CI, deploys, observability, secrets.
- New services take days or weeks to reach production.
- Designing service templates, a service catalog or production-readiness scorecards.
- Deciding the platform team's roadmap or whether to adopt a portal such as Backstage.

## When not to use

- A single team's CI pipeline: use `ci-cd-github-actions`.
- Writing the Terraform or Pulumi modules themselves: use `terraform-iac` or `pulumi`.
- Kubernetes cluster operations: use `kubernetes-gke` and `gitops-argocd`.
- Monorepo build tooling: use `monorepo-tooling`.

## Workflow

1. **Find the friction.** Interview five to ten developers and map the path from idea to production: repo creation, CI, environments, secrets, deploy, observability, on-call. Time each step and note the waits and tickets. Use `grep_search` across repos (or delegate to the `codebase-explorer` subagent) to inventory how teams currently do CI, Dockerfiles and deploys.

   **Check:** A value-stream table lists each step with its time, wait and pain, ranked.

2. **Pick one golden path.** Choose the most common workload (for example an HTTP service on Cloud Run with Postgres) and the top two or three pains on its path. Write the scope in a short plan artifact and get the user's agreement.

   **Check:** The path names the stack, the steps it covers and what it explicitly leaves out.

3. **Build the template.** A repo template that works on day one: app skeleton, Dockerfile, CI with tests and scans, deploy to a dev environment, health checks, structured logging, OpenTelemetry, dashboards and alerts, runbook stub, `catalog-info.yaml`, and project-level agent skills under `.agents/skills/` so Antigravity follows the team's conventions in every new repo.

   **Check:** A new service generated from the template reaches a deployed dev URL with green CI in under an hour, without tickets.

4. **Offer self-service infrastructure.** Expose reviewed IaC modules (database, bucket, queue) through a pull request or a portal form that renders IaC, never through console click-ops. Policy checks (tflint, checkov, OPA or Pulumi policy packs) run in CI.

   **Check:** A developer can request a database by PR and get it after automated checks plus one review.

5. **Catalogue services.** Every service has an owner, lifecycle, system, on-call and links in a machine-readable file.

   **Check:** The catalogue shows an owner for every production service, and no orphans.

6. **Add scorecards.** Score services against production-readiness checks (table below), show them to teams, and fix the platform when many teams fail the same check.

   **Check:** Each check is automated, with a link explaining how to pass it.

7. **Measure and iterate.** Track adoption and outcome metrics, run a short developer survey each quarter, and treat the roadmap like a product backlog.

   **Check:** Metrics are reported quarterly and the next golden-path improvement comes from the data.

## Patterns

### Backstage catalog entry

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: payments-api
  description: Payment authorisation API
  annotations:
    github.com/project-slug: acme/payments-api
spec:
  type: service
  lifecycle: production
  owner: team-payments
  system: payments
  providesApis: [payments-api]
```

Without a portal, the same file still works as a greppable catalogue that scripts can validate.

### Production-readiness scorecard

| Check | Evidence |
| :--- | :--- |
| Owner and on-call defined | Catalogue entry with team and rotation |
| CI runs tests, lint and security scans | Required status checks on the default branch |
| Health checks and graceful shutdown | Readiness endpoint; SIGTERM handled |
| SLOs and paging alerts with runbooks | Alert policies link `docs/runbooks/` |
| Structured logs, traces and metrics | OpenTelemetry configured; dashboard link |
| Secrets from a secret manager | No secrets in env files or images |
| Backups and restore tested (stateful) | Last drill date under 90 days |
| Dependencies kept current | Renovate or Dependabot enabled; no critical CVEs open |

### Platform metrics

| Metric | Why |
| :--- | :--- |
| Time to first deploy for a new service | Measures the golden path directly |
| DORA: deploy frequency, lead time, change failure rate, time to restore | Delivery outcome across teams |
| Golden-path adoption (percent of services) | Product-market fit of the platform |
| Platform tickets per team per month | Self-service gaps |
| Developer satisfaction (quarterly survey) | Catches friction that metrics miss |

### Build, buy or document

Document first when only one or two teams need it. Template when a pattern repeats across three or more services. Automate or adopt a portal when templates exist and teams still wait on tickets. Buy managed services (Cloud Run, managed databases) rather than building internal versions of them.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Build a portal before a paved path | Template and modules first, portal later | A portal over chaos is still chaos |
| Mandate the platform | Make it the fastest path, with escape hatches | Mandates breed workarounds and resentment |
| Hide everything behind abstraction | Let teams see and override the generated IaC | Opaque platforms block debugging |
| Template once and forget | Version templates and offer upgrade PRs | Generated repos drift and rot |
| Measure success by features shipped | Measure adoption and developer time saved | Unused features are cost, not value |
| Platform team as ticket queue | Self-service with policy checks | Tickets are the friction you set out to remove |

## Verification checklist

- [ ] Friction map exists, built from developer interviews and timings.
- [ ] The golden path takes a new service to dev in under an hour without tickets.
- [ ] Self-service infra goes through reviewed IaC with policy checks.
- [ ] Every production service has a catalogue entry with an owner.
- [ ] Scorecard checks are automated and documented.
- [ ] Adoption and DORA metrics are reported on a schedule.

## Related

- Agents: `cloud-devops-engineer`, `sre-engineer`, `code-architect`, `codebase-explorer`.
- Workflows: `/skill-create` (team skills shipped in templates), `/dockerize`.
- Knowledge: `terraform-iac`, `pulumi`, `ci-cd-github-actions`, `gitops-argocd`, `kubernetes-gke`, `cloud-run`, `observability-otel`, `runbooks-oncall`, `antigravity-customization`.
