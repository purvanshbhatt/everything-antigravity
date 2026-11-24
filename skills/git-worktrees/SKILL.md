---
name: git-worktrees
disable-model-invocation: true
description: >-
  Runs each task or parallel agent in its own git worktree: picks a worktree
  root and confirms it is ignored, creates a branch-backed worktree, installs
  dependencies and proves a green test baseline before any edit, then finishes
  by merging, opening a PR, keeping or discarding (with confirmation) and
  cleans up merged branches on evidence. Use for parallel agents or isolated
  experiments. Invoke with /git-worktrees.
---

# Git Worktrees

One repository, several working directories, each on its own branch. Worktrees let two agents, or an agent and the user, work at the same time without stashing, switching branches or overwriting each other's files. This workflow covers the whole lifecycle: create, set up, baseline, work, finish and clean up.

## When to use

- Two or more agents or subagents will edit code in the same repository at the same time.
- A new task must start while the main checkout holds uncommitted work the user is still using.
- A risky approach (a major upgrade, a large refactor) may be thrown away.
- Testing or reviewing a PR branch without disturbing the current checkout.
- Clearing out a pile of stale worktrees and branches.

## When not to use

- Branch naming, commit hygiene, rebasing or conflict resolution: `git-workflow`.
- Splitting work into parallel shards and merging the results: `/orchestrate`, which uses this skill for isolation.
- Preparing the finished branch for review: `/pr-ready`.
- A short, sequential change in a clean checkout: an ordinary branch is enough.

## Safety rules

- Never remove a worktree, or delete a branch, that has uncommitted changes or unmerged commits without first showing them to the user and getting an explicit yes.
- Never use `git worktree remove --force` or `git branch -D` without that yes.
- Never create a worktree inside a tracked directory. A worktree folder inside the repository must be ignored.
- One branch per worktree. Git refuses to check out a branch that another worktree already has, and forcing it invites lost work.

## Workflow

1. **Survey the repository.**

   ```bash
   git rev-parse --show-toplevel
   git status --short
   git worktree list --porcelain
   git symbolic-ref --short refs/remotes/origin/HEAD   # default branch, e.g. origin/main
   ```

   Look for existing worktrees, and for entries marked `prunable` in the porcelain output (their folders are gone).

   **Check:** You know the repository root, the base branch, and every existing worktree with its branch.

2. **Choose the worktree root.** Follow the project's convention if it has one (an existing `.worktrees/` folder, or a note in the README or `AGENTS.md`). Otherwise offer:

   | Option | Path | Requirement |
   | :--- | :--- | :--- |
   | Sibling folder | `../<repo>-<slug>` | None; the main checkout's tools never see it |
   | Inside the repository | `<repo>/.worktrees/<slug>` | Must be ignored. Add `.worktrees/` to `.git/info/exclude` (local, nothing to commit) or to `.gitignore` (shared, needs a commit); let the user choose |

   Prefer the sibling layout when test runners, linters, file watchers or search tools in the repository would otherwise scan the nested worktrees.

   **Check:** The root is outside the repository, or `git check-ignore -q .worktrees/probe` exits 0 (PowerShell: run it, then read `$LASTEXITCODE`).

3. **Create the worktree on a new branch.**

   ```bash
   git fetch origin
   git worktree add -b agent/<slug> ../<repo>-<slug> origin/main
   ```

   Use the branch prefix the project already uses (`feat/`, `fix/`, `agent/`). For an existing branch, drop `-b`: `git worktree add ../<repo>-<slug> <branch>`. To test a pull request, create a detached worktree (`git worktree add --detach ../<repo>-pr-123`) and run `gh pr checkout 123` inside it, because `gh pr checkout` acts on the current directory.

   **Check:** `git worktree list` shows the new path on the new branch, and `git status` in the main checkout is unchanged.

4. **Set up the worktree.** A worktree shares history but not untracked files, so it starts without `node_modules`, virtual environments, build output or local `.env` files. Install from the lockfile inside the worktree:

   | Stack | Command |
   | :--- | :--- |
   | npm / pnpm / Yarn (Berry) / Bun | `npm ci` / `pnpm install --frozen-lockfile` / `yarn install --immutable` / `bun install --frozen-lockfile` |
   | Python | `uv sync`, or create a `.venv` and `pip install -e ".[dev]"` |
   | Go | `go mod download` |
   | Rust | `cargo build` |

   Copy untracked local config such as `.env` only with the user's yes, and never commit it. If the app runs a dev server or a local database, give each worktree its own port and database name (bash `PORT=3001 npm run dev`; PowerShell `$env:PORT = "3001"; npm run dev`).

   **Check:** The project's build or type check succeeds inside the worktree.

5. **Prove a green baseline before editing.** Run the test suite, or `/verify quick`, in the worktree before changing anything, and record the result. If the baseline is red, stop and report: either the base branch is broken or the setup is incomplete. Starting on a red baseline makes inherited failures indistinguishable from new ones.

   **Check:** The baseline result is written down: a pass count, or the list of pre-existing failures the user accepted.

6. **Work only inside the worktree.** Every `run_command` uses the worktree as its working directory, and every `view_file` and `write_to_file` uses an absolute path inside it. When handing the worktree to a subagent, put the absolute path, the branch name and "edit only under this path" in the brief. Commit in small steps on the worktree's branch.

   **Check:** `git status` in the main checkout shows none of the task's changes.

7. **Finish: offer four options.** When the work is done and verified, show what is at stake and ask:

   ```bash
   git -C <worktree> status --short
   git -C <worktree> log --oneline origin/main..HEAD
   ```

   1. Merge locally into the base branch (for local-only workflows; confirm the target branch).
   2. Push and open a PR: hand off to `/pr-ready`.
   3. Keep it for later, optionally with `git worktree lock <path> --reason "<why>"` so pruning leaves it alone.
   4. Discard: list the uncommitted files and unmerged commits from the commands above, say they will be lost, and wait for an explicit yes.

   **Check:** The user chose an option, and for a discard they saw the exact files and commits at risk.

8. **Clean up on evidence.** Remove a worktree only after its work is merged, pushed or explicitly discarded:

   ```bash
   git worktree remove <path>     # refuses when the worktree is dirty, which is what you want
   git worktree prune
   git branch -d <branch>         # refuses when the branch is unmerged, which is what you want
   ```

   Decide "merged" from evidence: `git merge-base --is-ancestor <branch> origin/main` exits 0 for merge and fast-forward merges. Squash and rebase merges do not leave the branch as an ancestor, so check the PR instead: `gh pr view <branch> --json state,mergedAt`. For a cleanup sweep, fill in the table below and remove only the rows the user approves.

   **Check:** `git worktree list` no longer shows the path, no `prunable` entries remain, and every deleted branch has merge evidence or an explicit discard.

## Cleanup sweep table

| Worktree | Branch | Uncommitted files | Commits not on base | Merge evidence | Proposed action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| ../app-auth-fix | agent/auth-fix | 0 | 0 | PR #412 merged | remove, delete branch |
| ../app-spike-cache | agent/spike-cache | 3 | 5 | none | ask: keep or discard |

## Troubleshooting

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| Git says the branch is already checked out or used by another worktree | Each branch can live in one worktree only | Create a new branch, or work in the worktree that has it |
| A deleted folder still appears in `git worktree list` | Stale administrative entry | `git worktree prune` |
| Tests or linters pick up files from other worktrees | Worktrees nested in the repository are being scanned | Move to the sibling layout, or exclude the folder in the tool's config |
| Two dev servers fight over one port | Shared default port | Set a distinct port per worktree |
| The app fails to start in the worktree only | Untracked local config was not copied | Copy what is needed (with consent) or rerun setup |
| `git worktree remove` refuses | Uncommitted or untracked files | Commit or move them, or get a yes before `--force` |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Create a worktree in a tracked folder | Use a sibling path or a verified-ignored folder | Worktree files show up as untracked changes or get committed |
| Start editing before a baseline run | Prove the baseline green first | Inherited failures look like yours |
| Delete the folder with a recursive file delete | `git worktree remove`, then `git worktree prune` | Leaves stale metadata and skips the dirty check |
| Use `git branch -D` in a cleanup sweep | Use `-d`, and gather evidence for everything else | `-D` destroys unmerged work silently |
| Let two writing agents share one worktree | One worktree per writer | That is the exact conflict worktrees exist to prevent |
| Copy `.env` files around by default | Ask, copy only what is needed, never commit it | Secrets spread to more places |

## Verification checklist

- [ ] The worktree root is outside the repository or verified as ignored.
- [ ] Each worktree has its own branch, and dependencies were installed from the lockfile.
- [ ] A baseline test run was recorded before the first edit.
- [ ] The main checkout's working tree contains none of the task's changes.
- [ ] The finish option was the user's choice; any discard was confirmed after the files and commits were shown.
- [ ] Every removed worktree and deleted branch has merge evidence or explicit consent, and `git worktree prune` ran.

## Related

- Workflows: `/orchestrate`, `/pr-ready`, `/verify`, `/checkpoint`, `/throwaway-prototype`.
- Agents: `codebase-explorer`.
- Knowledge: `git-workflow`, `subagent-delegation`, `dev-environments`.
