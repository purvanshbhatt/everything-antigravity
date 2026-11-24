---
name: release-management
disable-model-invocation: true
description: >-
  Cuts a software release: confirms the commit is green, picks the semantic
  version from the actual changes, updates the changelog and version files,
  dry-runs the package, writes release notes, and tags, pushes and publishes
  only after explicit confirmation, with a rollout and rollback plan.
  Use when the user says "cut a release", "bump the version", "write the
  changelog", "tag v2.0" or "publish to npm/PyPI". Invoke with /release-management.
---

# Release Management

Ship a version users can trust: correctly numbered, honestly described,
reproducible from a tag and reversible. Every outward-facing step (push, tag,
publish, announce) waits for an explicit yes from the user.

## When to use

- Cutting a library, CLI, app or service release, including pre-releases (`1.4.0-rc.1`).
- Writing or repairing a changelog and release notes from history.
- Planning a staged rollout and rollback for a risky deploy.

## When not to use

- Preparing one PR for review: use `/pr-ready`.
- Store submissions: `app-store-release` (mobile), `game-publishing` (games), `ide-extensions` (editor marketplaces).
- Designing the CI pipeline itself: use `ci-cd-github-actions`.
- Upgrading your own dependencies: use `/dependency-upgrades`.

## Workflow

1. **Establish the baseline.**

   ```bash
   git fetch --tags origin
   git status --short                   # must be empty
   git describe --tags --abbrev=0       # last release tag
   git log --oneline <last-tag>..HEAD   # what is shipping
   ```

   **Check:** Clean tree, local branch equals `origin/<branch>`, and the change list is non-empty.

2. **Gate on quality.** Run tests, lint, type-check and build (`/verify` has per-ecosystem commands) and confirm CI is green on the exact commit (`gh run list --branch main --limit 5`).

   **Check:** Every gate passes on the commit you will tag.

3. **Choose the version.** SemVer: breaking change → major, backward-compatible feature → minor, fixes only → patch. In `0.x`, treat minor as breaking. With Conventional Commits, `feat!:` or a `BREAKING CHANGE:` footer means major. Verify against the real public surface (exported types, CLI flags, HTTP schemas, config keys); commit messages miss things.

   **Check:** The release-plan artifact states the version and a one-line reason ("adds `--json`, nothing removed → minor").

4. **Update the changelog.** Keep a Changelog sections: Added, Changed, Deprecated, Removed, Fixed, Security. Write user impact, not commit subjects; link PRs; give every breaking change a migration snippet. If the repo already uses Changesets (`npx changeset version`), release-please or semantic-release, drive the release through that tool instead of hand-editing, and never mix tools.

   **Check:** `CHANGELOG.md` has a dated section and every user-visible commit maps to an entry.

5. **Bump version files.** `grep_search` for the old version across `package.json`, `pyproject.toml`, `Cargo.toml`, Gradle files, `Chart.yaml`, constants and docs. Prefer ecosystem commands: `npm version 1.4.0 --no-git-tag-version`, `poetry version minor`, `cargo set-version` (cargo-edit); check `--help` for your tool's current syntax.

   **Check:** The old version string now appears only in historical changelog entries.

6. **Dry-run the artifacts.**

   ```bash
   npm pack --dry-run                      # file list that would be published
   python -m build && twine check dist/*   # Python
   cargo publish --dry-run                 # Rust
   ```

   **Check:** The package has built code, LICENSE and README, and no secrets, fixtures or `.env` files.

7. **Commit, tag, push (confirm first).** Show the diff, tag name and remote, and wait for an explicit yes.

   ```bash
   git commit -am "chore(release): v1.4.0"
   git tag -a v1.4.0 -m "v1.4.0"          # -s instead of -a if tags must be signed
   git push origin main
   git push origin v1.4.0
   ```

   **Check:** `git ls-remote --tags origin v1.4.0` shows the tag on the release commit. Never move or delete a published tag.

8. **Publish and announce (confirm first).** Publishing is effectively irreversible. Prefer the project's CI release workflow (OIDC trusted publishing, provenance, no local tokens); otherwise run `npm publish`, `twine upload dist/*` or `cargo publish` after an explicit yes. Create the release page, as a draft when the user wants to review:

   ```bash
   gh release create v1.4.0 --title "v1.4.0" --notes-file notes.md --verify-tag --draft
   ```

   Add `--prerelease` for rc and beta builds.

   **Check:** The registry lists the version and a clean install in a temp directory works.

9. **Roll out and watch.** For services: canary or percentage rollout behind flags, metric gates, a named owner and a watch window. Record the plan below in the release artifact before starting.

   **Check:** Dashboards, owner, watch window and rollback trigger are written down.

## Rollout and rollback

| Artifact | Roll forward | Roll back |
| :--- | :--- | :--- |
| Service | Canary 1-5 % → 25 % → 100 % with metric gates | Redeploy the previous image or revision; turn the flag off |
| npm | Publish `x.y.(z+1)` | `npm deprecate pkg@1.4.0 "<reason>, use 1.4.1"`; unpublish is restricted by registry policy |
| PyPI | New patch release | Yank the release in project settings (exact `==` pins still resolve) |
| crates.io | New patch release | `cargo yank <crate>@1.4.0` |
| Mobile app | Staged rollout percentage | Halt the rollout and ship a fix; stores cannot downgrade users |
| Schema change | Expand/contract over two releases | Possible only before the contract step; see `database-migrations` |

Write the rollback trigger as a threshold ("5xx above 1 % for 10 min"), not a feeling.

## Release notes template

```markdown
## v1.4.0 (2026-11-22)
**Highlights:** <1-3 user-facing outcomes>
### Breaking changes
- <what changed>; migrate with: <snippet or link>
### Added / Changed / Fixed / Security
- <user-visible change> (#123)
**Upgrade:** `npm i pkg@1.4.0` · **Diff:** v1.3.2...v1.4.0
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Tag before CI is green on that commit | Gate on the exact commit, then tag | A tag promises the code works |
| Paste raw commit subjects as notes | Group by user impact with migration steps | Users read notes to decide whether to upgrade |
| Ship a breaking change in a minor | Major bump, or deprecate first and remove later | Caret and tilde ranges auto-install minors and patches |
| Re-tag or force-push a released tag | Release a new patch version | Mirrors, caches and lockfiles keep the old hash |
| Publish from a laptop with a long-lived token | Publish from CI with trusted publishing where supported | Fewer leaked tokens, verifiable provenance |
| Invent the rollback during the outage | Write trigger, owner and command before rollout | Decisions under pressure are slower and worse |

## Verification checklist

- [ ] Gates are green on the tagged commit; the version choice is justified.
- [ ] Changelog and notes cover every user-visible change and migration.
- [ ] Package dry-run inspected: nothing secret, nothing missing.
- [ ] Push, tag, publish and announcement each had explicit user confirmation.
- [ ] A clean install of the published version works.
- [ ] Rollout gates, watch window, rollback trigger and owner are recorded.

## Related

- Workflows: `/verify`, `/pr-ready`, `/update-docs`, `/dependency-upgrades`, `/issue-triage`.
- Knowledge: `git-workflow`, `ci-cd-github-actions`, `feature-flags`, `database-migrations`, `app-store-release`, `open-source-maintenance`, `supply-chain-security`.
- Agents: `doc-updater`, `sre-engineer`.
