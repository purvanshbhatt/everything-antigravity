# Build Recipes

Companion to the `docker-containers` skill. Every `<digest>` and `<version>`
placeholder must be resolved before use: check the image's registry page for the
current supported tag, then pin it with
`docker buildx imagetools inspect <image:tag>`.

## `.dockerignore` starter

```text
.git
.gitignore
**/node_modules
**/.venv
**/__pycache__
dist
build
coverage
target
*.log
.env
.env.*
*.pem
*.key
.idea
.vscode
Dockerfile*
compose*.y*ml
```

Re-include anything the build genuinely needs with `!path` lines after the
exclusions.

## Python service with uv

```dockerfile
# syntax=docker/dockerfile:1
ARG PY_IMAGE=python:<version>-slim@sha256:<digest>

FROM ${PY_IMAGE} AS build
# Pin uv to a released version, not :latest (see github.com/astral-sh/uv releases)
COPY --from=ghcr.io/astral-sh/uv:<version> /uv /uvx /bin/
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
WORKDIR /app
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-project --no-dev
COPY . .
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev

FROM ${PY_IMAGE} AS runtime
RUN groupadd --system --gid 10001 app \
 && useradd --system --uid 10001 --gid app --no-create-home app
WORKDIR /app
COPY --from=build /app /app
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
USER 10001:10001
EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

Notes:

- The build and runtime stages use the same base so the virtualenv's interpreter
  path stays valid. Moving a venv onto `distroless/python3` only works when the
  Python minor version and path match exactly; verify before switching.
- pip equivalent for the dependency layer:
  `RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt`
  with hashes (`pip install --require-hashes`) when the lockfile has them.
- Files are owned by root and are read-only to UID 10001. Create and `chown`
  only the directories the app writes to.

## Go service on `distroless/static` (cross-compiled multi-arch)

```dockerfile
# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM golang:<version>-bookworm@sha256:<digest> AS build
ARG TARGETOS TARGETARCH
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot@sha256:<digest>
COPY --from=build /out/server /server
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/server"]
```

`--platform=$BUILDPLATFORM` runs the compiler natively and lets Go cross-compile,
which is far faster than building the whole stage under QEMU emulation.

## Healthchecks without a shell

Distroless images have no `curl` or `sh`. Use a check the runtime can execute:

```dockerfile
# Node: a tiny script that exits 0 when GET /healthz returns 200
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["/nodejs/bin/node", "dist/healthcheck.js"]

# Go: build the same binary with a `-healthcheck` flag, or ship a small static checker
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["/server", "-healthcheck"]
```

`HEALTHCHECK` only affects Docker and Compose. Kubernetes uses probes (see
`kubernetes-gke`) and Cloud Run uses its own startup and liveness probes.

## Compose for local development

```yaml
# compose.yaml
services:
  api:
    build:
      context: .
      target: build          # dev stage with dev dependencies
    command: ["npm", "run", "dev"]
    ports: ["8080:8080"]
    env_file: [.env.local]   # gitignored
    depends_on:
      db:
        condition: service_healthy
    develop:
      watch:
        - action: sync
          path: ./src
          target: /app/src
        - action: rebuild
          path: package-lock.json
  db:
    image: postgres:17       # pin a digest for shared environments
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 10
volumes:
  pgdata:
```

| Task | Command |
| :--- | :--- |
| Start and rebuild changed images | `docker compose up --build` |
| Live sync and rebuild on lockfile change | `docker compose watch` |
| Tail one service | `docker compose logs -f api` |
| Stop, keep data | `docker compose down` |
| Stop and delete volumes (destructive: confirm first) | `docker compose down -v` |
| Optional services | `profiles: [debug]` on the service, then `docker compose --profile debug up` |

## Multi-arch build and push to Artifact Registry

```bash
gcloud auth configure-docker us-docker.pkg.dev
docker buildx create --name multi --driver docker-container --use
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t us-docker.pkg.dev/PROJECT/REPO/app:1.4.2 \
  --cache-from type=registry,ref=us-docker.pkg.dev/PROJECT/REPO/app:buildcache \
  --cache-to type=registry,ref=us-docker.pkg.dev/PROJECT/REPO/app:buildcache,mode=max \
  --sbom=true --provenance=mode=max \
  --push .
docker buildx imagetools inspect us-docker.pkg.dev/PROJECT/REPO/app:1.4.2
```

PowerShell: replace the trailing `\` line continuations with a backtick, or put
the command on one line. Some registries need `image-manifest=true,oci-mediatypes=true`
added to `--cache-to`; check your registry's BuildKit cache support. Pushing to a
shared registry requires user confirmation.

## Debugging a distroless image

- Distroless publishes `:debug` variants with a busybox shell, for example
  `gcr.io/distroless/static-debian12:debug`. Build a throwaway debug image from
  the same stages with that base; never ship it.
- Inspect without running: `docker create --name x IMAGE && docker export x | tar -t | less`
  (PowerShell: `docker export x -o x.tar; tar -tf x.tar`), then `docker rm x`.
- In Kubernetes, attach an ephemeral container instead of adding a shell:
  `kubectl debug -it POD --image=busybox:1.36 --target=app`.

## Scanner suppression file

```text
# .trivyignore: one ID per line, each with owner, reason and review date
# CVE-2024-XXXXX  owner=platform  reason=not reachable: no TLS in this binary  review=2027-01-31
CVE-2024-XXXXX
```

Re-run the scan after every base-image bump and delete suppressions whose CVEs
are fixed.
