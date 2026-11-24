---
name: git-workflow
description: >-
  Branches, commits, rebases, conflict resolution, PR hygiene and recovery from git mistakes without losing work.
---

# Git Workflow

Keep history a reviewable record of small, working, well-described changes, and
never lose anyone's work. Agents cannot drive interactive editors, so every
procedure here runs non-interactively.

**Safety rule.** Ask the user before: any force push to a branch someone else
may use, `reset --hard`, `clean -fd`, `checkout -- .` or `restore .` that
discards changes, `branch -D`, `stash drop` or `clear`, rewriting pushed
commits, `filter-repo`, changing global Git config, or editing branch
protection. Before any history rewrite, create a backup ref
(`git branch backup/<branch>`). Never use `--no-verify` or `--no-gpg-sign`.

**No interactive editors.** Avoid bare `git rebase -i`, `git add -p`,
`git commit` without `-m`/`-F`, `git mergetool`, and `git merge --continue`
without `--no-edit`. In PowerShell, quote reflog and upstream syntax:
`'HEAD@{1}'`, `'@{u}'`.

## When to use

- Committing, splitting or rewording work, or preparing a branch for review.
- Rebasing onto or merging `main`, and resolving conflicts.
- Finding the commit that introduced a bug, or recovering after a bad reset or rebase.
- Running several agents on one repository at the same time.

## When not to use

- Writing the PR description and running final gates: use `/pr-ready`.
- Saving a restorable snapshot mid-task: use `/checkpoint`.
- A secret was committed: rotate it first with `credential-sanitizer`, then plan any history rewrite with the user.
- CI configuration and required checks: use `ci-cd-github-actions`.

## Workflow

1. **Orient, read-only.**

   ```bash
   git status --short --branch
   git log --oneline --graph --decorate -15
   git stash list
   git rev-parse --abbrev-ref --symbolic-full-name '@{u}'
   ```

   **Check:** You know the current branch, its upstream, whether the tree is dirty, and whether the branch is shared (pushed and used by others, or a long-lived branch like `main` or `release/*`).

2. **Branch from a fresh base.** `git fetch origin`, then `git switch -c feat/checkout-retry origin/main`. Use short-lived branches named `<type>/<topic>`.

   **Check:** `git log --oneline origin/main..HEAD` is empty before you start.

3. **Commit atomically with Conventional Commits.** One logical change per commit that builds and passes tests. Stage by path; for part of a file, write a patch and stage it without a prompt:

   ```bash
   git add src/checkout/retry.ts tests/checkout/retry.test.ts
   git diff src/app.ts > part.patch     # edit part.patch down to the hunks you want
   git apply --cached part.patch
   git commit -m "fix(checkout): retry card authorization on gateway timeout" -m "Retries once with the same idempotency key." -m "Refs: #482"
   ```

   **Check:** `git show --stat HEAD` contains one logical change, and the pre-commit hooks passed.

4. **Clean up history with fixups, not interactive rebase.** Only on commits that are not yet shared.

   ```bash
   git branch backup/feat-checkout-retry
   git commit --fixup=<sha>                                  # folds into <sha> later
   git rebase --autosquash origin/main                       # Git 2.44+ applies autosquash without -i
   git -c sequence.editor=: rebase -i --autosquash origin/main   # older Git: accept the generated todo as-is
   git diff backup/feat-checkout-retry HEAD                  # pure cleanup: must be empty
   git range-diff origin/main backup/feat-checkout-retry HEAD
   ```

   Reword only `HEAD` directly (`git commit --amend -m "..."`); for older messages, fold a `--squash=<sha> -m "..."` commit or ask the user to reword interactively.

   **Check:** No `fixup!` or `squash!` commits remain in `git log --oneline origin/main..HEAD`, and the diff against the backup is empty.

5. **Integrate `main` and resolve conflicts.** Rebase private branches (`git rebase origin/main`); merge into shared ones (`git merge origin/main`). On conflict:

   ```bash
   git diff --name-only --diff-filter=U        # conflicted files
   # read both sides and the merge base; edit to the correct combined result, then:
   git grep -nE "^(<<<<<<<|>>>>>>>)" -- <file> # must print nothing before staging
   git add <file>
   git -c core.editor=true rebase --continue   # merge: git commit --no-edit
   ```

   Abort with `git rebase --abort` or `git merge --abort` if the resolution is unclear, and ask. Never pick a whole side with `--ours`/`--theirs` without reading both.

   **Check:** No conflict markers remain (`git grep -nE "^(<<<<<<<|>>>>>>>)"` is empty) and the tests pass on the result.

6. **Push safely.** First push: `git push -u origin HEAD`. After rewriting your own branch: `git push --force-with-lease --force-if-includes origin HEAD`. Plain `--force` is never needed.

   **Check:** `git status --short --branch` shows the branch level with its upstream.

7. **Bisect regressions automatically.**

   ```bash
   git bisect start BAD_SHA GOOD_SHA
   git bisect run npm test            # or: git bisect run pytest tests/test_checkout.py -x
   git bisect log > bisect.log
   git bisect reset
   ```

   The command must exit 0 for good, 1-127 (except 125) for bad, and 125 to skip an untestable commit.

   **Check:** Bisect names the first bad commit, and you reproduced the failure there and not on its parent.

8. **Recover from mistakes with the reflog.** `git reflog -20` lists where `HEAD` has been. Create a branch at the lost state (`git branch rescue 'HEAD@{3}'`) before resetting anything. More recipes are in [recovery recipes](references/recovery-recipes.md).

   **Check:** The recovered branch contains the expected commits (`git log --oneline rescue -5`).

## Patterns

### Branching model

| Factor | Trunk-based (incl. GitHub flow) | GitFlow |
| :--- | :--- | :--- |
| Release cadence | Continuous or daily | Scheduled, versioned releases |
| Branch lifetime | Hours to two days | Weeks (`develop`, `release/*`, `hotfix/*`) |
| Prerequisites | Fast CI, feature flags, small PRs | Release management, backport discipline |
| Choose when | Web services, internal tools, agent-driven work (default) | Several shipped versions must be maintained at once (SDKs, mobile, on-prem) |

### Conventional Commits

Format: `<type>(<scope>)!: <imperative summary under 72 chars>`, blank line, body
explaining why, then footers (`Refs: #123`, `BREAKING CHANGE: ...`).

| Type | Use for | SemVer effect |
| :--- | :--- | :--- |
| `feat` | New user-visible capability | Minor |
| `fix` | Bug fix | Patch |
| `perf`, `refactor` | Faster, or restructured with no behaviour change | None |
| `docs`, `test`, `build`, `ci`, `chore` | Non-runtime changes | None |
| `!` or `BREAKING CHANGE:` footer | Incompatible API or behaviour change | Major |

Lint the range before pushing when the repo uses commitlint:
`npx commitlint --from origin/main --to HEAD`.

### Which side is "ours"

| Operation | `--ours` | `--theirs` |
| :--- | :--- | :--- |
| `git merge origin/main` on your branch | Your branch | `main` |
| `git rebase origin/main` from your branch | `main` (the base being rebuilt on) | Your commit being replayed |

### Worktrees for parallel agents

```bash
git worktree add -b agent/auth-fix ../repo-auth-fix origin/main
git worktree list
git worktree remove ../repo-auth-fix      # refuses if dirty; never add --force without consent
git worktree prune
```

Give each agent its own worktree and branch (Git refuses to check out one branch
in two worktrees), install dependencies per worktree, use distinct dev-server
ports, and integrate through PRs rather than cross-worktree merges.

### Signing and protecting `main`

- SSH signing (global config: ask first): `git config --global gpg.format ssh`, `git config --global user.signingkey ~/.ssh/id_ed25519.pub`, `git config --global commit.gpgsign true`. Verify with `git log --show-signature -1`.
- Protect `main` with a ruleset: pull request required, required status checks, block force pushes and deletion, code-owner review, and optionally signed commits and linear history. Changing rulesets is a settings change that needs consent.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `git push --force` | `--force-with-lease --force-if-includes`, own branches only | Plain force silently deletes commits others pushed |
| Rebase a branch others have pulled | Merge `main` into it, or coordinate first | Rewritten history forks every collaborator's copy |
| `git add .` then one "wip" commit | Stage by path, one logical change per commit | Unreviewable diffs, no clean revert, accidental files (`.env`) |
| `git rebase -i` from an agent | `--fixup` plus `--autosquash` with `sequence.editor=:` | The editor blocks forever waiting for input |
| `git reset --hard` to "start over" | `git stash push -u -m "..."` or a backup branch first | Uncommitted work is unrecoverable after a hard reset |
| `--no-verify` to get past hooks | Fix what the hook reports | Hooks are the cheapest gate against broken or leaking commits |
| Resolve conflicts by taking one side wholesale | Read both sides and the base; run tests | Silently drops the other side's fix |
| Long-lived feature branches | Small PRs behind feature flags | Merge pain grows with branch age |

## Verification checklist

- [ ] Each commit is one logical change with a Conventional Commit message, and tests pass at the branch tip.
- [ ] No `fixup!`/`squash!` commits remain; a backup ref existed during any rewrite, and its diff was checked.
- [ ] No conflict markers; tests run after conflict resolution.
- [ ] Rewritten branches pushed only with `--force-with-lease`, and only with consent if shared.
- [ ] No secrets, build output or `.env` files in the diff (`git diff --stat origin/main...HEAD`).
- [ ] Hooks and signing were not bypassed.

## Related

- Agents: `code-reviewer` (review the branch before merge), `security-guard` (secrets found in history), `codebase-explorer` (history archaeology with `git log -S` and `git blame`).
- Workflows: `/checkpoint`, `/pr-ready`, `/root-cause` (with bisect), `/orchestrate` (parallel worktrees), `/code-review`.
- Knowledge: `ci-cd-github-actions`, `subagent-delegation`, `safe-refactor`, `credential-sanitizer`, `documentation-writing`.
