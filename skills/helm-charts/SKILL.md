---
name: helm-charts
disable-model-invocation: true
description: >-
  Authors and operates Helm charts: chart layout, values design with a JSON
  schema, template helpers and common pitfalls, lint, render and schema
  validation, unit and install tests, upgrades with history and rollback,
  dependencies, and publishing to OCI registries such as Artifact Registry.
  Use when writing or reviewing a chart, templating Kubernetes manifests,
  debugging a failed helm upgrade, or packaging charts for other teams.
---

# Helm Charts

Treat a chart as a versioned API: a small, documented, schema-validated
`values.yaml`, templates that render clean manifests, tests that run in CI, and
releases that can be diffed before upgrade and rolled back after.

## When to use

- Creating a chart for a service, or reviewing someone else's chart.
- `helm upgrade` failed, hung, or produced unexpected manifests.
- Designing values so environments differ only by small override files.
- Publishing charts to an OCI registry for other teams or Argo CD.

## When not to use

- Kubernetes objects themselves (probes, resources, autoscaling, RBAC): use `kubernetes-gke`.
- Continuous delivery and promotion of releases: use `gitops-argocd`.
- Plain overlays without templating: Kustomize is often enough; see `gitops-argocd`.
- Cluster infrastructure: use `terraform-iac`.

## Workflow

Helm 4 was released in late 2025 and changed some flags and defaults; run `helm version` and check `helm upgrade --help` before copying flags. Commands below work in bash and PowerShell unless noted.

1. **Scaffold, then delete what you do not need.**

   ```text
   chart/
   ├── Chart.yaml            # apiVersion: v2, name, version (chart SemVer), appVersion
   ├── values.yaml           # documented defaults
   ├── values.schema.json    # validates values on install, upgrade, lint and template
   ├── templates/_helpers.tpl
   ├── templates/deployment.yaml, service.yaml, ...
   ├── templates/NOTES.txt
   └── templates/tests/test-connection.yaml
   ```

   `helm create chart` produces this; remove unused templates such as ingress or HPA if the service does not need them.

   **Check:** Every template maps to something the service actually runs.

2. **Design values deliberately.** Group by concern (`image`, `resources`, `service`, `env`, `podSecurityContext`), keep defaults safe for production, and add a schema:

   ```json
   {
     "$schema": "https://json-schema.org/draft-07/schema#",
     "type": "object",
     "required": ["image"],
     "properties": {
       "image": {"type": "object", "required": ["repository"],
         "properties": {"repository": {"type": "string"}, "tag": {"type": "string"}, "digest": {"type": "string"}}},
       "replicaCount": {"type": "integer", "minimum": 1}
     }
   }
   ```

   Secrets never go in values (Helm stores release values in a cluster Secret); reference External Secrets or a CSI driver instead.

   **Check:** `helm lint ./chart -f values-prod.yaml` fails on a misspelled or wrongly typed value.

3. **Write templates that stay readable.**

   ```yaml
   metadata:
     name: {{ include "chart.fullname" . }}
     labels:
       {{- include "chart.labels" . | nindent 4 }}
   spec:
     template:
       metadata:
         annotations:
           checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
       spec:
         containers:
           - name: app
             image: "{{ .Values.image.repository }}{{ if .Values.image.digest }}@{{ .Values.image.digest }}{{ else }}:{{ .Values.image.tag | default .Chart.AppVersion }}{{ end }}"
             resources:
               {{- toYaml .Values.resources | nindent 14 }}
   ```

   Use `include` (pipeable) over `template`, `required "msg" .Values.x` for mandatory inputs, `quote` for strings that look like numbers or booleans, and the standard `app.kubernetes.io/*` labels.

   **Check:** `helm template rel ./chart -f values-prod.yaml --debug` renders without errors and the output is valid YAML.

4. **Validate rendered output against Kubernetes schemas.**

   ```bash
   helm template rel ./chart -f values-prod.yaml | kubeconform -strict -summary   # reads stdin
   helm unittest ./chart        # helm-unittest plugin, tests in chart/tests/*_test.yaml
   ct lint --charts ./chart     # chart-testing, also checks version bumps
   ```

   Installing plugins downloads code: confirm with the user (`helm plugin install https://github.com/helm-unittest/helm-unittest`).

   **Check:** CI runs lint, render, schema validation and unit tests on every chart change.

5. **Diff before every upgrade.**

   ```bash
   helm diff upgrade api ./chart -n api -f values-prod.yaml          # helm-diff plugin
   helm upgrade --install api ./chart -n api -f values-prod.yaml --dry-run=server
   ```

   **Check:** The user has seen the diff for production releases and approved it.

6. **Upgrade with a wait and know how to roll back.**

   ```bash
   helm upgrade --install api ./chart -n api --create-namespace -f values-prod.yaml --wait --timeout 10m
   helm history api -n api
   helm rollback api 7 -n api --wait
   helm get values api -n api        # what is actually deployed
   helm get manifest api -n api
   ```

   Helm 3 offers `--atomic` to roll back automatically on failure; Helm 4 renamed related flags, so check `--help`. `helm uninstall` deletes the release's resources (and PVCs created by the chart): confirm first.

   **Check:** `helm status api -n api` reports `deployed` and the pods are Ready.

7. **Publish to an OCI registry.**

   ```bash
   helm package ./chart                     # chart-1.4.0.tgz
   gcloud auth print-access-token | helm registry login -u oauth2accesstoken --password-stdin https://REGION-docker.pkg.dev
   helm push chart-1.4.0.tgz oci://REGION-docker.pkg.dev/PROJECT_ID/charts
   helm install api oci://REGION-docker.pkg.dev/PROJECT_ID/charts/chart --version 1.4.0 -n api
   ```

   Bump `version` on every chart change (published versions are immutable by convention); `appVersion` tracks the application. Commit `Chart.lock` after `helm dependency update`.

   **Check:** `helm show chart oci://REGION-docker.pkg.dev/PROJECT_ID/charts/chart --version 1.4.0` returns the new metadata.

## Reference

### Failure modes

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| `UPGRADE FAILED: another operation is in progress` | Previous release stuck `pending-upgrade` | `helm history`, then `helm rollback` to the last `deployed` revision |
| `field is immutable` on Deployment selector | Labels in `selector.matchLabels` changed | Never change selectors; if you must, recreate with user approval |
| CRD changes not applied | Helm installs `crds/` once and never upgrades them | Manage CRDs separately (kubectl or a dedicated chart) |
| Config change does not restart pods | No checksum annotation | Add `checksum/config` as in step 3 |
| `lookup` returns nothing | `helm template` and client dry-run have no cluster access | Guard with defaults; test with `--dry-run=server` |
| Values ignored | Wrong key path or YAML indentation | Add the key to the schema; `helm get values` to inspect |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Put secrets in `values.yaml` | External Secrets or CSI driver | Values are stored readable in a release Secret |
| `image.tag: latest` | Tag plus digest pinned per release | Rollback must restore the exact image |
| One huge values file per env copied from defaults | Small override files on top of defaults | Drift between environments becomes invisible |
| Logic-heavy templates with nested `if` and `range` | Simple templates, helpers, or split charts | Unreadable charts break silently |
| Upgrade production without a diff | `helm diff` or `--dry-run=server` first | Surprise deletions and selector changes |
| Reuse a chart version for different contents | Bump `version` every change | Consumers cache by version |

## Verification checklist

- [ ] `values.schema.json` exists and lint fails on bad values.
- [ ] Rendered manifests pass `kubeconform`; unit tests run in CI.
- [ ] No secrets in values; images pinned by tag and digest.
- [ ] Production upgrades were diffed and confirmed; rollback revision is known.
- [ ] Chart version bumped and published to the OCI registry.

## Related

- Knowledge: `kubernetes-gke`, `gitops-argocd`, `docker-containers`, `secrets-management`, `terraform-iac`, `container-security`.
- Agents: `cloud-devops-engineer`, `sre-engineer`.
