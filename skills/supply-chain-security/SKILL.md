---
name: supply-chain-security
disable-model-invocation: true
description: >-
  Secures the software supply chain: lockfiles and hash pinning, dependency
  review and admission rules, SBOM generation and scanning, SLSA build
  provenance, Sigstore signing and verification, CI workflow hardening and
  dependency-confusion defenses. Use when adding dependencies, hardening CI or
  releases, producing SBOMs or attestations, or responding to a compromised
  package advisory.
---

# Supply Chain Security

Know exactly what goes into each build, make the build tamper-evident, and
prove where each artifact came from. Most real incidents are a malicious or
hijacked dependency, a poisoned CI workflow or a leaked publish token.

## When to use

- Adding or upgrading dependencies, or setting policy for which ones are allowed.
- Hardening CI/CD: pinning actions, token permissions, publish pipelines.
- Producing SBOMs, provenance attestations or signed images for customers or auditors.
- A compromised-package advisory lands and you need to know if you are affected.

## When not to use

- General app vulnerability audit: use `security-audit` (it has a short supply-chain checklist).
- Image hardening and Kubernetes admission: use `container-security`.
- Routine dependency upgrades: use `/dependency-upgrades`.
- Leaked secrets in the repo: use `credential-sanitizer`.

## Workflow

1. **Inventory and lock.** Confirm every ecosystem has a committed lockfile and that CI installs in frozen mode.

   ```bash
   npm ci                                   # or: pnpm install --frozen-lockfile / yarn install --immutable
   pip install --require-hashes -r requirements.txt   # requirements produced by: pip-compile --generate-hashes
   go mod verify
   cargo build --locked
   ```

   **Check:** A clean CI run fails if the lockfile and manifest disagree.

2. **Pin what executes in CI.** Pin GitHub Actions to full commit SHAs (comment the tag), set `permissions:` to the minimum per job, avoid `pull_request_target` with checkout of untrusted code, and pin base images by digest (`FROM <image>@sha256:<digest>`). Audit workflows with `zizmor .github/workflows`.

   **Check:** `grep_search` for `uses: .*@v` and `permissions: write-all` returns nothing unexplained.

3. **Gate new dependencies.** Add `actions/dependency-review-action` on pull requests to block known-vulnerable or disallowed-license additions. Before adding a package, check maintainers, release history, install scripts, download counts versus name similarity (typosquats), and the OpenSSF Scorecard (`scorecard --repo=github.com/<org>/<repo>`).

   **Check:** The PR template or review notes record why each new direct dependency is needed.

4. **Contain install-time code.** Disable lifecycle scripts where possible (`npm ci --ignore-scripts`, then allowlist packages that truly need builds; recent pnpm versions block dependency build scripts by default, verify for yours). Delay brand-new releases with a cooling period (for example Renovate `minimumReleaseAge`).

   **Check:** You can list which dependencies run code at install time and why.

5. **Block dependency confusion.** Use scoped package names for internal packages, map scopes to the private registry, and configure the registry to never fall back to the public index for internal names (Artifact Registry remote/virtual repositories with priority, or equivalent).

   **Check:** An internal package name published publicly by an attacker would not be resolved.

6. **Generate and scan SBOMs per release.**

   ```bash
   syft scan dir:. -o cyclonedx-json > sbom.cdx.json
   grype sbom:./sbom.cdx.json --fail-on high
   trivy sbom sbom.cdx.json
   ```

   **Check:** Each release artifact has a matching SBOM stored alongside it.

7. **Attest provenance and sign.** In GitHub Actions use `actions/attest-build-provenance` (needs `id-token: write` and `attestations: write`). Sign container images keylessly with cosign. Publish npm packages with `npm publish --provenance` from CI and PyPI packages via trusted publishing. Ask the user before any publish step.

   ```bash
   gh attestation verify ./dist/app.tar.gz --owner <org>
   cosign verify <registry>/<image>@sha256:<digest> \
     --certificate-identity "https://github.com/<org>/<repo>/.github/workflows/release.yml@refs/heads/main" \
     --certificate-oidc-issuer https://token.actions.githubusercontent.com
   npm audit signatures
   ```

   **Check:** Verification succeeds for the released artifact and fails for a locally built one.

8. **Enforce at deploy.** Admit only signed images from your registry (Binary Authorization on GKE/Cloud Run, or a Kubernetes admission policy). See `container-security`.

## Reference

### SLSA v1.0 build track (verify against slsa.dev)

| Level | Requirement | Typical way to get it |
| :--- | :--- | :--- |
| Build L1 | Provenance exists | Generate provenance in CI |
| Build L2 | Hosted build platform, signed provenance | GitHub-hosted runners plus build attestations |
| Build L3 | Hardened, isolated builds; provenance unforgeable by the build | Reusable isolated workflows (for example the SLSA GitHub generator) |

### Advisory response (compromised package)

1. Identify affected versions from the advisory; search every lockfile and SBOM for them.
2. Check CI logs and build caches for installs during the exposure window.
3. If affected: pin to a safe version, rebuild from clean caches, and rotate every credential that CI or developer machines exposed during the window (see `secrets-management`).
4. Record the timeline; run `/postmortem` if anything was exposed.

### Ecosystem audit commands

| Ecosystem | Command |
| :--- | :--- |
| npm/pnpm | `npm audit --omit=dev`, `pnpm audit --prod` |
| Python | `pip-audit` |
| Go | `govulncheck ./...` |
| Rust | `cargo audit`, `cargo deny check` |
| Any | `osv-scanner` (syntax differs between v1 and v2; check `--help`) |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `uses: some/action@v3` | Pin to a full SHA with a tag comment | Tags are mutable; hijacked tags have shipped malware |
| Long-lived publish tokens in CI secrets | OIDC trusted publishing | Stolen tokens are the most common publish compromise |
| `npm install` in CI | `npm ci` with a committed lockfile | Floating resolution pulls new, unreviewed code |
| `FROM node:latest` | Digest-pinned base images, updated by a bot | Tags move; builds become unreproducible |
| Trust an SBOM without scanning it | Scan it on every release and on new advisories | An unread SBOM is compliance theatre |
| Add a package for a ten-line helper | Write the helper | Every dependency is permanent attack surface |

## Verification checklist

- [ ] Lockfiles committed; CI installs in frozen mode with hashes where supported.
- [ ] Actions pinned to SHAs, job permissions minimal, workflows audited.
- [ ] New dependencies pass dependency review and a manual sanity check.
- [ ] Internal package scopes cannot resolve from public registries.
- [ ] Each release has an SBOM, provenance attestation and signature that verify.
- [ ] Deploy-time admission rejects unsigned or unknown-origin images.

## Related

- Knowledge: `security-audit`, `container-security`, `ci-cd-github-actions`, `secrets-management`, `static-analysis`, `credential-sanitizer`.
- Workflows: `/dependency-upgrades`, `/release-management`, `/security-scan`, `/postmortem`.
- Agents: `security-guard`, `cloud-devops-engineer`.
