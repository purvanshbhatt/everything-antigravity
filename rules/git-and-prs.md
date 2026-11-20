---
trigger: model_decision
description: Apply when committing, staging, branching, merging, rebasing, cherry-picking, resolving merge conflicts, writing commit messages, pushing, or preparing, updating or describing a pull request.
---

# Git and pull requests

## Before acting

- Run `git status` and check the current branch first. Never commit directly to `main`/`master` or a release branch unless the repository's convention says so.
- Commit, push, open PRs or post PR comments only when the user asked for it.
- Name branches `<type>/<short-description>` (`feat/session-export`, `fix/login-redirect`) unless the project uses another scheme.

## Commits

- Use Conventional Commits: `type(scope): imperative summary` (types: feat, fix, docs, refactor, perf, test, build, ci, chore, revert). Summary at most 72 characters, no trailing period.
- The body explains why, not what; reference issues (`Fixes #123`); mark breaking changes with `!` and a `BREAKING CHANGE:` footer.
- One logical change per commit. Do not mix formatting or refactors with behaviour changes.
- Stage explicit paths (`git add src/foo.ts tests/foo.test.ts`), then review `git diff --staged` before committing. Avoid blind `git add -A`.
- Never commit secrets, `.env` files, credentials, build output, large binaries or unrelated files. Check `.gitignore` when new files appear.
- Never bypass hooks with `--no-verify` or skip signing. If a hook fails, fix the cause.
- Agents cannot drive editors: always pass `-m`, and never use `git rebase -i`, `git add -i` or `git add -p`. On PowerShell, pass multi-line messages with a single-quoted here-string.

## Destructive operations (explicit user confirmation each time)

- `git push --force` (use `--force-with-lease` if approved), `reset --hard`, `clean -fd`, `checkout -- .` / `restore .`, `branch -D`, `stash drop` / `clear`, history rewrites (`filter-repo`, amending or rebasing pushed commits).
- Never rewrite history on shared branches. Rebase only your own unpublished or feature branches.
- After a push, prefer a new commit to `--amend`.

## Conflicts

- Read both sides and the merge base before resolving; never resolve by blindly taking `ours` or `theirs`.
- Re-run the tests touching the conflicted files after resolving, and run `git diff --check` to catch leftover conflict markers and whitespace errors.

## Pull requests

- Keep PRs small and focused (ideally under about 400 changed lines). Split refactors from features.
- Title follows Conventional Commits. The description covers: what and why, how it was tested (commands and results), risks and rollback, screenshots for UI changes, and linked issues.
- Before requesting review: self-review the full diff, make sure CI-equivalent checks pass locally (`/verify`), tests cover new behaviour, docs and changelog are updated, and no debug code or unrelated changes remain.
- Open work in progress as a draft PR.
- Address review comments with new commits; resolve a thread only after the fix is pushed or the reviewer agrees.

## Repository hygiene

- Respect `.gitattributes` line endings; do not commit mass line-ending or whitespace churn.
- Do not change git config, remotes, hooks or branch protection settings unless asked.
