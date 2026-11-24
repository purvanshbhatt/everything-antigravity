---
name: gitops-argocd
disable-model-invocation: true
description: >-
  Runs Kubernetes delivery through GitOps with Argo CD or Flux: repository
  layout, Applications, AppProjects, app-of-apps and ApplicationSets, sync
  policies with prune and self-heal, sync waves and hooks, drift and
  OutOfSync debugging, secrets that never land in Git, and promotion of
  image digests between environments by pull request. Use when setting up
  Argo CD or Flux, adding an app or environment, or fixing sync problems.
---

# GitOps with Argo CD and Flux

Git is the only way to change a cluster: every environment is a directory,
every change is a reviewed pull request, controllers reconcile continuously,
and promotion means moving an image digest that already passed the previous
environment.

## When to use

- Bootstrapping Argo CD or Flux on a cluster, or onboarding a new service.
- Structuring a deployment repo for dev, staging and prod.
- Apps stuck `OutOfSync`, `Degraded` or `Progressing`; drift from manual `kubectl` edits.
- Designing how releases move between environments.

## When not to use

- Writing the chart itself: use `helm-charts`. Kubernetes object design: use `kubernetes-gke`.
- Building and testing images in CI: use `ci-cd-github-actions`.
- Release notes, versioning and changelogs: use `/release-management`.
- Non-Kubernetes infrastructure: use `terraform-iac`.

## Workflow

Commands work in bash and PowerShell. Anything that syncs to a shared cluster, enables pruning, deletes an Application or bootstraps a controller changes live workloads: confirm with the user first.

1. **Lay out the deployment repository.**

   ```text
   deploy/
   ├── apps/api/base/                 # Deployment, Service, kustomization.yaml
   ├── apps/api/overlays/dev/         # kustomization.yaml: image digest, replicas, config
   ├── apps/api/overlays/staging/
   ├── apps/api/overlays/prod/
   └── clusters/prod/                 # Applications or Flux Kustomizations for this cluster
   ```

   Keep app source and deployment config in separate repos (or at least separate paths with separate owners), so CI can open PRs against the deploy repo without touching code.

   **Check:** Each environment differs only by a small overlay or values file.

2. **Install the controller pinned to a version.**

   ```bash
   helm repo add argo https://argoproj.github.io/argo-helm
   helm install argocd argo/argo-cd -n argocd --create-namespace --version CHART_VERSION
   argocd admin initial-password -n argocd     # let the user read it; switch to SSO and disable admin after
   ```

   Flux: `flux check --pre`, then `flux bootstrap github --owner=ORG --repository=fleet --branch=main --path=clusters/prod` (needs a `GITHUB_TOKEN` the user provides; it commits to the repo and creates a deploy key).

   **Check:** All controller pods are Ready, and access goes through SSO with RBAC rather than the shared admin account.

3. **Fence each team with an AppProject.**

   ```yaml
   apiVersion: argoproj.io/v1alpha1
   kind: AppProject
   metadata: { name: prod, namespace: argocd }
   spec:
     sourceRepos: ["https://github.com/ORG/deploy.git"]
     destinations: [{ server: https://kubernetes.default.svc, namespace: "api" }]
     clusterResourceWhitelist: []        # no cluster-scoped resources
   ```

   **Check:** An Application in this project pointing at another namespace or repo is rejected.

4. **Declare the Application.**

   ```yaml
   apiVersion: argoproj.io/v1alpha1
   kind: Application
   metadata:
     name: api-prod
     namespace: argocd
     finalizers: [resources-finalizer.argocd.argoproj.io]   # deleting the app deletes its resources
   spec:
     project: prod
     source:
       repoURL: https://github.com/ORG/deploy.git
       targetRevision: main
       path: apps/api/overlays/prod
     destination: { server: https://kubernetes.default.svc, namespace: api }
     syncPolicy:
       automated: { prune: true, selfHeal: true }
       syncOptions: [CreateNamespace=true, ServerSideApply=true]
       retry: { limit: 5, backoff: { duration: 10s, factor: 2, maxDuration: 3m } }
   ```

   Start new apps without `automated` and sync by hand (`argocd app diff api-prod`, then `argocd app sync api-prod`); enable `prune` and `selfHeal` once the diff is clean.

   **Check:** `argocd app get api-prod` shows `Synced` and `Healthy`.

5. **Scale out with app-of-apps or an ApplicationSet.**

   ```yaml
   apiVersion: argoproj.io/v1alpha1
   kind: ApplicationSet
   metadata: { name: prod-apps, namespace: argocd }
   spec:
     goTemplate: true
     generators:
       - git:
           repoURL: https://github.com/ORG/deploy.git
           revision: main
           directories: [{ path: "apps/*/overlays/prod" }]
     template:
       metadata: { name: "{{index .path.segments 1}}-prod" }
       spec:
         project: prod
         source: { repoURL: "https://github.com/ORG/deploy.git", targetRevision: main, path: "{{.path.path}}" }
         destination: { server: https://kubernetes.default.svc, namespace: "{{index .path.segments 1}}" }
   ```

   A new directory becomes a new Application; removing one deletes it, so protect prod with review rules on the repo.

   **Check:** `argocd app list` shows one Application per directory with the expected names.

6. **Order and guard syncs.** Annotate resources with `argocd.argoproj.io/sync-wave: "-1"` (namespaces, CRDs, config before workloads), and use hooks such as a `PreSync` migration Job with `argocd.argoproj.io/hook: PreSync` and `argocd.argoproj.io/hook-delete-policy: HookSucceeded`. Ignore fields owned by other controllers:

   ```yaml
   ignoreDifferences:
     - group: apps
       kind: Deployment
       jsonPointers: [/spec/replicas]     # owned by the HPA
   ```

   with `RespectIgnoreDifferences=true` in `syncOptions`.

   **Check:** A sync applies resources in wave order and the app does not flap OutOfSync because of HPA changes.

7. **Keep secrets out of Git.** Prefer External Secrets Operator pulling from Secret Manager (or Vault); alternatives are Sealed Secrets (`kubeseal`) or SOPS-encrypted files. Never commit a plain `Secret`, even base64-encoded.

   **Check:** A search of the deploy repo for `kind: Secret` finds only encrypted or generated objects.

8. **Promote by pull request.** CI builds once and records the digest; a PR updates the dev overlay:

   ```bash
   cd apps/api/overlays/dev
   kustomize edit set image api=REGION-docker.pkg.dev/PROJECT_ID/app/api@sha256:DIGEST
   ```

   After checks pass in dev, a PR copies the same digest to staging, then prod (with user approval). Tools such as Argo CD Image Updater or Kargo automate this; verify their current status before adopting.

   **Check:** Prod runs a digest that previously ran in staging; `git log` on the prod overlay is the deployment history.

## Reference

### Debugging

| Symptom | Command or cause | Fix |
| :--- | :--- | :--- |
| `OutOfSync` that never clears | `argocd app diff APP`; defaulted fields or other controllers | `ServerSideApply=true` or `ignoreDifferences` |
| Stale view of Git | `argocd app get APP --hard-refresh` | Check repo credentials and webhook |
| `Progressing` forever | Health check waits on a rollout or Ingress address | `kubectl describe` the resource; fix probes |
| Manual hotfix reverted | `selfHeal` restored Git state | Commit the fix to Git; to pause: `argocd app set APP --sync-policy none` |
| Need the previous release now | `argocd app history APP`, `argocd app rollback APP ID` (auto-sync must be off) | Then revert the commit in Git and re-enable sync |
| Flux not applying | `flux get kustomizations -A`, `flux reconcile kustomization NAME --with-source` | Read the `Ready` condition message |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `kubectl apply` or edit in a GitOps cluster | Commit and let the controller sync | Self-heal reverts it, or drift goes unseen |
| Branch per environment | Directory or overlay per environment on one branch | Merges between env branches drift and conflict |
| Rebuild the image for each environment | Promote the same digest | What you tested is what you ship |
| Plain Secrets in Git | External Secrets, Sealed Secrets or SOPS | Git history keeps secrets forever |
| Track `HEAD` of a chart or `latest` image | Pinned chart versions and digests | Unreviewed changes reach prod |
| Enable `prune` on day one for imported apps | Manual sync until the diff is clean | Prune deletes anything not yet in Git |

## Verification checklist

- [ ] Controller version is pinned; access uses SSO and RBAC.
- [ ] Every Application belongs to a restrictive AppProject.
- [ ] Apps are `Synced` and `Healthy`; `prune` enabled only after a clean diff.
- [ ] No plain secrets in the repo.
- [ ] Promotion moves a tested digest via reviewed PRs; prod changes were approved by the user.
- [ ] Rollback procedure (Git revert, or `argocd app rollback` with auto-sync off) is documented.

## Related

- Knowledge: `helm-charts`, `kubernetes-gke`, `ci-cd-github-actions`, `secrets-management`, `git-workflow`, `platform-engineering`, `terraform-iac`.
- Workflows: `/release-management`.
- Agents: `cloud-devops-engineer`, `sre-engineer`.
