---
name: ansible
disable-model-invocation: true
description: >-
  Writes, reviews and tests Ansible automation: static and dynamic inventories
  (including the Google Cloud plugin), roles and collections, idempotent tasks
  and handlers, check and diff mode, rolling updates, Ansible Vault, ansible-lint
  and Molecule. Use when configuring VMs or servers with playbooks, turning ad
  hoc scripts into roles, encrypting secrets in a repo, or making a playbook
  safe to re-run.
---

# Ansible

Converge hosts to a declared state with playbooks that are safe to run twice.
Every run against shared hosts starts with `--check --diff` on a narrow target,
and production runs need the user's explicit yes after they have seen that diff.

## When to use

- Writing or reviewing playbooks, roles, `group_vars`/`host_vars` or inventories.
- Configuring Compute Engine VMs, bare metal or on-prem servers: packages, users, files, services.
- A playbook reports `changed` on every run, or fails halfway through a fleet.
- Encrypting values that must live in the repo, or adding Molecule tests to a role.

## When not to use

- Creating cloud resources (networks, buckets, databases): use `terraform-iac` or `pulumi`, then hand host config to Ansible.
- Container or Kubernetes workloads: use `docker-containers`, `kubernetes-gke` or `helm-charts`; bake config into images.
- One-off diagnosis on a single host: use `linux-admin`.
- Deciding where secrets live long term: use `secrets-management`. Vault-encrypted files are a fallback, not a secret store.

## Workflow

1. **Orient.** `find_by_name` for `ansible.cfg`, `inventory*`, `site.yml`, `roles/`, `requirements.yml` and `.ansible-lint`. Run `ansible --version` to see the core version, Python and config file in effect. The control node must be Linux or macOS; on Windows, run Ansible inside WSL.

   **Check:** You can name the inventory source, the target group and the config file in use.

2. **Prove the inventory.**

   ```bash
   ansible-inventory -i inventory/ --graph
   ansible-inventory -i inventory/ --host web-1        # merged vars for one host
   ansible web -i inventory/ -m ansible.builtin.ping
   ```

   **Check:** The graph shows the intended groups and every target answers `pong`.

3. **Write idempotent tasks.** Prefer a module that manages state over `shell`/`command`. When a command is unavoidable, add `creates:`/`removes:` or `changed_when:`, plus `failed_when:` if the exit code lies. Use fully qualified names (`ansible.builtin.template`), `notify` handlers for restarts, and `no_log: true` on any task that handles secrets.

   **Check:** `ansible-lint` passes, and no `shell` or `command` task lacks a `changed_when` or `creates` guard.

4. **Structure as roles.** `ansible-galaxy role init roles/<name>` creates `tasks/`, `handlers/`, `templates/`, `defaults/` (overridable) and `vars/` (fixed). Pin collections in `requirements.yml` and install them with `ansible-galaxy collection install -r requirements.yml`.

   **Check:** `site.yml` only maps groups to roles; logic lives in roles.

5. **Dry-run on a narrow target.**

   ```bash
   ansible-playbook -i inventory/ site.yml --syntax-check
   ansible-playbook -i inventory/ site.yml --list-hosts --limit web
   ansible-playbook -i inventory/ site.yml --check --diff --limit web-1
   ```

   Tasks that depend on earlier changes can fail in check mode. Mark read-only lookups with `check_mode: false` and guard the rest with `when: not ansible_check_mode`.

   **Check:** The diff shows only the intended file, package and service changes, and you have shown it to the user.

6. **Apply with consent and a rolling strategy.** For shared or production hosts, ask the user before running without `--check`. Set `serial` (for example `serial: "20%"`) and `max_fail_percentage` on the play so a bad change stops after the first batch.

   **Check:** The play recap shows `failed=0` and `unreachable=0` for every host.

7. **Prove idempotency.** Run the identical command again.

   **Check:** The second recap reports `changed=0` for every host.

8. **Test roles with Molecule.** `molecule test` runs create, converge, idempotence, verify and destroy against a container or VM driver. Install the driver plugin for your platform; driver packaging changed between Molecule major versions, so verify against current docs.

   **Check:** `molecule test` passes in CI, including the idempotence step.

## Patterns

### Google Cloud dynamic inventory

```yaml
# inventory/prod.gcp.yml  (file name must end in gcp.yml or gcp.yaml)
plugin: google.cloud.gcp_compute
projects:
  - acme-prod
auth_kind: application            # Application Default Credentials
filters:
  - status = RUNNING
keyed_groups:
  - key: labels.role              # VM label role=web becomes group role_web
    prefix: role
hostnames:
  - name
compose:
  ansible_host: networkInterfaces[0].networkIP
```

Reach private VMs through IAP or a bastion instead of public IPs. Requires the `google.cloud` collection and the `google-auth` and `requests` Python packages on the control node.

### Secrets with Vault

```bash
ansible-vault create group_vars/prod/vault.yml
ansible-vault encrypt_string --vault-id prod@prompt 'value-here' --name 'vault_db_password'
ansible-playbook -i inventory/ site.yml --vault-id prod@prompt
ansible-vault rekey group_vars/prod/vault.yml
```

Keep encrypted values in `vault.yml` with a `vault_` prefix and reference them from a plain `vars.yml` (`db_password: "{{ vault_db_password }}"`), so `grep_search` still finds every variable. Prefer fetching from Secret Manager at run time with the `google.cloud` collection's lookup (check the current collection docs for its name and options).

### Variable precedence (simplified)

| Lowest to highest | Use for |
| :--- | :--- |
| Role `defaults/` | Safe, overridable defaults |
| Inventory `group_vars/` then `host_vars/` | Per-environment and per-host values |
| Play `vars`, role `vars/` | Values a role must not have overridden |
| `-e` extra vars | One-off overrides; they beat everything |

### Rolling update play

```yaml
- hosts: role_web
  serial: "20%"
  max_fail_percentage: 0
  pre_tasks:
    - name: Drain from load balancer
      ansible.builtin.include_tasks: tasks/drain.yml
  roles:
    - app
  post_tasks:
    - name: Wait for health
      ansible.builtin.uri:
        url: "http://{{ ansible_host }}:8080/healthz"
      register: health
      until: health.status == 200
      retries: 10
      delay: 5
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `shell: apt-get install -y nginx` | `ansible.builtin.apt: name=nginx state=present` | Modules report real change state and support check mode |
| Run a new playbook on the whole fleet first | `--check --diff --limit` one host, then `serial` batches | A bad task fails everywhere at once |
| `ignore_errors: true` to get green runs | `failed_when` with the real failure condition | Hidden failures leave hosts half-configured |
| Restart services inside tasks | `notify` a handler | Handlers run once, only when something changed |
| Plaintext secrets in `group_vars` | Vault or a Secret Manager lookup, plus `no_log` | Repos and `-v` logs leak them |
| Unpinned collections | Versions in `requirements.yml` | Collection upgrades change module behaviour |

## Verification checklist

- [ ] `ansible-lint` and `--syntax-check` pass.
- [ ] A `--check --diff` run on a limited target was shown to the user before any real run.
- [ ] Production or shared runs had explicit user consent and used `serial`.
- [ ] A second run reports `changed=0` everywhere.
- [ ] No plaintext secrets; secret-handling tasks use `no_log: true`.
- [ ] Roles have Molecule tests that include the idempotence step.

## Related

- Agents: `cloud-devops-engineer` (infrastructure changes), `security-guard` (secrets and hardening review), `sre-engineer`.
- Workflows: `/code-review`, `/checkpoint` before fleet-wide runs.
- Knowledge: `linux-admin`, `terraform-iac`, `pulumi`, `secrets-management`, `cloud-devops`, `gcp-iam`.
