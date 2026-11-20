# Pod and Rollout Debugging

Companion to the `kubernetes-gke` skill. Diagnose from evidence: every
conclusion should cite an event, a status field or a log line. All commands
below are read-only unless marked.

## Status to cause

| Symptom | Likely causes | Evidence to collect | Typical fix |
| :--- | :--- | :--- | :--- |
| `Pending` | Requests exceed free capacity; unbound PVC; node selector, affinity or taint mismatch; `DoNotSchedule` spread constraint; quota | `FailedScheduling` event text in `kubectl describe pod` | Right-size requests, fix selectors or tolerations, raise quota. On Autopilot a short `Pending` while nodes provision is normal |
| `ErrImagePull` / `ImagePullBackOff` | Wrong tag or digest; node identity lacks `roles/artifactregistry.reader`; registry in another project | Event message (`not found` vs `403`) | Fix the reference, or grant reader to the node service account on the repository |
| `CreateContainerConfigError` | Referenced ConfigMap, Secret or key missing | Event message names the missing object | Create the object or fix the key name |
| `CrashLoopBackOff` | App exits on start: bad config, missing env, unreachable dependency, wrong command | `kubectl logs POD -c app --previous`, exit code (below) | Fix the app or config; add a startup probe if it is merely slow |
| `OOMKilled` | Memory limit below real usage, leak, heap not sized to the limit | `lastState.terminated.reason`, memory graph | Raise request and limit together, size the heap, fix the leak |
| Running, not Ready | Readiness probe failing: wrong path or port, dependency down, slow warm-up | `Readiness probe failed` events; `kubectl port-forward` and request the endpoint | Fix the probe or the dependency; never "fix" by removing readiness |
| Restarts with `Liveness probe failed` | Probe too aggressive, no startup probe, liveness checks a dependency | Events and restart count | Add a startup probe, make liveness process-local, relax thresholds |
| `Evicted` | Node memory or disk pressure; `BestEffort` pods go first | `kubectl get pods --field-selector=status.phase=Failed` and the pod's status message | Set requests; reduce ephemeral storage use |
| Service has no endpoints | Selector does not match pod labels; pods not Ready | `kubectl get endpointslices -n NS -l kubernetes.io/service-name=web` | Align labels; fix readiness |
| Load balancer returns 502 or backends unhealthy | Health check path or port wrong; NetworkPolicy blocks health-check ranges; pods not Ready | Gateway or Ingress events, load balancer backend health in the console | Fix `HealthCheckPolicy`/probe path; allow health-check and proxy-only ranges |
| Rollout stuck | New pods fail readiness; `ProgressDeadlineExceeded`; quota | `kubectl rollout status`, `kubectl get deploy web -n NS -o jsonpath='{.status.conditions}'` | Fix and roll forward, or propose `rollout undo` (confirm first) |
| `403`/`PERMISSION_DENIED` calling Google APIs | Wrong KSA name or namespace in the IAM member; pod not using that KSA; IAM change still propagating | Pod `serviceAccountName`, the IAM policy on the resource, app error text | Correct the binding on the specific resource; wait a few minutes and retry |

## Exit codes

```bash
kubectl get pod POD -n NS -o jsonpath='{range .status.containerStatuses[*]}{.name}{"\t"}{.lastState.terminated.reason}{"\t"}{.lastState.terminated.exitCode}{"\n"}{end}'
```

| Code | Meaning |
| :--- | :--- |
| 0 | Process finished normally; a long-running server should never do this (wrong `CMD`?) |
| 1 | Application error; read `--previous` logs |
| 126 / 127 | Command not executable / not found: wrong entrypoint, or a shell-form command in an image without a shell |
| 137 | SIGKILL: OOM kill, or liveness failure after the grace period |
| 143 | SIGTERM: normal shutdown during rollout or scale-down |

## Toolbox

| Goal | Command |
| :--- | :--- |
| Recent events, newest last | `kubectl get events -n NS --sort-by=.metadata.creationTimestamp` |
| Events for one object | `kubectl events -n NS --for pod/POD` |
| Logs of every pod in a Deployment | `kubectl logs -n NS -l app.kubernetes.io/name=web --all-containers --prefix --since=15m` |
| Reach a pod or service locally | `kubectl port-forward svc/web 8080:80 -n NS` |
| Shell next to a distroless container | `kubectl debug -it POD -n NS --image=busybox:1.36 --target=app` |
| Debug a copy with a changed command (mutating: creates a pod) | `kubectl debug POD -n NS -it --copy-to=web-debug --container=app -- sh` |
| Resource usage | `kubectl top pod -n NS --containers` |
| RBAC check | `kubectl auth can-i --list -n NS --as=system:serviceaccount:NS:web` |
| Full live object | `kubectl get pod POD -n NS -o yaml` |
| Cloud Logging for a container | `gcloud logging read 'resource.type="k8s_container" AND resource.labels.namespace_name="NS" AND resource.labels.container_name="app"' --freshness=1h --limit=50` |

Node-level debugging (`kubectl debug node/NODE`) works on Standard clusters only;
Autopilot blocks privileged node access by design.

## Rollback decision

1. Is the new version the cause? Compare the rollout start time with the first
   error in logs and metrics.
2. If yes and users are affected, propose rollback with the exact command and
   target revision from `kubectl rollout history deployment/web -n NS`, and wait
   for confirmation.
3. After rollback, `kubectl rollout status` must succeed and metrics recover.
   Keep the failed revision's evidence (events, logs) for `/root-cause`.
4. Roll forward with a fix through the normal pipeline; do not leave the cluster
   diverged from Git.
