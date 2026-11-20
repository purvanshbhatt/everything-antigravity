# Container and VM recipes for agent isolation

## Devcontainer for agent work

```jsonc
// .devcontainer/devcontainer.json
{
  "name": "agent-workspace",
  "image": "mcr.microsoft.com/devcontainers/typescript-node:22",
  "remoteUser": "node",
  "runArgs": [
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--pids-limit=512",
    "--memory=4g"
  ],
  "mounts": [
    "source=agent-npm-cache,target=/home/node/.npm,type=volume"
  ],
  "postCreateCommand": "npm ci"
}
```

Run it with the Dev Containers CLI (`npm i -g @devcontainers/cli`):

```bash
devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . npm test
```

Notes:

- `--cap-drop=ALL` can break images that switch users or bind low ports at start; add back only the capability that fails (for example `--cap-add=CHOWN`), never `--privileged`.
- Use named volumes for caches instead of bind-mounting host cache directories.
- Do not forward the host SSH agent or mount credential directories; push from the host after review.

## One-shot hardened run for untrusted code

```bash
docker run --rm \
  --network=none \
  --read-only --tmpfs /tmp:rw,nosuid,size=256m \
  --cap-drop=ALL --security-opt=no-new-privileges \
  --pids-limit=256 --memory=2g --cpus=2 \
  --user 1000:1000 \
  -v "$(pwd):/src:ro" \
  -v agent-out:/out \
  -w /src \
  python:3.12-slim python -I run_untrusted.py --output /out/result.json
```

```powershell
docker run --rm `
  --network=none `
  --read-only --tmpfs /tmp:rw,nosuid,size=256m `
  --cap-drop=ALL --security-opt=no-new-privileges `
  --pids-limit=256 --memory=2g --cpus=2 `
  --user 1000:1000 `
  -v "${PWD}:/src:ro" `
  -v agent-out:/out `
  -w /src `
  python:3.12-slim python -I run_untrusted.py --output /out/result.json
```

- Pin images by digest for repeatability (`image@sha256:...`).
- Install dependencies in a separate step with network enabled but no secrets present, then run the code with `--network=none`.
- Copy results out of the named volume and inspect them before using them on the host.

## gVisor

Install `runsc` (see gvisor.dev for the current install method), register it with Docker, and restart the daemon:

```json
// /etc/docker/daemon.json
{ "runtimes": { "runsc": { "path": "/usr/local/bin/runsc" } } }
```

```bash
docker run --rm --runtime=runsc --network=none IMAGE COMMAND
```

On GKE, create a node pool with GKE Sandbox enabled (`--sandbox type=gvisor` on `gcloud container node-pools create`) and set `runtimeClassName: gvisor` in the pod spec. Details: `kubernetes-gke`.

## Egress allowlist with a forward proxy

1. Run the agent container on an internal Docker network with no default route (`docker network create --internal agent-net`).
2. Attach a proxy container (for example Squid or Envoy) to both `agent-net` and an external network, configured to allow only the needed domains (package registry, model API, source host).
3. Set `HTTPS_PROXY` / `HTTP_PROXY` in the agent container to the proxy address.
4. Log denied requests; they reveal both misconfiguration and exfiltration attempts.

Kubernetes equivalent: a default-deny egress `NetworkPolicy` for the agent namespace, plus allow rules to the proxy or to specific CIDRs, and DNS.

## Windows options

- Antigravity terminal sandbox on supported Windows 11 builds (AppContainer).
- Windows Sandbox (Pro and Enterprise editions) for a disposable VM:

  ```xml
  <!-- agent.wsb -->
  <Configuration>
    <Networking>Disable</Networking>
    <MappedFolders>
      <MappedFolder>
        <HostFolder>C:\work\untrusted-repo</HostFolder>
        <ReadOnly>true</ReadOnly>
      </MappedFolder>
    </MappedFolders>
  </Configuration>
  ```

- WSL 2 plus Docker or Podman with the same hardened flags as above. WSL mounts Windows drives under `/mnt/c` by default; run untrusted code in a container, not directly in the WSL distribution.

## Cloud credentials for agents

| Practice | How |
| :--- | :--- |
| Separate project | `agent-sandbox-*` project with its own budget and no peering to production VPCs |
| Dedicated identity | `agent-runner` service account with task-specific roles only |
| No keys | Impersonation (`auth/impersonate_service_account`) or Workload Identity Federation in CI |
| Separate config | `CLOUDSDK_CONFIG` pointing at an agent-only gcloud directory; never mount `~/.config/gcloud` |
| Guardrails | Organisation policy denying SA key creation; VPC Service Controls around sensitive data |
| Audit | Cloud Audit Logs filtered on the agent service account, reviewed after autonomous runs |

## Smoke test after setup

Run inside the sandboxed environment; every line should fail:

```bash
cat ~/.ssh/id_ed25519
curl -sS --max-time 5 https://example.com
curl -sS --max-time 5 -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/
touch /usr/local/bin/pwned
```

And these should succeed: running the project's tests, writing inside the workspace (or `/out`), reaching the allowlisted registry through the proxy.
