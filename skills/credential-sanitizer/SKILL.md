---
name: credential-sanitizer
disable-model-invocation: true
description: >-
  Finds and removes leaked credentials: detection patterns for GCP
  service-account keys, Gemini and Google API keys, AWS, GitHub, Stripe,
  private keys and JWTs; scanning with eag shield, gitleaks and trufflehog;
  log redaction; rotation after exposure; history purging with git
  filter-repo only with consent; and pre-commit prevention. Use when a secret
  was committed, pasted or logged, before publishing a repo, or to add secret
  scanning.
---

# Credential Sanitizer

A leaked credential is compromised the moment it leaves the machine. The order
is fixed: contain, rotate, remove, prevent. Deleting the line or rewriting
history without rotating only hides the evidence from you, not from whoever
already copied it.

## When to use

- A key, token, password or private key appears in code, config, a commit, a log, a screenshot or a chat.
- Before open-sourcing a repository or publishing a container image or package.
- Adding secret scanning to pre-commit hooks or CI.
- Log output or error reports contain tokens, headers or connection strings.

## When not to use

- The EAG hook blocked (or asked about) a secret write and you need to understand or tune it: use `agent-shield`.
- Designing secret storage and IAM for a new service: use `cloud-devops` (Secret Manager, Workload Identity Federation).
- A full application security review: use `security-audit` or `/security-scan`.

## Workflow

1. **Contain: never echo the secret.** Refer to a finding by file, line and type only. Do not print it, paste it into chat, put it in a commit message, an issue, a URL or a test fixture. If the secret is in agent context, say so and avoid repeating it.

   **Check:** Your report contains previews at most (first 4 characters), never a full value.

2. **Scan everything that might hold it** (working tree, full git history, build artifacts, logs):

   ```bash
   eag shield --file path/to/suspect.env          # EAG patterns, exit 1 on findings
   gitleaks dir . --redact -v                     # working tree (gitleaks 8.19+; older: gitleaks detect --no-git)
   gitleaks git . --redact -v                     # every commit (older: gitleaks detect --source .)
   trufflehog git file://. --no-verification      # history, offline
   trufflehog filesystem . --no-verification
   ```

   trufflehog's verification mode calls each provider's API with the candidate credential; use `--no-verification` unless the user agrees to that network call. Patterns and what each tool covers: [patterns and history purge](references/patterns-and-purge.md).

   **Check:** You have a list of findings with type, location (file and commit), and exposure scope.

3. **Classify each finding.** Real or placeholder? Live, test or revoked? Exposure: working tree only, local commits, pushed to a private remote, public, in CI logs, in an image layer, in a published package. Anything that left the machine counts as compromised.

   **Check:** Each finding has a verdict: false positive (with reason), rotate now, or rotate plus purge.

4. **Rotate before cleaning.** Issue a new credential, deploy it (Secret Manager version, CI secret), confirm the app works, then disable and revoke the old one. Revocation and key deletion are irreversible and can cause outages: present the plan to the user and get explicit confirmation for each provider. The user enters new secret values themselves.

   ```bash
   gcloud iam service-accounts keys list --iam-account=SA_EMAIL --managed-by=user
   gcloud iam service-accounts keys disable KEY_ID --iam-account=SA_EMAIL     # reversible first step
   gcloud services api-keys list                                             # Google and Gemini API keys
   gcloud sql users set-password app --instance=INSTANCE --prompt-for-password
   ```

   **Check:** The old credential is disabled or revoked, the new one is in a secret store, and provider audit logs were checked for use of the old one during the exposure window.

5. **Remove it from the code path.** Replace literals with environment variables or Secret Manager lookups, add the file pattern to `.gitignore`, and commit a `.env.example` with placeholder values only. Prefer keyless auth (attached service accounts, Workload Identity Federation, ADC locally) so there is nothing to leak.

   **Check:** `eag shield --file` and `gitleaks dir .` are clean on the working tree.

6. **Purge history only with explicit consent.** If the secret was pushed, rewriting history (`git filter-repo`) and force-pushing affects every collaborator, open PRs and forks, and does not remove copies already cloned or cached. Explain this, get explicit approval, and follow the reference procedure. Rotation in step 4 is still required.

   **Check:** The user approved the rewrite in chat; after it, `gitleaks git .` on a fresh clone is clean.

7. **Prevent recurrence.** Add a pre-commit hook, CI scanning and provider push protection, and redact secrets in logs (patterns below).

   **Check:** A test commit containing a fake key in the right shape is rejected locally and in CI.

## Patterns

### Prevention setup

```yaml
# .pre-commit-config.yaml (run `pre-commit autoupdate` to pin the current release)
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.24.0
    hooks:
      - id: gitleaks
```

```bash
pip install pre-commit && pre-commit install && pre-commit autoupdate
```

- CI: run gitleaks or trufflehog on every PR (full history on the default branch nightly).
- Enable the hosting provider's secret scanning and push protection (GitHub, GitLab).
- Keep the EAG `secrets` hook feature on (`standard` or `strict` profile). Agents are then blocked from writing high-confidence keys into source files and asked about low-confidence matches; local `.env` files stay writable.

### Redaction in logs

```python
import logging
import re

_SECRET = re.compile(
    r"(AIza[0-9A-Za-z_-]{35}|(?:AKIA|ASIA)[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36}"
    r"|sk_live_[0-9A-Za-z]{20,}|eyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{10,}"
    r"|(?i:bearer)\s+[\w.~+/-]{20,}=*)"
)


class RedactSecrets(logging.Filter):
    """Mask credential-shaped substrings in log messages and arguments."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = _SECRET.sub("[REDACTED]", str(record.msg))
        if record.args:
            args = record.args if isinstance(record.args, tuple) else (record.args,)
            record.args = tuple(_SECRET.sub("[REDACTED]", str(a)) for a in args)
        return True


logging.getLogger().addFilter(RedactSecrets())
```

- Node with pino: `pino({ redact: { paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.apiKey'], censor: '[REDACTED]' } })`.
- Go `log/slog`: a `ReplaceAttr` function in `HandlerOptions` that masks known keys.
- Redact by field name (structured logging) first; regex redaction of free text is the safety net. Never log full request bodies or headers on auth routes.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Delete the line and commit "remove key" | Rotate first, then remove, then decide on history | The key is still in history and in every clone |
| Force-push a rewritten history without asking | Explain the impact and get explicit consent | It breaks collaborators' clones and open PRs |
| Echo the secret while investigating | Refer to file, line, type and a short preview | Chat logs, terminals and transcripts are new leak sites |
| Commit `.env` "just for now" | `.env` in `.gitignore` plus `.env.example` | "Temporary" commits get pushed |
| Download service-account JSON keys | Attached service accounts, WIF, ADC | No long-lived key means nothing to leak |
| Rely on `.gitignore` alone | Pre-commit scanning plus push protection | `git add -f` and renamed files bypass ignore rules |
| Use real credentials in tests or fixtures | Fake values in a clearly fake format | Fixtures get copied into docs and screenshots |

## Verification checklist

- [ ] No full secret value appears in any output, commit, issue or log produced during the work.
- [ ] Every real finding was rotated, with the old credential disabled or revoked after user confirmation.
- [ ] Provider audit logs were checked for use of exposed credentials.
- [ ] Working tree scans (`eag shield`, gitleaks) are clean.
- [ ] History was rewritten only with explicit consent, and a fresh clone scans clean.
- [ ] Pre-commit hook, CI scanning and log redaction are in place.

## Related

- Knowledge: `agent-shield`, `security-audit`, `cloud-devops`, `sandbox-isolation`, `git-workflow`, `ci-cd-github-actions`.
- Workflows: `/security-scan`, `/pr-ready`.
- Agents: `security-guard`, `cloud-devops-engineer`.
