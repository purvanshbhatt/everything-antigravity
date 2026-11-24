---
name: linux-admin
disable-model-invocation: true
description: >-
  Administers and troubleshoots Linux hosts: systemd units and hardening,
  journald logs, users, groups, permissions and sudo, SSH access (including OS
  Login and IAP on Compute Engine), networking checks, disk and inode
  exhaustion, OOM kills and a 60-second performance triage. Use when a service
  will not start, a VM is slow or full, logs are needed from a host, or a
  systemd unit or permission model must be written or reviewed.
---

# Linux Administration

Diagnose from evidence, change one thing at a time, and never lock yourself
out. Read-only commands run freely. Restarts, reboots, firewall or SSH changes,
package upgrades and file deletion on shared hosts need the user's explicit yes.

## When to use

- A service fails to start, flaps or is killed; you need its logs.
- A host is slow, out of disk, out of inodes or out of memory.
- Writing a systemd unit, timer, sudoers rule or SSH configuration.
- Checking ports, DNS, routes or connectivity from inside a VM or container.

## When not to use

- Fleet-wide configuration: codify it with `ansible`.
- Cloud Run or GKE workloads, where you do not own the host: use `cloud-run` or `kubernetes-gke`.
- Reverse proxy and TLS configuration: use `nginx-proxy`.
- Deep CPU or memory analysis inside one process: use `profiling` or `memory-leaks`.

## Workflow

1. **Get on the host safely.** On Compute Engine prefer OS Login and IAP over public SSH: `gcloud compute ssh VM --zone ZONE --tunnel-through-iap`. The same command works from PowerShell; every command below runs on the Linux host. Note the distro and init with `cat /etc/os-release` and `ps -p 1 -o comm=`.

   **Check:** You know the distro, the init system (expect `systemd`) and whether you have sudo.

2. **Triage in 60 seconds.** Run these in order and note anything abnormal before going deeper.

   ```bash
   uptime                      # load averages vs CPU count (nproc)
   dmesg -T | tail -n 20       # OOM kills, disk and NIC errors
   vmstat 1 5                  # r > CPUs = CPU saturation; si/so > 0 = swapping
   mpstat -P ALL 1 3           # one hot CPU = single-threaded bottleneck
   pidstat 1 3                 # per-process CPU
   iostat -xz 1 3              # %util near 100 or high await = disk saturation
   free -m                     # "available" is what matters, not "free"
   sar -n DEV 1 3              # NIC throughput vs link speed
   top -b -n 1 | head -n 20
   ```

   `mpstat`, `pidstat`, `iostat` and `sar` come from the `sysstat` package.

   **Check:** You can say which resource (CPU, memory, disk, network) is saturated or erroring, or that none is.

3. **Read the service's state and logs.**

   ```bash
   systemctl status app.service
   systemctl list-units --failed
   journalctl -u app.service -b --since "1 hour ago" --no-pager
   journalctl -u app.service -p err -n 100 --no-pager
   journalctl -k | grep -iE 'oom|killed process'
   ```

   **Check:** You have the exact error line and timestamp of the first failure, not just the last one.

4. **Fix disk and inode exhaustion.**

   ```bash
   df -h; df -i
   sudo du -xh --max-depth=1 / 2>/dev/null | sort -h | tail -n 15
   sudo lsof +L1               # deleted files still held open by a process
   journalctl --disk-usage
   ```

   Space held by deleted-but-open files returns only when that process restarts. Ask before deleting logs or vacuuming the journal (`journalctl --vacuum-size=500M`).

   **Check:** `df -h` shows the filesystem below 85 percent, and the cause (log growth, temp files, missing rotation) is recorded.

5. **Check the network from the host.**

   ```bash
   ip -br addr; ip route
   ss -tulpn                   # what listens where, and which process
   resolvectl status           # or: cat /etc/resolv.conf
   dig +short api.example.com
   curl -sv --max-time 5 https://api.example.com/healthz -o /dev/null
   nc -zv db.internal 5432
   ```

   **Check:** You can state whether the failure is DNS, routing, a firewall, TLS or the remote service.

6. **Write or change a unit, then reload.** Use the hardened template below, validate it, and restart only with consent on shared hosts.

   ```bash
   sudo systemd-analyze verify /etc/systemd/system/app.service
   sudo systemctl daemon-reload
   sudo systemctl enable --now app.service
   systemd-analyze security app.service    # exposure score; lower is better
   ```

   **Check:** `systemctl is-active app.service` prints `active`, and the logs show a clean start.

## Reference

### Hardened service unit

```ini
[Unit]
Description=App API
After=network-online.target
Wants=network-online.target

[Service]
User=app
Group=app
ExecStart=/opt/app/bin/server
Restart=on-failure
RestartSec=5
EnvironmentFile=-/etc/app/env
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/app
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

Create the account with `sudo useradd --system --no-create-home --shell /usr/sbin/nologin app`. Replace cron with a `.timer` unit when you need logging and retries.

### Permissions and access

| Task | Command |
| :--- | :--- |
| Add a user to a group | `sudo usermod -aG docker alice` (the `-a` matters; without it other groups are removed) |
| Edit sudo rules | `sudo visudo -f /etc/sudoers.d/deploy`; grant specific commands, not `ALL` |
| Fine-grained file access | `setfacl -m u:alice:rX /srv/data`, check with `getfacl` |
| SSH hardening | `PasswordAuthentication no`, `PermitRootLogin no`; run `sudo sshd -t` before reloading |
| Who changed what | `last`, `journalctl _COMM=sudo` |

Before reloading `sshd` or changing firewall rules on a remote host, keep a second session open so a mistake does not lock you out.

### Symptom map

| Symptom | First command | Usual cause |
| :--- | :--- | :--- |
| Exit code 137, process vanished | `journalctl -k \| grep -i oom` | OOM killer; raise memory or fix the leak |
| `Too many open files` | `cat /proc/<pid>/limits` | `LimitNOFILE` too low or a descriptor leak |
| `No space left on device`, disk not full | `df -i` | Inode exhaustion from many small files |
| High load, idle CPU | `vmstat 1` (`b` and `wa` columns) | Processes blocked on I/O |
| Clock-related TLS or token errors | `timedatectl` | NTP not synchronized |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `chmod -R 777` to fix access | Fix ownership, groups or ACLs | Anyone on the host can then modify the files |
| Reboot first, diagnose later | Capture `dmesg`, `journalctl` and `ps` first | The reboot destroys the evidence |
| Edit units under `/lib/systemd/system` | `systemctl edit app` (drop-in) or `/etc/systemd/system` | Package upgrades overwrite vendor units |
| Open port 22 to `0.0.0.0/0` | OS Login with IAP or a bastion | Public SSH attracts constant brute force |
| `rm` a log a process still writes | Rotate with `logrotate`, or truncate with consent | The space is not freed until the process closes the file |
| Hand-configure many servers | Codify in `ansible` | Snowflake hosts drift and cannot be rebuilt |

## Verification checklist

- [ ] The cause is backed by a log line, a metric or command output.
- [ ] Restarts, reboots, deletions and firewall or SSH changes had explicit consent.
- [ ] Units pass `systemd-analyze verify` and run as a non-root user.
- [ ] Disk below 85 percent with rotation in place; no deleted-open files left.
- [ ] Manual fixes are captured in `ansible` or IaC so the next host gets them.

## Related

- Agents: `sre-engineer`, `cloud-devops-engineer`, `security-guard`.
- Workflows: `/root-cause`.
- Knowledge: `ansible`, `nginx-proxy`, `bash-scripting`, `observability-otel`, `profiling`, `memory-leaks`, `cloud-networking`.
