---
name: sandbox-isolation
description: >-
  Sets up least-privilege execution for agents: the Antigravity terminal
  sandbox and agy --sandbox, permission rules, per-agent
  commandExecutionPolicy, devcontainers, Docker with dropped capabilities,
  read-only filesystem and no network, gVisor, egress allowlists, and
  separate cloud projects and credentials. Use when an agent will run
  untrusted code or read untrusted content, or when hardening a workstation
  or CI runner for autonomous agents.
---

# Sandbox Isolation

Assume the agent will eventually run a command you did not intend: a
hallucinated flag, a malicious postinstall script, or an instruction smuggled
in through a web page. Isolation decides how much that costs. Limit what the
agent's commands can read, write and reach, and give it credentials that are
worthless outside its task.

## When to use

- Running an agent autonomously (auto mode, long tasks, background subagents) on a workstation.
- Building, testing or executing third-party or generated code, installing unfamiliar packages.
- Agents that read untrusted content: web pages, issues, PR comments, emails, scraped documents.
- Giving an agent access to a cloud project, a database or deployment tooling.

## When not to use

- Understanding why the EAG hook blocked or asked about a command: use `agent-shield`.
- Cleaning up a credential that already leaked: use `credential-sanitizer`.
- Production container hardening for services you ship: use `docker-containers` and `kubernetes-gke`.
- IAM design for application workloads: use `cloud-devops`.

## Workflow

1. **Inventory what an unsandboxed command could reach.** Credentials (`~/.ssh`, `~/.config/gcloud`, `%APPDATA%\gcloud`, `~/.aws`, `~/.kube`, `~/.docker/config.json`, `~/.npmrc`, `.env` files, browser profiles), sockets (`/var/run/docker.sock` is root on the host), other repositories, and the network (internal services, cloud metadata).

   **Check:** You can list the three most damaging things a rogue command could do on this machine today.

2. **Turn on the Antigravity terminal sandbox.** It uses OS primitives (Linux namespaces, macOS `sandbox-exec`, Windows AppContainer on Windows 11 24H2 or later with recent updates): project folders read-write, system directories read-only, `~/.ssh` and `.env` blocked, no network except approved domains.
   - App: Settings > General > Global Permissions > Permission Preset: **Default** or **Auto** (both sandbox commands); per project under Settings > Projects.
   - CLI: `agy --sandbox` for one session, `agy --mode=auto`, or in `~/.gemini/antigravity-cli/settings.json`:

     ```json
     { "enableTerminalSandbox": true, "toolPermission": "proceed-in-sandbox" }
     ```

   If the OS cannot provide the sandbox (older Windows builds, hosts or containers that block unprivileged user namespaces), these settings silently have no effect: fall back to a container (step 5).

   **Check:** Inside an agent session, `cat ~/.ssh/known_hosts` (or `Get-Content ~\.ssh\known_hosts`) fails and `curl -sI https://example.com` fails unless that domain is allowed.

3. **Write explicit permission rules.** Allow the few commands that must run outside the sandbox, deny the dangerous ones, and mount only extra paths the task needs:

   ```json
   {
     "permissions": {
       "allow": ["command(npm test)", "command(git diff)", "read_file(/var/log/app)", "write_file(build/)", "read_url(registry.npmjs.org)"],
       "deny": ["command(sudo *)", "command(rm -rf /)", "write_file(/home/user/.ssh)"]
     }
   }
   ```

   Domains allowed under `read_url` join the sandbox's outbound allowlist. Business and enterprise accounts use `unsandboxed(...)` allow rules for commands that must leave the sandbox. Keep allow rules specific; `command(regex:.*)` defeats the purpose.

   **Check:** Every allow rule has a reason the user agreed to, and approvals of the "always allow" kind were reviewed rather than accumulated by habit.

4. **Scope each custom agent.** In an agent's frontmatter, give the fewest tools and the narrowest `commandExecutionPolicy` (`sandbox` is the default; other values are `off`, `auto` and `eager`). Reviewers and auditors get read-only tools; agents that read untrusted content never get `eager` or write access to credentials.

   **Check:** No agent that processes external content can both run unsandboxed commands and reach the network.

5. **Use a container when you need stronger or reproducible isolation:** a devcontainer for day-to-day agent work, a throwaway `docker run` for untrusted code, gVisor (`--runtime=runsc`) when the code is actively hostile. Recipes: [container recipes](references/container-recipes.md).

   ```bash
   docker run --rm -it --network=none --read-only --tmpfs /tmp:rw,nosuid,size=256m \
     --cap-drop=ALL --security-opt=no-new-privileges --pids-limit=256 --memory=2g --cpus=2 \
     --user 1000:1000 -v "$(pwd):/work:ro" -w /work node:22-slim npm test
   ```

   PowerShell: replace `\` with a backtick and `"$(pwd):/work:ro"` with `"${PWD}:/work:ro"`.

   **Check:** Inside the container, `id` shows a non-root user, writes to `/work` fail, and network calls fail.

6. **Allowlist egress when network is needed.** Route traffic through a proxy that permits only package registries and required APIs, or use Kubernetes `NetworkPolicy`, VPC firewall egress rules or Secure Web Proxy in the cloud. Block cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`) from agent workloads.

   **Check:** A request to a non-allowlisted domain fails; installs from the registry still work.

7. **Give agents their own cloud identity.** A separate project for agent experiments, a dedicated service account with only the roles the task needs, short-lived impersonated credentials instead of keys, and a separate gcloud configuration directory so the agent never inherits your admin login:

   ```bash
   export CLOUDSDK_CONFIG="$HOME/.config/gcloud-agent"          # PowerShell: $env:CLOUDSDK_CONFIG = "$HOME\.config\gcloud-agent"
   gcloud config set project agent-sandbox-PROJECT
   gcloud config set auth/impersonate_service_account agent-runner@agent-sandbox-PROJECT.iam.gserviceaccount.com
   ```

   Impersonation requires `roles/iam.serviceAccountTokenCreator` for your user on that service account; the agent then gets tokens that expire within an hour. Apply budgets to the sandbox project.

   **Check:** `gcloud auth list` inside the agent environment shows no personal admin account, and the service account has no roles in production projects.

## Reference

### Isolation options compared

| Option | Boundary | Start-up | Good for | Limits |
| :--- | :--- | :--- | :--- | :--- |
| Antigravity terminal sandbox | OS namespaces / Seatbelt / AppContainer | None | Everyday agent commands | Needs OS support; host kernel shared |
| Devcontainer | Container | Seconds | Reproducible agent workspace, team-wide | Shares kernel; mounts decide exposure |
| `docker run` hardened | Container, no caps, read-only, no network | Seconds | Running untrusted builds and tests | Docker daemon itself is privileged |
| Rootless Docker or Podman | Container in a user namespace | Seconds | Same, without a root daemon | Some images and features need tweaks |
| gVisor (`runsc`), GKE Sandbox | User-space kernel | Seconds | Hostile code, multi-tenant execution | Syscall compatibility and I/O overhead |
| MicroVM / separate VM / Windows Sandbox | Hypervisor | Seconds to minutes | Strongest local isolation | Heavier; manual file sharing |
| Separate cloud project and SA | IAM | n/a | Any cloud access by agents | Needs IAM discipline |

### Never mount by default

`~/.ssh`, `~/.gnupg`, `~/.config/gcloud`, `~/.aws`, `~/.azure`, `~/.kube`, `~/.docker/config.json`, `~/.npmrc`, `~/.pypirc`, `~/.netrc`, `~/.git-credentials`, browser profile directories, `/var/run/docker.sock`, your home directory as a whole. If a task truly needs git push access, use a repository-scoped deploy key or a fine-grained token with an expiry, injected for that task only.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Turbo or `eager` mode on a machine with production credentials | Sandboxed preset plus a separate agent identity | One injected command reaches everything you can |
| Mount the Docker socket into an agent container | Rootless or remote builders, or Kaniko/Buildah | Socket access equals root on the host |
| Mount `$HOME` "to make tools work" | Mount the project read-only and named caches | Exposes every credential file |
| Leave network open during untrusted builds | `--network=none` or a registry-only proxy | Postinstall scripts can exfiltrate source and env |
| Reuse your gcloud login inside the agent | `CLOUDSDK_CONFIG` plus impersonated SA in a sandbox project | Your admin token outlives the task and spans projects |
| Assume the sandbox is on | Test a forbidden read and a forbidden request | Unsupported hosts silently ignore sandbox settings |

## Verification checklist

- [ ] The terminal sandbox (or a container) is active, proven by a failed read of `~/.ssh` and a failed request to a non-allowlisted domain.
- [ ] Permission allow rules are specific and each was approved by the user.
- [ ] Custom agents have minimal tools and an appropriate `commandExecutionPolicy`; none processing untrusted content runs `eager`.
- [ ] No credential directories or the Docker socket are mounted into agent environments.
- [ ] Agent cloud access uses a dedicated project and service account with short-lived credentials.
- [ ] Egress is allowlisted where network access is needed, and metadata endpoints are blocked.

## Related

- Knowledge: `agent-shield`, `credential-sanitizer`, `security-audit`, `docker-containers`, `kubernetes-gke`, `cloud-devops`, `antigravity-customization`, `subagent-delegation`.
- Workflows: `/harness-audit`, `/security-scan`.
- Agents: `security-guard`, `cloud-devops-engineer`.
