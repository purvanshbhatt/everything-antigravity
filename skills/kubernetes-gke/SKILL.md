---
name: kubernetes-gke
description: >-
  Deploys and operates workloads on Kubernetes and Google Kubernetes Engine:
  Autopilot vs Standard, Deployments, Services, Gateway API, requests and
  limits, HPA, probes, PodDisruptionBudgets, Secret Manager, Workload Identity,
  NetworkPolicies, rollouts, rollbacks and pod debugging. Use when writing
  manifests, Helm or Kustomize, when pods crash, stay Pending or fail probes,
  or when planning a GKE cluster.
---

# Kubernetes on GKE

Ship workloads that schedule, autoscale, survive node upgrades and roll back
cleanly, using keyless identity. Read cluster state before changing it, change
it declaratively from files in Git, and confirm every destructive step.

**Confirmation rule.** Before `kubectl delete`, `drain`, `cordon`, `scale --replicas=0`,
`replace --force`, `apply --prune`, `rollout undo` or `rollout restart` on a shared
cluster, `helm uninstall`/`rollback`, RBAC or NetworkPolicy edits in production,
or any `gcloud container clusters|node-pools delete|update`: print the context
and namespace, state exactly what changes, and wait for the user's explicit yes.

## When to use

- Writing or reviewing Deployments, Services, Gateway/HTTPRoute, HPA, PDB or NetworkPolicy manifests, Helm charts or Kustomize overlays.
- A pod is `CrashLoopBackOff`, `Pending`, `OOMKilled`, `ImagePullBackOff` or never becomes Ready, or a rollout is stuck.
- Choosing GKE Autopilot vs Standard, sizing requests, or tuning autoscaling.
- Giving pods access to Google Cloud APIs or Secret Manager without key files.

## When not to use

- Building or slimming the image: use `docker-containers`.
- Creating clusters, VPCs and IAM as code: use `terraform-iac`.
- A stateless HTTP service that does not need a cluster: Cloud Run via `cloud-devops`.
- The pipeline that deploys to the cluster: use `ci-cd-github-actions`.
- The pod is healthy but the application logic is wrong: use `/root-cause`.

## Workflow

1. **Pin the target before any command.**

   ```bash
   gcloud container clusters get-credentials CLUSTER --location LOCATION --project PROJECT
   kubectl config current-context
   kubectl get ns
   ```

   Pass `-n NAMESPACE` (and `--context` when several clusters are configured) on every command; never rely on the default namespace.

   **Check:** You can name the project, cluster and namespace that every following command targets.

2. **Choose the cluster mode** for new clusters using the table below. Default to Autopilot unless a listed Standard reason applies. Record the decision in the implementation plan artifact.

   **Check:** The plan names the mode and the specific reason.

3. **Write the workload manifest** from [manifests](references/manifests.md): immutable image tag or digest, requests on every container, startup/readiness/liveness probes, restricted `securityContext`, zone spread, and graceful shutdown (`preStop` delay plus a `terminationGracePeriodSeconds` longer than the app's drain time).

   ```bash
   kubectl apply --dry-run=server -f k8s/ -n NAMESPACE
   kubectl diff -f k8s/ -n NAMESPACE        # or: kubectl diff -k overlays/prod
   ```

   **Check:** Server-side dry run passes and the diff contains only intended changes.

4. **Size requests and autoscaling from data.** Use `kubectl top pod -n NAMESPACE --containers` or Cloud Monitoring. Set the memory request near steady-state peak and the memory limit equal to it. Set CPU requests from p95 usage. Use an HPA with `minReplicas >= 2` for anything behind a PDB.

   **Check:** `kubectl get hpa -n NAMESPACE` shows real targets, not `<unknown>`, and no container was `OOMKilled` in the last day.

5. **Wire identity and secrets without keys.** Grant IAM roles to the Kubernetes ServiceAccount through Workload Identity Federation for GKE, scoped to the specific resource:

   ```bash
   gcloud secrets add-iam-policy-binding db-password --project PROJECT_ID \
     --role=roles/secretmanager.secretAccessor \
     --member="principal://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/PROJECT_ID.svc.id.goog/subject/ns/NAMESPACE/sa/KSA_NAME"
   ```

   Mount secrets with the Secret Manager add-on (CSI) or sync them with External Secrets; never commit Secret YAML or service-account key JSON.

   **Check:** The app's first Google Cloud call succeeds with no `GOOGLE_APPLICATION_CREDENTIALS` file, and `git grep -n "kind: Secret"` finds no checked-in secret values.

6. **Default-deny the network, then allow.** Apply a namespace default-deny ingress policy, then allow only the callers each service needs. If you also default-deny egress, allow DNS to `kube-dns` on port 53 TCP and UDP.

   **Check:** A throwaway pod in another namespace cannot reach the service, and the intended caller still can.

7. **Roll out and watch.**

   ```bash
   kubectl apply -f k8s/ -n NAMESPACE                      # or: kubectl apply -k overlays/prod
   kubectl annotate deployment/web -n NAMESPACE --overwrite kubernetes.io/change-cause="web 1.4.2 (abc1234)"
   kubectl rollout status deployment/web -n NAMESPACE --timeout=5m
   kubectl rollout history deployment/web -n NAMESPACE
   ```

   If the rollout fails, gather evidence (step 8) and then propose `kubectl rollout undo deployment/web -n NAMESPACE [--to-revision=N]`, asking first on shared clusters.

   **Check:** Ready replicas equal desired replicas, and error rate and latency are unchanged on dashboards (see `observability-otel`).

8. **Debug from the outside in.** Events, then describe, then logs, then an ephemeral container. Never "fix" by deleting pods until you know the cause.

   ```bash
   kubectl get pods -n NAMESPACE -o wide
   kubectl describe pod POD -n NAMESPACE                     # read Events at the bottom
   kubectl events -n NAMESPACE --for pod/POD                 # or: kubectl get events -n NAMESPACE --sort-by=.metadata.creationTimestamp
   kubectl logs POD -n NAMESPACE -c app --previous           # logs from the crashed instance
   kubectl debug -it POD -n NAMESPACE --image=busybox:1.36 --target=app
   ```

   **Check:** You can name the failing condition from the status table in [debugging](references/debugging.md) and cite the event or log line that proves it.

## Patterns

### Autopilot vs Standard

| Factor | Autopilot | Standard |
| :--- | :--- | :--- |
| Nodes | Google provisions, scales and upgrades them | You manage node pools, machine types and upgrade windows |
| Billing | Per pod resource requests | Per node VM, whether pods use it or not |
| Restrictions | No privileged pods; host namespaces, hostPath and node agents limited to allowlisted cases | None beyond your own policies |
| Workload Identity | Always enabled | Enable with `--workload-pool=PROJECT_ID.svc.id.goog` |
| Choose it when | Most web, API and worker workloads; small platform teams | Privileged node agents, custom kernel or sysctl tuning, very dense bin-packing you can staff |

### Probes

| Probe | Question it answers | On failure | Rule |
| :--- | :--- | :--- | :--- |
| `startupProbe` | Has the app finished booting? | Restart after `failureThreshold x periodSeconds` | Use for slow starters; other probes wait until it passes |
| `readinessProbe` | Can it serve traffic right now? | Removed from Service endpoints; no restart | May check dependencies the request path needs, cheaply |
| `livenessProbe` | Is the process wedged beyond recovery? | Container restarted | Process-local only; never call the database or other services |

### Requests, limits and QoS

- Every container gets CPU and memory requests. Without them pods are `BestEffort`, evicted first, and HPA utilization is meaningless.
- Memory limit equals memory request, so OOM behaviour is predictable. Size runtime heaps to the limit (`-XX:MaxRAMPercentage=75`, Node `--max-old-space-size`).
- CPU limits cause throttling. On Standard, omit them for latency-sensitive services unless you have a reason. On Autopilot, follow its request and limit rules.

### Packaging: Helm or Kustomize

| Need | Choose |
| :--- | :--- |
| Your own services with per-environment differences | Kustomize overlays (`kubectl apply -k`), built into `kubectl` |
| Installing third-party software (ingress, cert-manager, operators) | The vendor's Helm chart, pinned by chart version |
| Distributing your app for others to install with many options | Helm chart |
| Reviewing what will actually be applied | `kubectl kustomize overlays/prod` or `helm template` and read the output |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `image: app:latest` | Immutable tag or `@sha256:` digest | Rollback and audit become guesswork; nodes may run stale cached images |
| Liveness probe that queries the database | Process-local liveness; dependency checks in readiness | A database blip restarts every pod at once |
| Containers without requests | Requests on every container | `BestEffort` pods are evicted first, and the scheduler bin-packs blindly |
| Service-account key JSON in a Secret | Workload Identity Federation for GKE | Long-lived keys leak and are rarely rotated |
| `kubectl edit` in production | Change the manifest in Git and apply it | Live edits drift from source and vanish on the next deploy |
| PDB with `minAvailable` equal to replicas | `maxUnavailable: 1` | Blocks node drains and GKE upgrades indefinitely |
| `kubectl delete pod` to "fix" a crash | Read events and previous logs first | Hides the cause and the evidence with it |
| Commands without `-n` or `--context` | Explicit namespace and context, checked first | The classic way to change production by accident |

## Verification checklist

- [ ] Context, project and namespace were confirmed before any mutating command.
- [ ] Images pinned by immutable tag or digest; every container has requests and probes.
- [ ] Liveness probes are process-local; startup probe covers slow boots.
- [ ] `securityContext`: `runAsNonRoot`, `allowPrivilegeEscalation: false`, `capabilities.drop: [ALL]`, `seccompProfile: RuntimeDefault`.
- [ ] HPA reports real metrics; PDB allows at least one disruption; pods spread across zones.
- [ ] No key files or committed Secret values; access granted to the KSA on specific resources only.
- [ ] Default-deny NetworkPolicy in place with explicit allows.
- [ ] Rollout completed, `change-cause` recorded, and dashboards show no regression.
- [ ] Every destructive command was confirmed by the user before it ran.

## Related

- Agents: `cloud-devops-engineer` (cluster and rollout work), `security-guard` (RBAC, NetworkPolicy and Pod Security review), `performance-optimizer` (resource tuning).
- Workflows: `/root-cause`, `/verify`, `/security-scan`.
- Knowledge: `docker-containers`, `terraform-iac`, `ci-cd-github-actions`, `observability-otel`, `cloud-devops`.
