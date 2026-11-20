---
name: pr-ready
description: >-
  Prepares a branch for a pull request: runs full verification, self-reviews
  the diff, cleans up commits without force-pushing shared branches, writes the
  PR title and body (summary, why, changes, testing evidence, risk and
  rollback, screenshots for UI), adds a changelog entry, and opens the PR with
  gh only when asked. Use when the user says "open a PR", "make this
  mergeable" or "ready for review". Invoke with /pr-ready.
---

# PR Ready

A reviewer should be able to approve from the PR page alone: green gates, a
diff that tells one story, and a description that answers "what, why, how do
I know it works, and how do I undo it". This skill gets the branch there
without rewriting shared history or publishing anything the user did not ask for.

## When to use

- The user says "open a PR", "prep this for review", "write the PR description", "is this mergeable".
- The last step of `/feature-dev`, or after `/deep-work` finishes.
- Before requesting review on a branch that grew over several sessions.

## When not to use

- Reviewing someone else's PR: use `/code-review`.
- Mid-task save point: use `/checkpoint`.
- The build or tests are broken and the cause is unclear: use `/build-fix` or `/root-cause` first.
- Only the docs drifted: use `/update-docs`.

## Workflow

1. **Establish base and scope.**

   ```bash
   git fetch origin
   git symbolic-ref --short refs/remotes/origin/HEAD      # default branch, e.g. origin/main
   git merge-base HEAD origin/main
   git log --oneline origin/main..HEAD
   git diff --stat origin/main...HEAD
   git status --short
   ```

   Uncommitted changes: ask whether they belong in this PR before going further.

   **Check:** You can state the base branch, the commit count, the files changed and the one-sentence purpose.

2. **Run `/verify full`** (build, type-check, lint, the whole test suite, coverage if configured). A red gate stops the workflow: fix it, or report it and stop. Record each command and its result for the PR body.

   **Check:** Every gate is green, with commands and counts written down.

3. **Self-review the diff.** Run `/code-review` on `origin/main...HEAD` and fix every BLOCKER and MAJOR. Then sweep for debris:

   ```bash
   git diff origin/main...HEAD | grep -nE '^\+.*(console\.log|debugger|print\(|fmt\.Println|dbg!|\.only\(|TODO|FIXME)'
   ```

   ```powershell
   git diff origin/main...HEAD | Select-String -Pattern '^\+.*(console\.log|debugger|print\(|fmt\.Println|dbg!|\.only\(|TODO|FIXME)'
   ```

   Scan every changed file for secrets with `eag shield --file <path>` (fallback `node <plugin-root>/bin/eag.js shield --file <path>`); run `/security-scan` if the change touches auth, input parsing or dependencies.

   **Check:** No BLOCKER or MAJOR remains; every debris hit is removed or justified; `shield` is clean.

4. **Clean up commits, safely.** Target: each commit builds and has a Conventional Commit message. If history is already clean, leave it. Otherwise:
   - Fold fixups non-interactively: `git -c sequence.editor=: rebase -i --autosquash origin/main` (works in bash and PowerShell; needs commits made with `git commit --fixup <sha>`).
   - Or squash everything into one commit: `git reset --soft origin/main` then `git commit -m "<type(scope): subject>"`. Ask first; it rewrites local history.
   - If the branch was already pushed, rewriting needs `git push --force-with-lease`. Ask for explicit consent, and never do it on `main`, `master`, `develop`, `release/*`, or any branch others push to.
   - If the branch is behind the base, rebase (private branch) or merge (shared branch), then re-run `/verify full`.

   **Check:** `git log --oneline origin/main..HEAD` reads as a clean story, gates are still green, and no shared branch was force-pushed.

5. **Write the title and body** with `write_to_file` to a scratch file outside the repository, using [the PR template](references/pr-template.md). Title: Conventional Commit style, 72 characters or fewer. Body: summary, why (link the issue), changes, testing evidence (commands with results), risk and rollback, screenshots or recordings for any UI change (delegate capture to the `e2e-runner` subagent if a browser flow is involved). Fill the repository's own `.github/pull_request_template.md` instead if it exists.

   **Check:** Every claim in "Testing" has a command and a result; "Rollback" is a concrete action.

6. **Add the changelog entry** in the project's style:
   - `CHANGELOG.md` in Keep a Changelog format: add a line under `## [Unreleased]` in the right group (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`).
   - Changesets (`.changeset/` exists): add `.changeset/<short-slug>.md` with frontmatter `"<package-name>": patch|minor|major` and a one-line summary.
   - release-please, semantic-release or similar generate the changelog from commits: do not edit `CHANGELOG.md`; make sure the commit messages are right instead.

   **Check:** The entry is user-facing (what changed for them), not an implementation note.

7. **Open the PR only if the user asks.** Pushing and opening a PR publish work; confirm first.

   ```bash
   git push -u origin HEAD
   gh pr create --base main --title "<title>" --body-file <scratch>/pr-body.md --draft
   ```

   Use `--draft` unless the user wants immediate review. Otherwise hand over the title and body for the user to paste.

   **Check:** You returned the PR URL, or the title and body, plus the gate summary.

## Patterns

### Commit and title conventions

| Change | Type | Example title |
| :--- | :--- | :--- |
| New user-visible behaviour | `feat` | `feat(billing): prorate plan changes mid-cycle` |
| Bug fix | `fix` | `fix(auth): reject expired refresh tokens` |
| Internal restructure, no behaviour change | `refactor` | `refactor(orders): extract pricing service` |
| Breaking change | `feat!` or `fix!` plus a `BREAKING CHANGE:` footer | `feat(api)!: remove v1 search endpoint` |

### PR size

| Diff size | Action |
| :--- | :--- |
| Under 400 changed lines | Ready as is |
| 400-1000 lines | Explain the reading order in the body |
| Over 1000 lines | Propose splitting (mechanical changes first, behaviour second) before opening |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Open the PR with red gates "to get early feedback" | Open a draft and say which gate is red and why | Reviewers waste time on a moving target |
| `git push --force` | `--force-with-lease`, only with consent, never on shared branches | Plain force silently deletes teammates' commits |
| Write "tested locally" | Paste the commands and their pass counts | Unverifiable claims get re-asked in review |
| Describe the code line by line | Explain intent, trade-offs and the reading order | The diff already shows the lines |
| Edit a generated CHANGELOG by hand | Fix the commit messages that feed it | Manual edits are overwritten or duplicated at release |
| Run `gh pr create` because the work looks finished | Ask first | Opening a PR notifies people and publishes the branch |

## Verification checklist

- [ ] `/verify full` is green and recorded in the body.
- [ ] `/code-review` found no remaining BLOCKER or MAJOR; debris and secrets sweeps are clean.
- [ ] Commits are clean and Conventional; no shared branch was force-pushed; any rewrite was approved.
- [ ] The body covers summary, why, changes, testing evidence, risk and rollback, and UI screenshots where relevant.
- [ ] A changelog entry exists in the project's format, or is correctly left to tooling.
- [ ] Push and `gh pr create` happened only on the user's request.

## Related

- Workflows: `/verify`, `/code-review`, `/security-scan`, `/update-docs`, `/feature-dev`, `/checkpoint`, `/e2e`.
- Knowledge: `git-workflow`, `ci-cd-github-actions`, `documentation-writing`.
- Agents: `code-reviewer`, `e2e-runner` (UI screenshots), `doc-updater`.
