---
name: ci-cd-github-actions
description: >-
  Designs fast, secure GitHub Actions pipelines: triggers, dependency and
  Docker caching, matrix builds, concurrency groups, least-privilege
  permissions, SHA-pinned actions, keyless OIDC to Google Cloud via Workload
  Identity Federation, reusable workflows, protected environments and Cloud
  Run deploys. Use when writing or debugging a workflow, when CI is slow or
  flaky, or when hardening CI against secret leaks and pwn requests.
---

# CI/CD with GitHub Actions

Build pipelines that give a trustworthy signal in minutes, hold no long-lived
cloud keys, and cannot be hijacked by a pull request. Every workflow is code
with production credentials: review it like code that can deploy.

**Confirmation rule.** Triggering a deploy (`gh workflow run deploy.yml`),
re-running a production job, adding or changing repository secrets, environments,
rulesets or Workload Identity bindings, and any change that introduces
`pull_request_target` or `workflow_run` require the user's explicit yes.

## When to use

- Writing a new workflow, or changing triggers, caching, matrices or deploy jobs.
- CI is slow, flaky, or fails only in Actions (`gh run view --log-failed`).
- Replacing a stored service-account key with OIDC to Google Cloud.
- Reviewing workflows for least privilege, unpinned actions or injection risks.

## When not to use

- The build itself fails the same way locally: use `/build-fix` or the `build-error-resolver` agent.
- Dockerfile size or caching inside the image: use `docker-containers`.
- What Terraform or Kubernetes should do once CI calls them: use `terraform-iac` or `kubernetes-gke`.
- A full supply-chain or secret audit of the repository: use `/security-scan`.

## Workflow

1. **Inventory and read the evidence.** `list_dir .github/workflows`, `view_file` each workflow, then check recent runs:

   ```bash
   gh run list --limit 20
   gh run view RUN_ID --log-failed
   ```

   **Check:** You have a table of workflow, triggers, `permissions`, secrets used and third-party actions.

2. **Choose triggers and concurrency.** `pull_request` for untrusted code, `push` to `main` for post-merge work, `merge_group` if the merge queue is on, `workflow_dispatch` for manual runs, `schedule` for drift and nightly jobs. Use `paths`/`paths-ignore` filters for monorepos. Cancel superseded PR runs, never deploys:

   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: ${{ github.event_name == 'pull_request' }}
   ```

   **Check:** Pushing twice to a PR cancels the first run; two merges to `main` deploy in order.

3. **Set least-privilege permissions.** Top level `permissions: contents: read`; add scopes per job (`id-token: write` only on jobs that authenticate to a cloud, `pull-requests: write` only on jobs that comment). Set the organization default `GITHUB_TOKEN` permission to read-only.

   **Check:** No workflow relies on the default token permissions, and `write-all` appears nowhere.

4. **Pin every action to a full commit SHA.** Keep the version in a comment and let Dependabot (`package-ecosystem: github-actions`) bump both. Find the latest release and its commit:

   ```bash
   gh release view --repo actions/checkout --json tagName --jq .tagName
   gh api repos/actions/checkout/commits/TAG --jq .sha
   ```

   Examples in this skill use major tags for readability; check each action's latest release before pinning.

   **Check:** Every `uses:` outside your own repository ends in a 40-character SHA with a `# vX.Y.Z` comment.

5. **Make it fast: cache and fan out.** Use the built-in caches in `actions/setup-node` (`cache: npm|pnpm|yarn`) and `actions/setup-python` (`cache: pip|poetry|pipenv`), `actions/cache` keyed on `hashFiles()` of the lockfile for everything else, and `cache-from: type=gha` / `cache-to: type=gha,mode=max` for Docker builds. Use a matrix with `fail-fast: false` for OS and runtime versions, and set `timeout-minutes` on every job.

   **Check:** A second run on an unchanged lockfile reports a cache hit, and wall-clock time is recorded before and after.

6. **Authenticate to Google Cloud without keys.** Create a Workload Identity pool and an OIDC provider restricted by an attribute condition to your repository, then use `google-github-actions/auth` with `id-token: write`. Setup commands are in [security hardening](references/security-hardening.md).

   **Check:** No `GCP_SA_KEY`-style secret remains, and the auth step logs the expected principal.

7. **Deploy through protected environments.** Put deploy jobs behind `environment: production` with required reviewers and a deployment branch rule for `main`. Share deploy logic as a reusable workflow (`on: workflow_call`) called with explicit inputs. The full Cloud Run pipeline is in [workflow templates](references/workflow-templates.md).

   **Check:** A deploy job pauses for approval, and the environment's URL points at the deployed revision.

8. **Publish evidence.** Upload test reports and coverage with `actions/upload-artifact` under `if: ${{ !cancelled() }}` and a unique name per matrix leg; write a short Markdown summary to `$GITHUB_STEP_SUMMARY`.

   **Check:** A failing test run still produces its report artifact and summary.

9. **Lint and security-check the workflows.** Run `actionlint` and `zizmor .` locally or in CI; fix every injection, permission and pinning finding.

   **Check:** Both tools exit 0, or each remaining finding is documented with a reason.

## Patterns

### Reference CI workflow

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
  merge_group:

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  test:
    runs-on: ${{ matrix.os }}
    timeout-minutes: 15
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
        node: [22, 24]
    steps:
      - uses: actions/checkout@v4            # pin: actions/checkout@<sha> # vX.Y.Z
        with:
          persist-credentials: false
      - uses: actions/setup-node@v4          # pin to SHA
        with:
          node-version: ${{ matrix.node }}
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test                        # configure the runner to write JUnit XML to reports/
      - uses: actions/upload-artifact@v4     # pin to SHA
        if: ${{ !cancelled() }}
        with:
          name: test-reports-${{ matrix.os }}-node${{ matrix.node }}
          path: reports/
          retention-days: 7
```

### Trigger risk

| Trigger | Runs with | Safe for untrusted PR code? |
| :--- | :--- | :--- |
| `pull_request` | Read-only token, no secrets for forks | Yes: the default for building and testing PRs |
| `pull_request_target` | Base-repo context, secrets, write token | Only if it never checks out or executes PR code |
| `workflow_run` | Privileged context after another workflow | Only if downloaded artifacts are treated as untrusted data |
| `issue_comment` | Privileged context, any commenter can trigger | Check the commenter's permission before acting |

### Untrusted input never goes into `run:` directly

```yaml
- name: Validate PR title
  env:
    TITLE: ${{ github.event.pull_request.title }}   # passed as data, not spliced into the script
  run: |
    case "$TITLE" in feat*|fix*|docs*|chore*) echo "ok" ;; *) echo "bad title"; exit 1 ;; esac
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `uses: some/action@v1` or `@main` | Full commit SHA plus Dependabot | Tags are mutable; a compromised tag runs in your pipeline with your secrets |
| `${{ github.event.* }}` inside `run:` | Pass through `env:` and quote the variable | Titles, branch names and bodies are attacker-controlled: script injection |
| `pull_request_target` with checkout of the PR head | `pull_request`, or split into an unprivileged build and a privileged step that never runs PR code | Classic pwn request: fork code runs with your secrets |
| Service-account JSON key in secrets | Workload Identity Federation | Long-lived keys leak through logs, forks and ex-employees |
| `permissions: write-all` or relying on defaults | Read-only top level, per-job additions | Limits what a compromised step can do |
| `cancel-in-progress: true` on deploy workflows | Cancel only PR runs | A cancelled deploy can leave a half-migrated environment |
| Caching `node_modules` keyed on branch | Cache the package manager store keyed on the lockfile hash | Stale or poisoned caches cause "works on main only" failures |
| `continue-on-error: true` to get green | Fix or quarantine the flaky test with an issue link | Hides real failures and erodes trust in CI |

## Verification checklist

- [ ] Top-level `permissions: contents: read`; elevated scopes only on the jobs that need them.
- [ ] Every third-party action pinned to a full SHA with a version comment; Dependabot configured for `github-actions`.
- [ ] No untrusted `${{ }}` expressions inside `run:`; no `pull_request_target` or `workflow_run` executing PR code.
- [ ] Google Cloud access via Workload Identity Federation with a repository-scoped attribute condition; no key secrets.
- [ ] Deploys behind a protected environment with required reviewers; deploy runs are never auto-cancelled.
- [ ] Caches hit on unchanged lockfiles; every job has `timeout-minutes`.
- [ ] Test reports upload even on failure; `actionlint` and `zizmor` pass.

## Related

- Agents: `cloud-devops-engineer` (pipelines and deploy targets), `security-guard` (workflow and supply-chain review), `build-error-resolver` (red builds).
- Workflows: `/build-fix`, `/pr-ready`, `/security-scan`, `/verify`.
- Knowledge: `docker-containers`, `terraform-iac`, `kubernetes-gke`, `git-workflow`, `cloud-devops`, `credential-sanitizer`.
