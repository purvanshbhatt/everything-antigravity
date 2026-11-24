---
name: merge-conflict-resolution
disable-model-invocation: true
description: >-
  Resolves merge, rebase, cherry-pick and stash conflicts by intent rather than
  by line: shows the merge base, reads both sides' commits to state what each
  change meant to do, writes a resolution that keeps both intents, regenerates
  lockfiles instead of hand-merging them, hunts semantic conflicts, re-runs
  build and tests and logs every decision. Use when git stops with CONFLICT or
  a PR cannot merge. Invoke with /merge-conflict-resolution.
---

# Merge Conflict Resolution

Git reports conflicts as text, but each one is a disagreement between two changes that had a purpose. Picking lines without knowing those purposes produces code that compiles and still drops one side's fix. This workflow recovers both intents first, writes code that serves both, then proves it with the build and the tests.

## When to use

- `git merge`, `git rebase`, `git cherry-pick` or `git stash pop` stopped with `CONFLICT`.
- The user says "resolve the conflicts", "fix the merge" or "the rebase onto main keeps failing".
- A pull request says the branch has conflicts that must be resolved.
- A merge with no markers broke the build or tests (a semantic conflict).

## When not to use

- Choosing a branching model or a rebase-versus-merge policy: `git-workflow`.
- Recovering commits lost to a bad reset or rebase: `git-workflow` (reflog recovery).
- The conflict comes from a dependency bump that has not been done properly yet: `/dependency-upgrades` first.
- Planning a large move or rename so that it conflicts less: `safe-refactor`.

## Workflow

1. **Identify the operation and the way back.** Find out which operation is in progress and which paths are unmerged:

   ```bash
   git status
   git diff --name-only --diff-filter=U
   ```

   Note the abort command for that operation (`git merge --abort`, `git rebase --abort`, `git cherry-pick --abort`). It restores the state before the operation but discards resolutions made so far, so run it only with the user's agreement. A conflicted `git stash pop` keeps the stash entry, so the stashed work is not lost.

   **Check:** You can name the operation, which side is "ours" and which is "theirs" (table under Reference), and the abort command.

2. **Show the base for every conflict.** Two-sided markers hide what the code looked like before either change. Before editing a file, re-create its markers with the base included, and read the three versions when a hunk is large:

   ```bash
   git checkout --conflict=zdiff3 -- src/users.ts   # git 2.35+; use --conflict=diff3 on older git
   git show :1:src/users.ts    # base
   git show :2:src/users.ts    # ours
   git show :3:src/users.ts    # theirs
   ```

   `--conflict` rewrites the file with fresh markers, so never run it on a file you have already partly resolved.

   **Check:** Every hunk shows three parts: ours, the base and theirs.

3. **Recover each side's intent.** For each conflicted file, list each side's commits since the base and read their messages, linked issues and diffs:

   ```bash
   base=$(git merge-base HEAD MERGE_HEAD)
   git log --oneline "$base"..HEAD -- src/users.ts
   git log --oneline "$base"..MERGE_HEAD -- src/users.ts
   git diff "$base" MERGE_HEAD -- src/users.ts
   ```

   ```powershell
   $base = git merge-base HEAD MERGE_HEAD
   git log --oneline "$base..MERGE_HEAD" -- src/users.ts
   ```

   During a rebase, the incoming change is `git show REBASE_HEAD` and its base is `REBASE_HEAD^`; during a cherry-pick, use `CHERRY_PICK_HEAD` the same way. When one side renamed or moved a symbol used in many places, delegate the call-site search to the `codebase-explorer` subagent. Write one intent line per side per hunk in the decision log, for example "ours: renamed `getUser` to `fetchUser` across the module, no behavior change (a1b2c3d)" and "theirs: return 404 for soft-deleted users (#412, e4f5a6b)".

   **Check:** Each hunk has an intent line for both sides that cites a commit, issue or diff, not a guess.

4. **Classify and resolve each hunk.** Use the classification table. Write the merged code with `replace_file_content` and remove every marker. Keep both intents where they are compatible; when one side refactored and the other changed behavior, re-apply the behavior change to the refactored code. Never take a whole side (`git checkout --ours`, `--theirs` or `-X ours`) without a reason written in the decision log. When the intents truly contradict, stop and ask the user, showing both intents and the options.

   **Check:** No markers remain:

   ```bash
   git diff --check
   git grep -nE '^(<<<<<<<|>>>>>>>)( |$)|^=======$'
   ```

5. **Regenerate generated files.** Resolve the manifest (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`) by intent first. Then take either side's lockfile or generated file and regenerate it rather than merging it by hand:

   | File | Regenerate with |
   | :--- | :--- |
   | `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock` | `npm install`, `pnpm install`, `yarn install`, `bun install` |
   | `go.sum` | `go mod tidy` |
   | `Cargo.lock` | `cargo build` |
   | `poetry.lock`, `uv.lock` | `poetry lock`, `uv lock` |
   | Test snapshots | Re-run the tests with the runner's update option after the code is resolved, then review the snapshot diff |
   | Generated clients, protobuf output, ORM schemas | Re-run the generator from the resolved source |

   **Check:** The ecosystem's frozen install (`npm ci`, `pnpm install --frozen-lockfile`, `cargo build --locked`; for Go, `go build ./...` with no further `go.sum` change) succeeds against the resolved manifest.

6. **Hunt for semantic conflicts.** Git merges non-overlapping edits silently, so code can conflict in meaning with no markers: a function renamed on one side and newly called on the other, a changed default, a removed config key that new code still reads. For every symbol that one side renamed, removed or changed the signature of, search the other side's new code with `grep_search`. Then run the build, typecheck and lint, the tests closest to both sides' changes, and the full suite (`/verify quick` covers the usual gates).

   **Check:** Build, typecheck and tests pass on the resolved tree, and the tests added by each side are present and passing.

7. **Continue the operation.** Stage each resolved file and continue:

   ```bash
   git add src/users.ts package-lock.json
   git merge --continue          # or: git rebase --continue / git cherry-pick --continue
   ```

   During a rebase, later commits can conflict again; repeat steps 2 to 7 for each and keep one decision log for the whole rebase. After a conflicted `stash pop`, run `git stash drop` only when the user confirms the result, because the stash is the only other copy of that work.

   **Check:** `git status` shows no operation in progress and no unmerged paths.

8. **Report and handle the push.** Give the user the decision log (template below). If a rebase rewrote commits that were already pushed, updating the remote needs `git push --force-with-lease`. Ask first, and never do it on a shared branch such as `main` or a release branch; suggest a merge there instead.

   **Check:** The user has the decision log, and no force-push happened without an explicit yes.

## Reference

### Who is "ours" and who is "theirs"

| Operation | Ours (`:2`, `HEAD`) | Theirs (`:3`) | Base of the incoming change |
| :--- | :--- | :--- | :--- |
| merge | Your current branch | The branch being merged (`MERGE_HEAD`) | `git merge-base HEAD MERGE_HEAD` |
| rebase | The upstream you are rebasing onto, plus commits already replayed | Your commit being replayed (`REBASE_HEAD`) | `REBASE_HEAD^` |
| cherry-pick | Your current branch | The picked commit (`CHERRY_PICK_HEAD`) | `CHERRY_PICK_HEAD^` |
| stash pop | Your current working branch | The stashed changes (`stash@{0}`) | `stash@{0}^1` |

The rebase row is the usual trap: there, `--theirs` means your own work.

### Hunk classification

| Kind | Example | Resolution |
| :--- | :--- | :--- |
| Independent edits on adjacent lines | Both sides added an import or an enum value | Keep both, ordered by the file's convention |
| Same intent, two implementations | Both fixed the same off-by-one differently | Keep the better one, say why, keep both sides' tests |
| Refactor versus behavior change | Ours extracted a function; theirs fixed a bug in the old inline code | Apply the bug fix inside the extracted function |
| Delete versus modify | One side removed a function, the other edited it | Find why it was removed; port the edit to the replacement or drop it with a reason |
| Formatting versus content | One side reformatted the whole file | Keep the content change, then re-run the formatter |
| Contradictory intent | One side set the timeout to 10 s, the other to 60 s, both on purpose | Stop and ask the user |

### Decision log template

```markdown
## Conflict resolution: merge of feature/soft-delete into main
| File:line | Ours intended | Theirs intended | Resolution | Why |
| :--- | :--- | :--- | :--- | :--- |
| src/users.ts:41 | Rename getUser to fetchUser (a1b2c3d) | 404 for soft-deleted users (#412) | Soft-delete check added inside fetchUser | Compatible intents |
| package-lock.json | n/a | n/a | Regenerated with npm install | Generated file |
- Semantic check: new call sites of getUser on theirs updated to fetchUser (2 files).
- Verification: npm run typecheck, npm test (212 passed).
- Open questions: none.
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Take "ours" or "theirs" for a whole file to make the conflict go away | Resolve hunk by hunk; justify any whole-side choice | It silently drops the other side's fix |
| Resolve from two-sided markers only | Show the base with `--conflict=zdiff3` | Without the base you cannot tell who changed what |
| Hand-merge lockfiles | Regenerate them from the resolved manifest | Hand-merged lockfiles carry inconsistent versions and hashes |
| Stop once the markers are gone | Build, typecheck and test | Semantic conflicts have no markers |
| Guess intent from the code alone | Read commit messages, issues and diffs | Guessed intent is how fixes get reverted |
| Abort or reset to "start over" without asking | Ask first | Abort throws away resolutions already made |
| Force-push a rebased shared branch | Merge instead, or `--force-with-lease` on a private branch after a yes | It rewrites history other people build on |
| Pick a side when intents contradict | Ask the user | That is a product decision, not a merge decision |

## Verification checklist

- [ ] Every hunk was resolved with both sides' intents recorded in the decision log.
- [ ] No whole-side choice was made without a written reason.
- [ ] No conflict markers remain, and generated files were regenerated, not hand-merged.
- [ ] Renamed, removed or re-signed symbols were checked against the other side's new code.
- [ ] Build, typecheck and tests pass on the result, including each side's new tests.
- [ ] No abort, stash drop or force-push happened without the user's explicit agreement.

## Related

- Knowledge: `git-workflow`, `safe-refactor`.
- Workflows: `/verify`, `/code-review`, `/root-cause`, `/pr-ready`, `/dependency-upgrades`.
- Agents: `codebase-explorer`, `code-reviewer`.
