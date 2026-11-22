---
name: dockerize
description: >-
  Containerizes an application end to end: records its runtime contract,
  writes a multi-stage Dockerfile with a pinned slim or distroless base,
  non-root user and cache-friendly layers, adds .dockerignore, a healthcheck
  and a Compose file for local dependencies, then builds, scans, runs and
  smoke-tests the container. Use when the user asks to dockerize or
  containerize a project or add Docker or Compose. Invoke with /dockerize.
---

# Dockerize

Turn a working app into a small, secure, reproducible image that starts the
same way everywhere, and prove it by building, scanning and running it
locally. Writing the Dockerfile is step four; understanding how the app runs
comes first.

Usage: `/dockerize [service path]`.

## When to use

- "Dockerize this", "add a Dockerfile", "set up docker compose for local dev".
- Preparing a service for Cloud Run, GKE or any container platform.
- Replacing a hand-rolled Dockerfile that is huge, slow, runs as root or fails scans.

## When not to use

- Deep Dockerfile tuning, multi-arch builds and image-size work on an existing image: `docker-containers`.
- Kubernetes manifests and Helm: `kubernetes-gke`, `helm-charts`. Deploying to Cloud Run: `cloud-run`.
- Reproducible developer machines rather than deployable images: `dev-environments`.

## Workflow

1. **Record the runtime contract.** From the manifest, lockfile, scripts and config: language and version, package manager, build command, start command, port, required environment variables, writable paths, external services (database, cache, queue) and shutdown behaviour (does it handle `SIGTERM`?). If a Dockerfile already exists, improve it; never overwrite it without asking.

   **Check:** A table lists every item above with its source file.

2. **Choose and pin the base.** Use the official image for the runtime's current supported version (verify tags on the registry). Pin the tag in development and the digest for production; get it with `docker buildx imagetools inspect <image>:<tag>`.

   | Stack | Build stage | Runtime stage |
   | :--- | :--- | :--- |
   | Node.js | `node:<lts>-slim` | `node:<lts>-slim` or a distroless Node.js image |
   | Python | `python:<ver>-slim` | `python:<ver>-slim` with a virtualenv copied in |
   | Go | `golang:<ver>` with `CGO_ENABLED=0` | `gcr.io/distroless/static-debian12` or `scratch` |
   | Java | `eclipse-temurin:<ver>-jdk` | `eclipse-temurin:<ver>-jre` |
   | Rust | `rust:<ver>` | `gcr.io/distroless/cc-debian12` or a Debian slim image |

   **Check:** Every `FROM` line has an explicit version tag, never `latest`.

3. **Write `.dockerignore` first.** Keep secrets and bulk out of the build context.

   ```text
   .git
   node_modules
   dist
   .venv
   __pycache__
   *.log
   .env*
   !.env.example
   coverage
   Dockerfile*
   docker-compose*.yml
   ```

   **Check:** The build context printed by BuildKit is small (a few MB for most services).

4. **Write the Dockerfile.** Multi-stage; dependency manifests copied before source so the dependency layer caches; BuildKit cache mounts; secrets via `--mount=type=secret`, never `ARG` or `ENV`; non-root user; exec-form `CMD` so signals reach the process. Node.js example:

   ```dockerfile
   # syntax=docker/dockerfile:1
   # Set to the current Node.js LTS major and keep it pinned.
   ARG NODE_VERSION=22
   FROM node:${NODE_VERSION}-slim AS build
   WORKDIR /app
   COPY package.json package-lock.json ./
   RUN --mount=type=cache,target=/root/.npm npm ci
   COPY . .
   RUN npm run build && npm prune --omit=dev

   FROM node:${NODE_VERSION}-slim AS runtime
   ENV NODE_ENV=production
   WORKDIR /app
   COPY --from=build --chown=node:node /app/package.json ./
   COPY --from=build --chown=node:node /app/node_modules ./node_modules
   COPY --from=build --chown=node:node /app/dist ./dist
   USER node
   EXPOSE 8080
   HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
     CMD ["node", "-e", "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
   CMD ["node", "dist/server.js"]
   ```

   Distroless and scratch images have no shell or `curl`: use a probe built into the app, or rely on the orchestrator's HTTP probes instead of `HEALTHCHECK`. Bind the server to `0.0.0.0`, not `localhost`.

   **Check:** No secret, `.env` file or token appears in any layer (`docker history --no-trunc <app>:dev`).

5. **Add Compose for local development.** App plus its dependencies, healthchecks, and readiness ordering.

   ```yaml
   services:
     app:
       build: .
       ports: ["8080:8080"]
       env_file: .env            # local only; never committed
       depends_on:
         db: { condition: service_healthy }
     db:
       image: postgres:17        # pin to the major you run in production
       environment:
         POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set it in .env}
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U postgres"]
         interval: 5s
         retries: 10
       volumes: [dbdata:/var/lib/postgresql/data]
   volumes:
     dbdata:
   ```

   **Check:** `docker compose config` prints the resolved file without errors.

6. **Build and inspect.**

   ```bash
   docker build -t <app>:dev .
   docker image ls <app>:dev                 # size
   docker history <app>:dev                  # layer sizes
   hadolint Dockerfile                       # if installed
   ```

   **Check:** A clean build (`docker build --no-cache -t <app>:dev .`) succeeds once.

7. **Scan the image.** Use whichever scanner is available: `docker scout cves <app>:dev`, `trivy image <app>:dev` or `grype <app>:dev`. Fix critical and high findings by updating the base image or dependencies before suppressing anything.

   **Check:** Critical findings are fixed or listed with a reason and an owner.

8. **Run and smoke-test.**

   ```bash
   docker run --rm -d --name app-smoke -p 8080:8080 --env-file .env <app>:dev
   curl -fsS http://localhost:8080/healthz          # PowerShell: curl.exe -fsS http://localhost:8080/healthz
   docker inspect --format "{{json .State.Health}}" app-smoke
   docker inspect --format "{{.Config.User}}" <app>:dev   # should not be empty or root
   docker stop app-smoke                            # should exit cleanly within the 10 s default
   ```

   **Check:** Health is `healthy`, the user is non-root, and `docker stop` exits without a forced kill.

9. **Hand off.** Add a short README section (build, run, compose up, env vars). Suggest a CI build and scan step. Pushing to a registry or deploying is outward-facing: ask the user before running `docker push` or any deploy.

   **Check:** README updated; nothing pushed without explicit approval.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `FROM node:latest` | Pin the version, then the digest | Builds change underneath you |
| `COPY . .` before installing dependencies | Copy manifests, install, then copy source | Every code edit reinstalls everything |
| Pass secrets with `ARG` or `ENV` | BuildKit secret mounts; runtime secrets from the platform | Build args and env persist in image metadata |
| Run as root | `USER` a non-root account | Limits damage from a compromised process |
| Shell-form `CMD npm start` | Exec form calling the runtime directly | PID 1 must receive `SIGTERM` for graceful shutdown |
| Commit `.env` for Compose | `.env.example` committed, `.env` ignored | Local secrets leak through the repo |

## Verification checklist

- [ ] Runtime contract recorded; existing Dockerfile not overwritten without consent.
- [ ] Pinned bases, multi-stage build, `.dockerignore`, non-root user, exec-form `CMD`.
- [ ] No secrets in layers or history.
- [ ] Image built clean, scanned, and critical findings handled.
- [ ] Container runs healthy, stops gracefully, Compose config valid.
- [ ] No push or deploy without explicit user approval.

## Related

- Knowledge: `docker-containers`, `container-security`, `cloud-run`, `kubernetes-gke`, `secrets-management`, `ci-cd-github-actions`, `dev-environments`.
- Workflows: `/verify`.
- Agents: `cloud-devops-engineer`, `security-guard`.
