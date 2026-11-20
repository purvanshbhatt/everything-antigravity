# Recovery Recipes

Companion to the `git-workflow` skill. Rule zero: before any command that moves
or deletes refs, pin the current state with `git branch backup/<name>` so every
recipe is itself undoable. Commands marked **(confirm)** discard or rewrite
something and need the user's explicit yes.

PowerShell treats `@{...}` as a hashtable literal: always quote reflog and
upstream syntax, for example `git branch rescue 'HEAD@{3}'`.

## Undo and redo

| Situation | Recovery |
| :--- | :--- |
| Undo the last commit, keep its changes staged | `git reset --soft HEAD~1` |
| Undo the last commit, keep changes unstaged (to split it) | `git reset HEAD~1`, then stage and commit the pieces by path |
| Amended by mistake | `git reset --soft 'HEAD@{1}'` restores the pre-amend commit with the amended changes staged |
| Undo a commit that is already pushed | `git revert <sha>` (merge commit: `git revert -m 1 <sha>`); never rewrite shared history |
| Reword the last unpushed commit | `git commit --amend -m "fix(api): correct pagination cursor"` |
| Squash the whole branch into one commit | `git reset --soft $(git merge-base HEAD origin/main)` then `git commit -m "..."`; PowerShell: `git reset --soft (git merge-base HEAD origin/main)` |

## Wrong place

| Situation | Recovery |
| :--- | :--- |
| Committed to `main` locally instead of a feature branch (not pushed) | `git branch feat/x` (keeps the commits), then `git reset --keep origin/main` on `main`, then `git switch feat/x` |
| Commits made on a detached `HEAD` | `git switch -c rescue/detached` before switching anywhere else; if already switched away, find the commit in `git reflog` |
| Changes made on the wrong branch, not committed | `git stash push -u -m "move"`, `git switch right-branch`, `git stash pop` |
| A file that should be ignored was committed (unpushed) | `git rm --cached path`, add it to `.gitignore`, `git commit --amend --no-edit` |

`git reset --keep` refuses to run if it would overwrite uncommitted changes,
which makes it the safe alternative to `--hard` for moving a branch.

## Lost work

| Situation | Recovery |
| :--- | :--- |
| Commits vanished after a reset or rebase | `git reflog -30`, find the entry before the operation, `git branch rescue 'HEAD@{N}'` |
| A rebase just finished and went wrong | `git branch rescue ORIG_HEAD` (pre-rebase tip), compare, then move the branch with `git reset --keep rescue` **(confirm)** |
| A rebase is in progress and going wrong | `git rebase --abort` returns to the pre-rebase state |
| Deleted a branch | `git reflog` (or the `Deleted branch x (was abc1234)` message), then `git branch x abc1234` |
| Dropped a stash | `git fsck --no-reflogs` and look for `dangling commit` lines, `git show <sha>` to identify it, then `git stash apply <sha>` |
| Discarded uncommitted edits with `checkout`/`restore` | Not recoverable unless they had been staged: `git fsck --lost-found` may surface the blobs in `.git/lost-found/other` |

Reflog entries expire (90 days by default for reachable entries, 30 for
unreachable), and `git gc` can prune unreachable objects. Recover promptly.

## Archaeology

| Question | Command |
| :--- | :--- |
| Which commit added or removed this text? | `git log -S "retryWithBackoff" --oneline` |
| Which commits changed lines matching a regex? | `git log -G "timeout\s*=" --oneline -- src/` |
| Who last changed these lines, and in which commit? | `git blame -L 40,60 src/checkout.ts` |
| Full history of a line range | `git log -L 40,60:src/checkout.ts` |
| History of a renamed file | `git log --follow --oneline -- src/new-name.ts` |
| What changed between two releases? | `git log --oneline v1.3.0..v1.4.0` and `git diff --stat v1.3.0 v1.4.0` |

## Secrets in history

1. Treat the secret as compromised the moment it was pushed. Rotate or revoke it
   first (see `credential-sanitizer`); rewriting history does not un-leak it.
2. If it was never pushed: remove it from the commit (`git rm --cached` or edit,
   then `git commit --amend --no-edit` or a fixup plus autosquash).
3. If it was pushed: a history rewrite with `git filter-repo` (a separate tool)
   rewrites every later commit hash and needs every collaborator to re-clone.
   Plan it with the user, coordinate a freeze, and only then proceed **(confirm)**.
4. Add a secret scanner to pre-commit and CI so it does not recur.

## Bisect helpers

```bash
# Script for complex checks; exit 125 skips commits that cannot be tested.
cat > /tmp/bisect-check.sh <<'EOF'
#!/bin/sh
npm ci --silent || exit 125
npm test || exit 1          # narrow to the failing test file with your runner's filter
EOF
chmod +x /tmp/bisect-check.sh
git bisect start BAD_SHA GOOD_SHA
git bisect run /tmp/bisect-check.sh
git bisect reset
```

On Windows, put the script inside the repository's ignored scratch area and run
it through Git's bundled shell, for example `git bisect run sh ./scratch/bisect-check.sh`.
Use `git bisect start --first-parent` to step only through merge commits on `main`.
