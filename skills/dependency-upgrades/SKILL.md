---
name: dependency-upgrades
disable-model-invocation: true
description: >-
  Upgrades dependencies safely: audits outdated and vulnerable
  packages, batches them by risk (security fixes, patch and minor, then each
  major alone), reads changelogs and migration guides, applies codemods,
  verifies every batch with the project's gates, and sets up Renovate or
  Dependabot grouping. Use when asked to update dependencies, fix audit
  warnings, bump a framework, or clear a backlog of upgrade PRs. Invoke with
  /dependency-upgrades.
---

# Dependency Upgrades

Upgrade in small, verified batches so every failure points at one cause.
Security fixes go first, majors go one at a time with their migration guide,
and nothing is pushed or merged without the user's yes.

## When to use

- "Update our dependencies", "fix npm audit", "bump to the latest version of X".
- A security advisory affects a dependency.
- A pile of Renovate or Dependabot pull requests needs clearing.
- Before starting major feature work on a stale codebase.

## When not to use

- A framework migration with architectural changes (React Router to a new major, AngularJS to Angular): use `/framework-migration`.
- Supply-chain policy (SBOMs, signing, pinning strategy): use `supply-chain-security`.
- A broken build after someone else's upgrade: use `/build-fix`.

## Workflow

1. **Start clean and green.** Create a branch, confirm a clean tree, and run the full gates once (`/verify`) to record the baseline.

   ```bash
   git switch -c chore/deps-2026-11
   git status --short
   ```

   **Check:** The tree is clean and tests pass before any change; pre-existing failures are recorded, not blamed on upgrades.

2. **Inventory outdated and vulnerable packages.**

   | Ecosystem | Outdated | Vulnerable |
   | :--- | :--- | :--- |
   | npm / pnpm | `npm outdated`, `pnpm outdated`, `npx npm-check-updates` | `npm audit --omit=dev`, `pnpm audit` |
   | Python | `pip list --outdated`, `poetry show --outdated` | `pip-audit` |
   | Go | `go list -m -u all` | `govulncheck ./...` |
   | Rust | `cargo update --dry-run`, `cargo outdated` (plugin) | `cargo audit` (plugin) |
   | Java | `mvn versions:display-dependency-updates`, Gradle versions plugin `dependencyUpdates` | OWASP dependency-check or osv-scanner |
   | .NET | `dotnet list package --outdated` | `dotnet list package --vulnerable --include-transitive` |
   | Ruby / PHP | `bundle outdated`, `composer outdated --direct` | `bundle-audit`, `composer audit` |
   | Any | | `osv-scanner scan source -r .` (v2 syntax; v1 used `osv-scanner -r .`) |

   **Check:** A table artifact lists each package with current, wanted and latest versions, update type, runtime or dev, and any advisory IDs.

3. **Batch by risk.**

   | Batch | Contents | Rule |
   | :--- | :--- | :--- |
   | 0 | Security fixes for reachable, high or critical advisories | First and alone |
   | 1 | Dev tooling patch and minor (linters, test runners, types) | One batch |
   | 2 | Runtime patch and minor | One batch; split if it fails |
   | 3..n | Each major version | One package (or tightly coupled family) per batch, framework before its plugins |

   Show the plan to the user and confirm which majors are in scope.

   **Check:** The user approved the batch plan.

4. **Read before bumping majors.** For each major, read the changelog and migration guide (`gh release view <tag> --repo <owner>/<repo>`, or `CHANGELOG.md`), note breaking changes, required runtime versions and removed APIs, and `grep_search` the codebase for each affected API.

   **Check:** Every breaking change is mapped to the files it touches, or marked not applicable.

5. **Apply one batch.**

   ```bash
   npm install <pkg>@<version>            # or: npm update  (within ranges)
   pnpm update <pkg>@<version>
   uv lock --upgrade-package <pkg>        # or: poetry update <pkg>
   go get example.com/mod@v1.2.3 && go mod tidy
   cargo update -p <crate>                # within ranges; cargo upgrade (cargo-edit) for majors
   dotnet add package <Pkg> --version <x.y.z>
   ```

   Run the official codemod or migration tool when one exists (framework codemods, OpenRewrite recipes, `go fix ./...`, `cargo fix --edition`, `ruff check --select UP --fix`), then review its diff like hand-written code.

   **Check:** Only the intended manifest and lockfile entries changed (`git diff --stat`), plus codemod edits.

6. **Verify the batch.** Type-check, lint, unit and integration tests, build, and an end-to-end smoke test of the main user path. Scan test output for new deprecation warnings, and check for duplicate copies of core libraries (`npm ls <pkg>`).

   **Check:** All gates match or beat the baseline; new deprecations are listed in the report.

7. **Commit per batch.** One commit per batch with the packages, versions and notable changes in the message, so any batch can be reverted alone. If a batch fails and the fix is not obvious, revert it, split it, or pin the package with a recorded reason, then continue.

   **Check:** `git log --oneline` shows one commit per batch, each green on its own.

8. **Report and hand off.** Produce the upgrade report below. Ask before pushing or opening a pull request (`/pr-ready`).

   **Check:** The user has the report and decided on push and PR.

9. **Automate the next round.** Add or tune Renovate or Dependabot with grouping and a minimum release age (examples below).

   **Check:** The bot config validates and opens grouped pull requests on schedule.

## Output format

```markdown
## Dependency upgrade report
Branch: chore/deps-2026-11 · Baseline: tests 412 passed · Final: tests 412 passed

| Batch | Packages | From → To | Result | Notes |
| :--- | :--- | :--- | :--- | :--- |
| 0 | lodash | 4.17.20 → 4.17.21 | pass | fixes advisory <id> |
| 3 | vite | 5.4.x → 6.x | pass | codemod applied; config `server.fs` updated |

Skipped / pinned: <pkg@version, reason, follow-up issue>
New deprecation warnings: <list>
Remaining advisories: <id, package, why not fixed>
```

## Patterns

### Renovate (`renovate.json`)

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "minimumReleaseAge": "3 days",
  "packageRules": [
    { "matchUpdateTypes": ["minor", "patch"], "groupName": "non-major dependencies" },
    { "matchDepTypes": ["devDependencies"], "matchUpdateTypes": ["minor", "patch"], "groupName": "dev tooling" }
  ]
}
```

### Dependabot (`.github/dependabot.yml`)

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      minor-and-patch:
        update-types: ["minor", "patch"]
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Upgrade everything to latest in one commit | Risk-ordered batches, one commit each | A failure cannot be traced to a package |
| Delete the lockfile and reinstall | Targeted updates | Every transitive version changes at once |
| `npm audit fix --force` | Read the advisory; apply the specific fix | `--force` can install breaking majors silently |
| Skip the changelog for majors | Read the migration guide and map affected code | Behaviour changes pass tests but break production |
| Adopt releases published hours ago | Minimum release age of a few days | Compromised or broken releases are usually caught quickly |
| Disable failing tests to land an upgrade | Fix, revert or pin with a reason | Hidden breakage ships to users |

## Verification checklist

- [ ] Baseline gates recorded before the first change.
- [ ] Batch plan approved; security fixes landed first.
- [ ] Each major had its changelog read and affected code mapped.
- [ ] Every batch is a separate commit that passes all gates.
- [ ] Report lists skipped, pinned and remaining items with reasons.
- [ ] Nothing was pushed or merged without the user's yes.

## Related

- Agents: `build-error-resolver`, `code-reviewer`, `security-guard`, `migration-specialist`.
- Workflows: `/verify`, `/build-fix`, `/framework-migration`, `/pr-ready`, `/security-scan`.
- Knowledge: `supply-chain-security`, `git-workflow`, `ci-cd-github-actions`, `monorepo-tooling`.
