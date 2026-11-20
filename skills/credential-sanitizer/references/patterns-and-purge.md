# Credential patterns, rotation and history purge

Patterns are written as regular expressions so this file does not itself
contain anything that scans as a secret.

## Detection patterns

| Credential | Regex (approximate) | Notes | `eag shield` | gitleaks / trufflehog |
| :--- | :--- | :--- | :--- | :--- |
| GCP service-account key | JSON with `"type"\s*:\s*"service_account"` and a `private_key` field | Full impersonation of the SA until the key is deleted | Yes | Yes |
| Google / Gemini API key | `AIza[0-9A-Za-z_-]{35}` | Same format for Maps, Firebase and Gemini (AI Studio) keys; Firebase web keys are public by design but should be restricted | Yes | Yes |
| Google OAuth client secret | `GOCSPX-[0-9A-Za-z_-]{28}` | Rotate in the OAuth client settings | No | Yes |
| Google OAuth access token | `ya29\.[0-9A-Za-z_-]+` | Short-lived (about an hour) but usable until expiry | No | Partial |
| AWS access key ID | `(AKIA\|ASIA)[0-9A-Z]{16}` | Secret key is 40 base64 characters, found near the ID | Yes | Yes |
| GitHub token | `(ghp\|gho\|ghu\|ghs\|ghr)_[A-Za-z0-9]{36}`, `github_pat_[A-Za-z0-9_]{60,}` | GitHub auto-revokes some tokens found in public repos | Yes | Yes |
| GitLab token | `glpat-[A-Za-z0-9_-]{20}` | | Yes | Yes |
| Stripe secret / restricted key | `(sk\|rk)_live_[0-9A-Za-z]{20,}` | `sk_test_` keys are lower risk but still rotate; `pk_` keys are publishable; webhook secrets start `whsec_` | Live keys | Yes |
| Slack token / webhook | `xox[abprs]-[0-9A-Za-z-]{10,}`, `hooks\.slack\.com/services/T\w+/B\w+/\w+` | | Tokens | Yes |
| LLM provider keys | `sk-proj-[A-Za-z0-9_-]{40,}`, `sk-ant-[A-Za-z0-9_-]{30,}` | | Yes | Yes |
| npm / PyPI token | `npm_[A-Za-z0-9]{36}`, `pypi-[A-Za-z0-9_-]{50,}` | | npm only | Yes |
| Private key (PEM) | `-----BEGIN [A-Z ]*PRIVATE KEY-----` | SSH, TLS, JWT signing, GPG (`PGP PRIVATE KEY BLOCK`) | Yes | Yes |
| JWT | `eyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{10,}` | Often a session token; decode the header and payload to judge scope and expiry | Yes | Partial |
| Connection string with password | `\w+://[^:\s/]+:[^@\s]+@[^\s]+` | Postgres, MySQL, MongoDB, Redis, AMQP URLs | No | Yes |
| Generic assignment | `(api[_-]?key\|secret\|token\|password)\s*[:=]\s*["'][^"']{12,}["']` | High false-positive rate; review by hand | Yes | Yes |

Also check: `.env*`, `*.pem`, `*.p12`, `*.jks`, `id_rsa`, `id_ed25519`, `credentials.json`, `*service-account*.json`, `terraform.tfstate` (contains secrets in plain text), `.npmrc`, `.pypirc`, `.docker/config.json`, Kubernetes `Secret` manifests (base64 is encoding, not encryption), notebook outputs, HAR files, crash dumps and container image layers (`docker history`, `trivy image --scanners secret IMAGE`).

## Rotation by provider

| Credential | Rotate | Then revoke old (ask first, irreversible) |
| :--- | :--- | :--- |
| GCP service-account key | Prefer removing keys entirely (attached SA, WIF). Otherwise `gcloud iam service-accounts keys create new.json --iam-account=SA_EMAIL` and store it in Secret Manager | `gcloud iam service-accounts keys disable KEY_ID --iam-account=SA_EMAIL`, verify nothing breaks, then `... keys delete KEY_ID --iam-account=SA_EMAIL` |
| Google / Gemini API key | Create a restricted key: `gcloud services api-keys create --display-name=NAME --api-target=service=generativelanguage.googleapis.com` (or in AI Studio for Gemini keys) | `gcloud services api-keys delete KEY_ID` |
| Secret Manager value | `gcloud secrets versions add NAME --data-file=-` (value from stdin) | `gcloud secrets versions disable VERSION --secret=NAME`, later `destroy` |
| Cloud SQL user password | `gcloud sql users set-password USER --instance=INSTANCE --prompt-for-password` | Old password stops working immediately: deploy the new value first |
| AWS access key | `aws iam create-access-key --user-name USER` | `aws iam update-access-key --access-key-id ID --status Inactive --user-name USER`, then `aws iam delete-access-key --access-key-id ID --user-name USER` |
| GitHub token | Create a fine-grained token with minimal scopes, or switch to a GitHub App | Revoke in Settings, Developer settings |
| Stripe key | Roll the key in the Dashboard (optionally with an expiry overlap) | Expire the old key |
| SSH or TLS private key | Generate a new key pair, install the public key or reissue the certificate | Remove the old public key from `authorized_keys`, deploy keys and hosts; revoke the certificate |

After rotation, check for use of the old credential during the exposure window: Cloud Audit Logs (filter on the principal, and for SA keys on `protoPayload.authenticationInfo.serviceAccountKeyName`), AWS CloudTrail, GitHub audit log, Stripe request logs.

## Cleaning history

Decision table:

| Situation | Action |
| :--- | :--- |
| Secret only in the working tree | Remove it, rotate if it was ever shared, commit the fix |
| In local commits, never pushed | Rewrite the local commits (amend or interactive rebase run by the user); still rotate if it was real |
| Pushed to a private remote | Rotate (mandatory). Purge history only if the user wants it and collaborators can re-clone |
| Public repository or published package | Rotate immediately (assume it was scraped within minutes). Purge is cosmetic; do it only with consent |

Purge procedure with `git filter-repo` (destructive: requires explicit user consent and a coordinated force-push):

1. Rotate first. Tell collaborators to push or stash their work and pause merges.
2. Work in a fresh mirror clone, and keep an untouched backup:

   ```bash
   git clone --mirror git@github.com:OWNER/REPO.git repo-mirror.git
   cp -r repo-mirror.git repo-backup.git        # PowerShell: Copy-Item -Recurse repo-mirror.git repo-backup.git
   cd repo-mirror.git
   ```

3. Rewrite. Either remove whole files:

   ```bash
   git filter-repo --invert-paths --path config/service-account.json --path .env
   ```

   or replace secret text using an expressions file (one rule per line, `literal==>replacement` or `regex:pattern==>replacement`), kept outside the repository and deleted afterwards:

   ```bash
   git filter-repo --replace-text ../expressions.txt
   ```

4. Verify on the rewritten mirror: `gitleaks git . --redact -v` is clean.
5. Force-push all refs only after the user confirms: `git push --force --mirror` (re-add the remote first if filter-repo removed it). Branch protection may need to be lifted temporarily by an admin.
6. Ask everyone to re-clone; old clones reintroduce the secret if merged. On GitHub, cached views of old commits and PR refs can persist: contact GitHub Support to purge them.
7. Delete the backup clone once the rewrite is confirmed good.

`bfg --replace-text` and `bfg --delete-files` are an alternative to filter-repo with the same consent requirements.

## Placeholder conventions for docs and tests

Use values that are obviously fake and do not match detection patterns, for example `YOUR_API_KEY`, `<gemini-api-key>`, `${STRIPE_SECRET_KEY}`, or provider-documented example keys. Never base a placeholder on a real key with a few characters changed.
