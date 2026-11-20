---
trigger: glob
globs: "**/Dockerfile, **/Dockerfile.*, **/*.dockerfile, **/docker-compose*.yml, **/compose*.yaml"
description: Dockerfile and Docker Compose conventions
---

# Containers

## Base images

- Pin base images to a specific version tag, and to a digest for production builds (`python:3.12-slim@sha256:...`). Never use `latest`.
- Prefer minimal runtime images (distroless, `-slim`, or Alpine when musl compatibility is verified).
- Rebuild regularly to pick up security patches; scan with `trivy image` or `docker scout cves` when available.

## Build

- Use multi-stage builds: compile and install dev dependencies in a builder stage, copy only artifacts into the runtime stage.
- Order for cache reuse: copy lockfiles, install dependencies, then copy source.

  ```dockerfile
  COPY package.json package-lock.json ./
  RUN npm ci --omit=dev
  COPY . .
  ```

- Keep a `.dockerignore` that excludes `.git`, `node_modules`, `.venv`, build output, `.env*` and local secrets.
- Combine package install and cleanup in one layer: `apt-get update && apt-get install -y --no-install-recommends <pkgs> && rm -rf /var/lib/apt/lists/*`. Pin package versions where reproducibility matters.
- `COPY`, not `ADD`, unless you need tar auto-extraction. Use an absolute `WORKDIR`.
- Lint with `hadolint` when available.

## Secrets

- Never put secrets in `ENV`, `ARG`, `COPY`ed files or any layer; image history exposes them. Use BuildKit secret mounts (`RUN --mount=type=secret,id=npmrc ...`) at build time and runtime injection (env from a secret store, mounted files) at run time.

## Runtime

- Run as a non-root user with a numeric UID (`USER 10001`); do not install `sudo`.
- Use exec-form `ENTRYPOINT`/`CMD` (`["node", "server.js"]`) so the process receives signals. Handle `SIGTERM` for graceful shutdown; add an init (`tini` or `docker run --init`) if the process does not reap children.
- One main process per container. Log to stdout/stderr, not files inside the container.
- Add a `HEALTHCHECK` for Docker and Compose use; Kubernetes ignores it and uses probes instead.
- Make the root filesystem read-only where feasible and write only to declared volumes or `/tmp`.
- Add OCI labels (`org.opencontainers.image.source`, `.version`).

## Compose

- Omit the obsolete top-level `version:` key.
- Use `depends_on` with `condition: service_healthy` plus a `healthcheck`, instead of sleeps.
- Load configuration from `env_file` or environment variables; commit only `.env.example`, never `.env` with real values.
- Bind development database and admin ports to localhost (`"127.0.0.1:5432:5432"`), not all interfaces.
- Use named volumes for persistent data; set `restart` policies and resource limits for long-running services.
- `docker compose down -v` deletes volumes and their data: run it only with explicit user confirmation.
