---
name: open-source-maintenance
disable-model-invocation: true
description: >-
  Sets up and runs an open-source project: license choice and dependency
  license checks, community health files, issue forms and PR templates,
  CONTRIBUTING, CODEOWNERS and DCO/CLA flow, governance and maintainer roles,
  SECURITY.md with private vulnerability reporting, and sustainable triage
  habits. Use when open-sourcing a repo, auditing a project's community files,
  or when maintainers are overwhelmed by issues and PRs.
---

# Open Source Maintenance

A healthy project makes the right path obvious: how to use it, how to report a
bug, how to contribute, how to report a vulnerability, and who decides. Most of
that is a dozen small files plus habits that protect maintainer time.

## When to use

- Publishing an internal project as open source, or adopting an abandoned one.
- Auditing a repo's license, community files and contribution flow.
- Contributors keep filing incomplete issues, unwanted PRs or public security reports.
- Defining who can merge, release and make decisions.

## When not to use

- Triage of a specific backlog: use `/issue-triage`.
- Cutting a release: use `/release-management`.
- Supply-chain hardening (SBOM, signing, pinning): use `supply-chain-security`.
- Growing a community around the project: use `community-management` and `developer-relations`.

## Workflow

1. **Audit what exists.** List files and GitHub's community profile score:

   ```bash
   gh api repos/{owner}/{repo}/community/profile --jq '{health: .health_percentage, files: .files | keys}'
   ```

   `gh api` fills `{owner}` and `{repo}` from the current repository. Also check `.github/` for templates, workflows and `CODEOWNERS`.

   **Check:** A gap list exists against the file table below.

2. **License the project (not legal advice).** Without a license, code is all-rights-reserved, not open source. Pick from the table, add `LICENSE` at the root, set the SPDX id in the manifest (`"license": "MIT"`, `license = "Apache-2.0"`), and check dependency licenses for conflicts:

   ```bash
   npx license-checker --summary          # Node
   pip-licenses                           # Python (pip install pip-licenses)
   cargo deny check licenses              # Rust (cargo-deny)
   ```

   **Check:** Manifest SPDX id matches `LICENSE`; no strong-copyleft dependency sits in a permissively licensed distributable without a decision recorded.

3. **Write the contribution path.** `CONTRIBUTING.md`: dev setup (one command), test commands, commit style, "open an issue before large PRs", and the sign-off model. DCO: contributors run `git commit -s` and a check enforces the `Signed-off-by` line. CLA: a bot collects signatures; heavier for contributors, needed when relicensing rights matter. Add `.github/pull_request_template.md` with a checklist and `CODEOWNERS` so reviews route automatically.

   **Check:** A first-time contributor can go from clone to passing tests using only `CONTRIBUTING.md`.

4. **Add issue forms.** Structured forms beat free text. Example `.github/ISSUE_TEMPLATE/bug.yml`:

   ```yaml
   name: Bug report
   description: Report a reproducible problem
   labels: ["bug", "needs-triage"]
   body:
     - type: input
       id: version
       attributes:
         label: Version
       validations:
         required: true
     - type: textarea
       id: repro
       attributes:
         label: Steps to reproduce
         description: Minimal steps, expected and actual result
       validations:
         required: true
   ```

   And `.github/ISSUE_TEMPLATE/config.yml` to route questions away from issues:

   ```yaml
   blank_issues_enabled: false
   contact_links:
     - name: Questions and ideas
       url: https://github.com/OWNER/REPO/discussions
       about: Ask usage questions here
   ```

   **Check:** "New issue" offers the forms and links; no blank issue option.

5. **Publish a security policy.** `SECURITY.md` lists supported versions, how to report privately (enable GitHub private vulnerability reporting in repository settings), expected response time, and disclosure practice. Fix in a private fork or advisory, publish a GitHub Security Advisory, request a CVE when appropriate, then release. Enabling repository features changes settings: confirm with the user first.

   **Check:** The Security tab shows the policy and a "Report a vulnerability" button.

6. **Define governance.** `GOVERNANCE.md`: roles (user, contributor, committer, maintainer), how decisions are made (lazy consensus, maintainer vote, BDFL), how people gain or lose commit rights, and succession if the lead disappears. Add `CODE_OF_CONDUCT.md` (for example Contributor Covenant) with a real enforcement contact.

   **Check:** Someone outside the team can tell who can merge, who can release, and how to become a maintainer.

7. **Protect the branch and automate chores.** Rulesets or branch protection require CI and one review on `main`; Dependabot or Renovate for updates; labels such as `good first issue`, `help wanted`, `needs-triage`. Changing protection settings needs user confirmation.

   **Check:** A direct push to `main` is rejected and a PR without green CI cannot merge.

8. **Sustain the maintainers.** Fixed triage slots (for example twice a week), saved replies, a documented scope ("what we will not add"), a deprecation and end-of-life policy, and permission to close politely. Optional: `.github/FUNDING.yml`.

   **Check:** README states support expectations and links to the policies above.

## Community files

| File | Purpose |
| :--- | :--- |
| `README.md` | What, why, install, quick start, status, links |
| `LICENSE` | Legal terms; SPDX id mirrored in the manifest |
| `CONTRIBUTING.md` | Setup, tests, style, sign-off, PR expectations |
| `CODE_OF_CONDUCT.md` | Behaviour standard and enforcement contact |
| `SECURITY.md` | Supported versions, private reporting, response times |
| `GOVERNANCE.md` | Roles, decisions, commit rights, succession |
| `.github/ISSUE_TEMPLATE/*.yml` | Issue forms plus `config.yml` routing |
| `.github/pull_request_template.md` | PR checklist |
| `.github/CODEOWNERS` | Automatic review routing |

## License quick reference (verify with counsel for real decisions)

| License | Type | Notes |
| :--- | :--- | :--- |
| MIT, BSD-2/3-Clause | Permissive | Minimal conditions: keep the notice |
| Apache-2.0 | Permissive | Explicit patent grant; NOTICE file handling |
| MPL-2.0 | Weak copyleft (file level) | Modified MPL files stay open |
| GPL-3.0 | Strong copyleft | Derivatives distributed under GPL |
| AGPL-3.0 | Network copyleft | Applies to software offered over a network |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Publish without a LICENSE | Add one and the SPDX id before announcing | No license means nobody may legally reuse it |
| Let security reports land in public issues | `SECURITY.md` plus private vulnerability reporting | Public reports expose users before a fix |
| Accept large unsolicited PRs | Require an issue and design agreement first | Saves contributor effort and review time |
| Leave governance implicit | Write roles and decision rules down | Implicit power causes conflict and bus-factor risk |
| Answer every request immediately | Scheduled triage and a documented scope | Maintainer burnout ends projects |

## Verification checklist

- [ ] `LICENSE` exists and matches the manifest SPDX id; dependency licenses checked.
- [ ] CONTRIBUTING, CODE_OF_CONDUCT, SECURITY and GOVERNANCE files exist and are specific.
- [ ] Issue forms, routing `config.yml`, PR template and CODEOWNERS are in place.
- [ ] Private vulnerability reporting enabled, with user confirmation.
- [ ] `main` requires CI and review; dependency updates are automated.

## Related

- Workflows: `/issue-triage`, `/release-management`, `/security-scan`, `/update-docs`.
- Knowledge: `supply-chain-security`, `git-workflow`, `ci-cd-github-actions`, `documentation-writing`, `community-management`, `developer-relations`.
- Agents: `security-guard`, `doc-updater`, `technical-writer`.
