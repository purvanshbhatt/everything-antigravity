---
name: docker-containers
disable-model-invocation: true
description: >-
  Builds small, secure, reproducible container images: multi-stage Dockerfiles,
  distroless or slim bases pinned by digest, non-root users, cache-friendly layer
  order, BuildKit secrets, healthchecks, image scanning, multi-arch buildx and
  Compose for local dev. Use when containerizing a service, writing or reviewing
  a Dockerfile, or when an image is huge, slow to build or flagged by a scanner.
---

# Docker Containers

Produce images that rebuild in seconds, run as non-root, carry no secrets and
pass a vulnerability scan. Treat the Dockerfile as production code: every layer
is a decision about cache hits, size and attack surface.

## When to use

- Containerizing a service, or writing `Dockerfile`, `.dockerignore` or `compose.yaml`.
- An image is hundreds of MB larger than its runtime needs, or the dependency layer never hits cache.
- Trivy, Grype, Docker Scout or Artifact Analysis reports HIGH/CRITICAL CVEs.
- Reviewing a Dockerfile in a PR, or building for both `amd64` and `arm64`.

## When not to use

- Probes, autoscaling, rollouts or pod debugging: use `kubernetes-gke`.
- The pipeline that builds, scans and pushes the image: use `ci-cd-github-actions`.
- Isolating untrusted agent tool execution in containers: use `sandbox-isolation`.
- Choosing Cloud Run vs GKE, or provisioning registries: use `cloud-devops` or `terraform-iac`.

## Workflow

1. **Inventory build-time vs runtime needs.** Use `find_by_name` for `Dockerfile*`, `compose*.y*ml` and `.dockerignore`, then `view_file` the lockfile, build script and entrypoint. Note ports, writable paths, native libraries and whether the app handles `SIGTERM`.

   **Check:** You can list the build-only tools (compilers, dev dependencies) and the exact runtime artifact set (binary or `dist/` plus production dependencies).

2. **Write `.dockerignore` before the Dockerfile.** Exclude `.git`, `node_modules`, `.venv`, `dist`, `build`, `coverage`, `.env*`, `*.pem`, `*.key`, logs and IDE folders. This keeps secrets out of the build context and stops unrelated edits from busting the cache.

   **Check:** The build log line `transferring context:` is a few MB at most, and no `.env` file is in the context.

3. **Split into stages and order layers by change frequency.** Base image, then OS packages, then lockfile copy and dependency install, then source copy, then build. Use BuildKit cache mounts for package managers (see the cache table below).

   **Check:** Edit one source file and rebuild with `docker build --progress=plain .`: the dependency install step reports `CACHED`.

4. **Choose and pin the runtime base.** Pick from the base-image table, then pin every `FROM` by digest and keep the tag for humans and update bots:

   ```bash
   docker buildx imagetools inspect node:22-bookworm-slim   # copy the top-level "Digest:"
   ```

   **Check:** Every `FROM` line contains `@sha256:`, and the runtime stage has no compiler, package manager or shell unless the app needs one.

5. **Harden the runtime stage.** Numeric non-root `USER`, application files owned by root and only the writable directories owned by the app user, exec-form `CMD`/`ENTRYPOINT`, and a `SIGTERM` handler in the app (or `tini` / `docker run --init`). Add `HEALTHCHECK` for Docker and Compose; Kubernetes ignores it and uses probes instead.

   **Check:** `docker inspect --format '{{.Config.User}}' IMAGE` is non-empty and not `root`/`0`, and `docker stop CONTAINER` returns in about a second, not after the 10-second kill timeout.

6. **Pass build secrets only through BuildKit mounts.** `ARG` and `ENV` values persist in image metadata and history. Mount the secret for one `RUN` instead:

   ```bash
   docker build --secret id=npmrc,src=$HOME/.npmrc -t app:dev .
   # PowerShell: docker build --secret "id=npmrc,src=$env:USERPROFILE\.npmrc" -t app:dev .
   ```

   Runtime secrets are injected at deploy time (Secret Manager, Kubernetes Secrets, Cloud Run secrets), never baked in.

   **Check:** `docker history --no-trunc IMAGE > history.txt`, then `eag shield --file history.txt` (fallback `node <plugin-root>/bin/eag.js shield --file history.txt`) reports no secrets.

7. **Lint, scan and gate.** Run `docker build --check .` (BuildKit build checks) and `hadolint Dockerfile`, then one scanner from the scanning table. Fix by bumping the base digest first, then dependencies. Record each accepted risk in `.trivyignore` (or the scanner's equivalent) with a reason and a review date.

   **Check:** The scanner exits 0 at the agreed threshold, or every suppression has a written justification.

8. **Measure size and build time.** `docker image ls IMAGE`, `docker history IMAGE`, and `dive IMAGE` (non-interactive in CI: `CI=true dive IMAGE`). Look for package caches, test fixtures, dev dependencies and files added in one layer and deleted in a later one.

   **Check:** Before/after image size and warm rebuild time are recorded in the walkthrough artifact.

9. **Build multi-arch only when a consumer needs it.** Cross-compile with `FROM --platform=$BUILDPLATFORM` and `TARGETOS`/`TARGETARCH` instead of emulating the whole build under QEMU. Recipes are in [build recipes](references/build-recipes.md).

   **Check:** `docker buildx imagetools inspect REGISTRY/IMAGE:TAG` lists every required platform.

Pushing to a shared registry, overwriting an existing tag or deleting images requires explicit user confirmation.

## Patterns

### Reference Dockerfile (Node.js service)

```dockerfile
# syntax=docker/dockerfile:1
# Resolve digests with: docker buildx imagetools inspect <image:tag>
ARG NODE_IMAGE=node:22-bookworm-slim@sha256:<digest>

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci --omit=dev

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci
COPY . .
RUN npm run build

# distroless nodejs: ENTRYPOINT is node, no shell, :nonroot runs as UID 65532
FROM gcr.io/distroless/nodejs22-debian12:nonroot@sha256:<digest> AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER 65532:65532
EXPOSE 8080
CMD ["dist/server.js"]
```

Python (uv/pip) and Go (static binary on `distroless/static`) equivalents, Compose and buildx recipes are in [build recipes](references/build-recipes.md). Check the distroless repository for current image names and Debian versions before pinning.

### Base image choice

| Base | Shell / package manager | Use when |
| :--- | :--- | :--- |
| `scratch` | none | Fully static binary; you must add CA certificates, tzdata and a passwd entry yourself |
| `gcr.io/distroless/static-*` | none | Static Go or Rust binaries (`CGO_ENABLED=0`); includes CA certs and a `nonroot` user |
| `gcr.io/distroless/{base,cc,nodejs*,python3}-*` | none | Dynamic runtimes that need glibc but no shell |
| Debian `*-slim` | `apt` | Runtime needs OS packages, or you need a shell to debug |
| `alpine` | `apk` | You have verified musl compatibility (native wheels, DNS behaviour, performance) |
| Chainguard / Wolfi | `apk` in `-dev` variants | Low-CVE images; check the free-tier tag availability first |

### Cache mounts by ecosystem

| Ecosystem | Mount target |
| :--- | :--- |
| npm / pnpm | `/root/.npm` / `/root/.local/share/pnpm/store` |
| pip / uv | `/root/.cache/pip` / `/root/.cache/uv` |
| Go | `/go/pkg/mod` and `/root/.cache/go-build` |
| Cargo | `/usr/local/cargo/registry` and `/app/target` (copy the binary out in the same `RUN`) |
| apt | `/var/cache/apt` and `/var/lib/apt` with `sharing=locked` |

### Scanning and inspection

| Tool | Command |
| :--- | :--- |
| Trivy | `trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 IMAGE` |
| Grype | `grype IMAGE --fail-on high` |
| Docker Scout | `docker scout cves IMAGE --only-severity critical,high --exit-code` |
| Dockerfile lint | `hadolint Dockerfile` and `docker build --check .` |
| Layer analysis | `dive IMAGE`, `docker history --no-trunc IMAGE` |
| SBOM and provenance | `docker buildx build --sbom=true --provenance=mode=max ...` |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `FROM node:latest` | Pin tag plus `@sha256:` digest | Base images change under you; builds stop being reproducible |
| `ARG NPM_TOKEN` or `ENV API_KEY=...` | `RUN --mount=type=secret,...` | Build args and env persist in history and image config |
| `COPY . .` before installing dependencies | Copy lockfiles, install, then copy source | Every source edit re-runs the full install |
| Run as root | Numeric non-root `USER` | Larger blast radius on escape; `runAsNonRoot` pods refuse to start |
| `CMD npm start` (shell form) | `CMD ["node", "dist/server.js"]` | `sh -c` and npm don't forward `SIGTERM`; shutdown waits for SIGKILL |
| `RUN apt-get upgrade` | Bump the base image digest | Unreproducible; the base maintainers ship the patches |
| `rm` files in a later layer | Remove them in the same `RUN`, or use a stage | Deleted bytes stay in the earlier layer |
| `ADD https://...` unverified | `ADD --checksum=sha256:<hash> https://...` | Detects tampered or changed downloads |
| Rely on `HEALTHCHECK` in Kubernetes | Readiness, liveness and startup probes | The kubelet ignores Docker healthchecks |

## Verification checklist

- [ ] `.dockerignore` excludes VCS data, dependencies, build output and every `.env*`/key file.
- [ ] Multi-stage build; the runtime stage contains only runtime artifacts.
- [ ] Every `FROM` pinned by digest; an update bot (Dependabot or Renovate) is configured to bump them.
- [ ] Runs as a numeric non-root user with exec-form `CMD` and graceful `SIGTERM` handling.
- [ ] No secrets in `docker history --no-trunc` or `docker inspect` output.
- [ ] Lint and scanner pass at the agreed severity, with justified suppressions only.
- [ ] Image size and warm rebuild time recorded; dependency layer is cached on source-only edits.

## Related

- Agents: `cloud-devops-engineer` (registry, Cloud Run and GKE rollout), `security-guard` (image and supply-chain review), `performance-optimizer` (startup and size tuning).
- Workflows: `/build-fix` (broken builds), `/security-scan`, `/verify`.
- Knowledge: `kubernetes-gke`, `ci-cd-github-actions`, `cloud-devops`, `sandbox-isolation`, `credential-sanitizer`.
