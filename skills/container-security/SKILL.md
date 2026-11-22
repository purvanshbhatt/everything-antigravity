---
name: container-security
description: >-
  Hardens containers from Dockerfile to cluster: minimal and distroless base
  images, non-root users, build secrets, image scanning and signing, Pod
  Security Standards, securityContext, NetworkPolicies, admission control and
  runtime detection on GKE and Kubernetes. Use when writing or reviewing a
  Dockerfile or manifest, triaging image CVEs, or preparing a cluster for a
  security review.
---

# Container Security

Ship small images that run as non-root with nothing they do not need, prove
where they came from, and let the cluster refuse anything else. Scanning is
the last line, not the first.

## When to use

- Writing or reviewing a `Dockerfile`, Helm chart or Kubernetes manifest.
- An image scan reports dozens of CVEs and you need to cut them down.
- Enforcing Pod Security Standards, admission policies or runtime detection.
- Preparing GKE or Cloud Run workloads for a security review or audit.

## When not to use

- Writing a first Dockerfile and compose setup: use `/dockerize` or `docker-containers`.
- Cluster operations unrelated to security: use `kubernetes-gke` or `helm-charts`.
- Provenance, SBOM and signing policy across all artifacts: use `supply-chain-security`.
- Cloud-wide misconfiguration (IAM, buckets, org policies): use `cloud-security-posture`.

## Workflow

1. **Lint the Dockerfile.** Run `hadolint Dockerfile`. Look for `latest` tags, `ADD` of URLs, `curl | sh`, package caches left behind, secrets in `ARG`/`ENV`, and missing `USER`.

   **Check:** hadolint passes or each ignored rule has a comment explaining why.

2. **Shrink the image.** Use a multi-stage build; copy only the binary or app into a minimal runtime (distroless, a minimal vendor base, or `scratch` for static binaries). Pin the base by digest.

   ```dockerfile
   # syntax=docker/dockerfile:1
   FROM golang:1.23@sha256:<digest> AS build
   WORKDIR /src
   COPY go.mod go.sum ./
   RUN go mod download
   COPY . .
   RUN CGO_ENABLED=0 go build -trimpath -o /out/app ./cmd/app

   FROM gcr.io/distroless/static-debian12:nonroot
   COPY --from=build /out/app /app
   USER nonroot:nonroot
   ENTRYPOINT ["/app"]
   ```

   **Check:** `docker image ls` shows the runtime image is a fraction of the build image; no shell or package manager unless justified.

3. **Keep secrets out of layers.** Use BuildKit secret mounts, never `COPY .npmrc` or `ARG TOKEN`.

   ```dockerfile
   RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci --omit=dev
   ```

   Build with `docker build --secret id=npmrc,src=<path-to-npmrc> .`. Add `.git`, `.env*` and credentials to `.dockerignore`.

   **Check:** `docker history --no-trunc <image>` shows no secret values.

4. **Scan and triage.**

   ```bash
   trivy image --severity HIGH,CRITICAL --exit-code 1 <image>
   grype <image>
   docker scout cves <image>
   trivy config ./k8s            # manifest misconfigurations
   ```

   On Google Cloud, enable Artifact Analysis scanning in Artifact Registry. Fix by rebuilding on a patched base first; then upgrade app dependencies; then record accepted risks (unreachable code, no fix available) with an expiry.

   **Check:** No fixable Critical or High remains without a recorded exception.

5. **Harden the pod spec.** Apply the securityContext below to every container, set resource requests and limits, disable service-account token automount when unused, and use Workload Identity instead of key files.

   **Check:** The namespace enforces the `restricted` Pod Security Standard without warnings.

6. **Restrict the network.** Start from default-deny ingress and egress per namespace, then allow specific flows (including DNS).

   **Check:** A test pod in the namespace cannot reach the metadata server or unrelated services.

7. **Admit only trusted images.** Require signatures or attestations at deploy time (Binary Authorization on GKE/Cloud Run, or Kyverno / Sigstore policy-controller). Ask the user before switching any policy from audit to enforce, since it can block deployments.

   **Check:** An unsigned test image is rejected in a non-production namespace.

8. **Detect at runtime.** Enable GKE security posture features, consider GKE Sandbox (gVisor) for untrusted workloads, and run Falco or Tetragon for syscall-level alerts routed to on-call.

## Reference

### Pod securityContext baseline

```yaml
spec:
  automountServiceAccountToken: false
  securityContext:
    runAsNonRoot: true
    seccompProfile: { type: RuntimeDefault }
  containers:
    - name: app
      image: <registry>/<image>@sha256:<digest>
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities: { drop: ["ALL"] }
      resources:
        requests: { cpu: 100m, memory: 128Mi }
        limits: { memory: 256Mi }
      volumeMounts: [{ name: tmp, mountPath: /tmp }]
  volumes: [{ name: tmp, emptyDir: {} }]
```

### Pod Security Standards

| Level | Use for | Enforce with namespace label |
| :--- | :--- | :--- |
| privileged | System components only | `pod-security.kubernetes.io/enforce: privileged` |
| baseline | Legacy workloads mid-migration | `pod-security.kubernetes.io/enforce: baseline` |
| restricted | All application workloads | `pod-security.kubernetes.io/enforce: restricted` |

Roll out with the `warn` and `audit` labels first, then `enforce`.

### Default-deny NetworkPolicy

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: default-deny, namespace: app }
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Run as root "because it works" | `USER` non-root plus `runAsNonRoot: true` | Root in a container is one bug away from root on the node |
| Full OS base for a static binary | Distroless or `scratch` | Every package is CVE noise and attacker tooling |
| `privileged: true` or `hostPath` for convenience | Specific capabilities or CSI volumes | These are container escapes by design |
| Mount service-account key JSON | Workload Identity | Key files leak and never expire |
| Chase every CVE in a fat image | Rebuild on a minimal patched base | Most CVEs disappear with the packages |
| Enforce admission policies on day one | Audit mode, fix violations, then enforce | Sudden enforcement blocks production deploys |

## Verification checklist

- [ ] Dockerfile is multi-stage, digest-pinned, non-root, and hadolint-clean.
- [ ] No secrets in layers or image history; `.dockerignore` excludes credentials.
- [ ] No fixable Critical/High CVEs without a dated exception.
- [ ] Pods pass the `restricted` Pod Security Standard; resources are set.
- [ ] Default-deny NetworkPolicies exist with explicit allows.
- [ ] Unsigned images are rejected at admission (after the user approved enforcement).

## Related

- Knowledge: `docker-containers`, `kubernetes-gke`, `helm-charts`, `supply-chain-security`, `cloud-security-posture`, `secrets-management`.
- Workflows: `/dockerize`, `/security-scan`.
- Agents: `security-guard`, `cloud-devops-engineer`.
