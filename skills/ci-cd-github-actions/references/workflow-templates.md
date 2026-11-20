# Workflow Templates

Companion to the `ci-cd-github-actions` skill. Action references use major tags
so the examples stay readable. Before committing, look up each action's latest
release and replace the tag with its full commit SHA plus a version comment:

```bash
gh release view --repo google-github-actions/auth --json tagName --jq .tagName
gh api repos/google-github-actions/auth/commits/TAG --jq .sha
```

## Build and deploy to Cloud Run (keyless)

Repository variables (not secrets, they are not sensitive): `WIF_PROVIDER`
(full provider resource name) and `DEPLOY_SA` (deployer service account email).

```yaml
# .github/workflows/deploy.yml
name: deploy
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: deploy-production
  cancel-in-progress: false          # never cancel a deploy mid-flight

env:
  REGION: us-central1
  IMAGE: us-docker.pkg.dev/my-project/app/web

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read
      id-token: write
    outputs:
      digest: ${{ steps.push.outputs.digest }}
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ vars.WIF_PROVIDER }}
          service_account: ${{ vars.DEPLOY_SA }}
      - uses: google-github-actions/setup-gcloud@v2
      - run: gcloud auth configure-docker us-docker.pkg.dev --quiet
      - uses: docker/setup-buildx-action@v3
      - id: push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ env.IMAGE }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          provenance: mode=max
          sbom: true

  deploy:
    needs: build
    runs-on: ubuntu-latest
    timeout-minutes: 15
    environment:
      name: production               # required reviewers + main-only branch rule
      url: ${{ steps.deploy.outputs.url }}
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ vars.WIF_PROVIDER }}
          service_account: ${{ vars.DEPLOY_SA }}
      - id: deploy
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: web
          region: ${{ env.REGION }}
          image: ${{ env.IMAGE }}@${{ needs.build.outputs.digest }}
      - name: Smoke test
        env:
          URL: ${{ steps.deploy.outputs.url }}
        run: curl --fail --silent --show-error "$URL/healthz"
      - name: Summary
        env:
          URL: ${{ steps.deploy.outputs.url }}
        run: echo "Deployed \`web\` at ${GITHUB_SHA::7} to $URL" >> "$GITHUB_STEP_SUMMARY"
```

Deploying by digest guarantees the reviewed build is what runs. The deployer
service account needs `roles/run.developer`, `roles/iam.serviceAccountUser` on
the Cloud Run runtime service account, and `roles/artifactregistry.writer` on
the repository, nothing broader.

## Reusable deploy workflow

```yaml
# .github/workflows/deploy-cloudrun.yml
name: deploy-cloudrun
on:
  workflow_call:
    inputs:
      environment: { type: string, required: true }
      service:     { type: string, required: true }
      image:       { type: string, required: true }
      region:      { type: string, default: us-central1 }

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    environment: ${{ inputs.environment }}
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ vars.WIF_PROVIDER }}
          service_account: ${{ vars.DEPLOY_SA }}
      - uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: ${{ inputs.service }}
          region: ${{ inputs.region }}
          image: ${{ inputs.image }}
```

Caller:

```yaml
jobs:
  staging:
    uses: ./.github/workflows/deploy-cloudrun.yml   # cross-repo: org/platform/.github/workflows/deploy-cloudrun.yml@<sha>
    permissions:
      contents: read
      id-token: write
    with:
      environment: staging
      service: web
      image: us-docker.pkg.dev/my-project/app/web@${{ needs.build.outputs.digest }}
    needs: build
```

The caller grants permissions; a called workflow can only narrow them. Pass
secrets explicitly with `secrets:` rather than `secrets: inherit` when the
called workflow lives in another repository.

## Python test matrix

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    strategy:
      fail-fast: false
      matrix:
        python: ["3.12", "3.13"]
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python }}
          cache: pip
          cache-dependency-path: requirements*.txt
      - run: pip install -r requirements-dev.txt
      - run: pytest --junitxml=reports/junit.xml
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: junit-py${{ matrix.python }}
          path: reports/
```

## Generic cache

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cache/pre-commit
    key: pre-commit-${{ runner.os }}-${{ hashFiles('.pre-commit-config.yaml') }}
    restore-keys: pre-commit-${{ runner.os }}-
```

Key on the file that defines the cache contents. `restore-keys` gives a partial
hit; never key on the branch name alone.

## Dependabot for actions

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    groups:
      actions:
        patterns: ["*"]
```

Dependabot updates SHA pins and their version comments together.

## Debugging runs

| Goal | Command |
| :--- | :--- |
| Recent runs | `gh run list --limit 20` |
| Only failing step logs | `gh run view RUN_ID --log-failed` |
| Follow a run live | `gh run watch RUN_ID` |
| Re-run failed jobs with debug logging (non-production only without consent) | `gh run rerun RUN_ID --failed --debug` |
| Manually trigger on a branch (needs `workflow_dispatch`) | `gh workflow run ci.yml --ref my-branch` |

Step summaries from PowerShell steps:
`Add-Content -Path $env:GITHUB_STEP_SUMMARY -Value "### Result: passed"`.
