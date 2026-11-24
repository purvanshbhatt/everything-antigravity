---
name: bash-scripting
disable-model-invocation: true
description: >-
  Writes and reviews robust bash scripts: strict mode and its pitfalls,
  quoting and arrays, safe temp files and cleanup traps, getopts and usage
  text, exit codes and logging to stderr, dry-run guards for destructive
  steps, portability across Linux, macOS bash 3.2, Git Bash and WSL, ShellCheck
  and shfmt, and bats tests. Use when writing or fixing shell scripts, CI
  steps, installers or ops tooling in bash.
---

# Bash Scripting

A good bash script fails loudly, quotes everything, cleans up after itself and
says what it will do before doing anything destructive. When a script grows
past about 150 lines or needs data structures, move it to Python, Go or Node.

## When to use

- Writing or fixing bash scripts for CI, builds, deployment, installers or ops.
- Scripts that break on spaces in file names, partial failures or missing tools.
- Adding argument parsing, logging, dry-run modes or cleanup traps.
- Making scripts portable across Linux, macOS and Windows (Git Bash, WSL).
- Adding ShellCheck and bats tests to existing shell code.

## When not to use

- Windows-first automation or object pipelines: use `powershell-scripting`.
- Task orchestration across many commands: use `task-runners` (Make, just, Taskfile).
- Text-heavy parsing with regex, jq or awk: use `regex-text-processing`.
- Logic that needs real data structures, HTTP clients or tests beyond I/O: use `python-patterns` or `cli-development`.

## Workflow

1. **Decide the shell and target platforms.** Use `#!/usr/bin/env bash` for bash features, or `#!/bin/sh` with POSIX-only syntax for minimal containers (Alpine, distroless shells). Note that macOS ships bash 3.2 (no associative arrays, no `mapfile`).

   **Check:** The shebang matches the features used, and the README or header lists supported platforms.

2. **Start from the template below.** It sets strict mode, an error trap, a cleanup trap, logging helpers and argument parsing.

   **Check:** Running the script with `-h` prints usage and exits 0; an unknown flag prints usage and exits 2.

3. **Quote and use arrays.** Quote every expansion (`"$var"`, `"$@"`, `"${files[@]}"`). Build commands as arrays, never as strings. Read lines with `while IFS= read -r line`. Use `find ... -print0 | xargs -0` or `-exec ... {} +` for file lists.

   **Check:** The script works on a path containing spaces, quotes and a leading dash.

4. **Guard destructive steps.** Validate variables before using them in paths (`"${dir:?}"`), pass `--` before user-supplied paths, support `--dry-run`, and require an explicit confirmation flag (or an interactive prompt) before deleting, overwriting or deploying. When the agent runs such a script, ask the user before the non-dry run.

   **Check:** With `--dry-run`, the script prints every destructive command and changes nothing.

5. **Lint and format.**

   ```bash
   shellcheck -x scripts/*.sh
   shfmt -d -i 2 -ci scripts/         # -w to write changes
   ```

   Disable a ShellCheck rule only on the line that needs it, with a reason: `# shellcheck disable=SC2086 # intentional word splitting of $FLAGS`. **Check:** ShellCheck reports nothing and shfmt shows no diff.

6. **Test with bats.** Test argument parsing, error paths and dry-run output; stub external commands by putting fakes first on `PATH`.

   ```bash
   bats test/                         # bats-core; add bats-support and bats-assert for helpers
   ```

   **Check:** Tests cover success, a missing required argument, a failing dependency and dry run.

7. **Make line endings and permissions stick.** Add `*.sh text eol=lf` to `.gitattributes` so Windows checkouts do not introduce CRLF, and commit the executable bit (`git update-index --chmod=+x script.sh` from Windows).

   **Check:** The script runs in a fresh clone on Linux and in Git Bash without `$'\r': command not found`.

## Patterns

### Script template

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR             # separate line: `readonly x=$(cmd)` would mask failures
DRY_RUN=0
VERBOSE=0
TARGET=""

log()  { printf '%s\n' "$*" >&2; }
die()  { log "error: $*"; exit 1; }
run()  { if (( DRY_RUN )); then log "dry-run: $*"; else "$@"; fi; }

usage() {
  cat <<'EOF'
Usage: deploy.sh [-n] [-v] -t TARGET
  -t TARGET  environment to deploy to (required)
  -n         dry run: print commands without running them
  -v         verbose output
  -h         show this help
EOF
}

on_error() { log "failed at line $1: $2"; }
trap 'on_error "$LINENO" "$BASH_COMMAND"' ERR

TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf -- "${TMP_DIR:?}"; }
trap cleanup EXIT

while getopts ":nvt:h" opt; do
  case "$opt" in
    n) DRY_RUN=1 ;;
    v) VERBOSE=1 ;;
    t) TARGET="$OPTARG" ;;
    h) usage; exit 0 ;;
    :) log "option -$OPTARG needs a value"; usage >&2; exit 2 ;;
    \?) log "unknown option -$OPTARG"; usage >&2; exit 2 ;;
  esac
done
shift $((OPTIND - 1))

[[ -n "$TARGET" ]] || { usage >&2; exit 2; }
command -v gcloud >/dev/null 2>&1 || die "gcloud is not installed"
(( VERBOSE )) && set -x

run gcloud run deploy "app-${TARGET}" --source "$SCRIPT_DIR/.."
```

`getopts` handles short options only. For long options, parse with a
`while (( $# )); do case "$1" in --target) TARGET="$2"; shift 2 ;; ...` loop.

### Strict mode caveats

| Behaviour | Consequence | Mitigation |
| :--- | :--- | :--- |
| `set -e` is ignored inside `if`, `&&`, `\|\|` and functions called from them | Failures inside a checked function do not abort | Check return codes explicitly in such functions |
| `local x=$(cmd)` | `local` succeeds, masking `cmd` failing | `local x; x=$(cmd)` |
| `set -u` with empty arrays on bash < 4.4 | "unbound variable" errors | `"${arr[@]+"${arr[@]}"}"` or require newer bash |
| `pipefail` with `grep -q` or `head` | Upstream gets SIGPIPE and the pipeline fails | Avoid early-exit readers in pipelines, or handle status 141 |
| ERR trap not inherited by functions | Errors in functions go unreported | `set -E` (the `-E` in `set -Eeuo pipefail`) |

### Portability table

| Feature | GNU/Linux | macOS (BSD tools, bash 3.2) | Portable choice |
| :--- | :--- | :--- | :--- |
| In-place sed | `sed -i 's/a/b/' f` | `sed -i '' 's/a/b/' f` | Write to a temp file and `mv` |
| Resolve a path | `readlink -f` | Not on older macOS | `cd "$(dirname "$p")" && pwd -P` |
| Associative arrays | `declare -A` (bash 4+) | Not in bash 3.2 | Require newer bash or restructure |
| Find a command | `which` varies | `which` varies | `command -v` |
| Print text | `echo -e` varies | `echo -e` varies | `printf '%s\n'` |

On Windows, run bash scripts in Git Bash or WSL; paths like `C:\x` need
`cygpath` (Git Bash) or `wslpath` (WSL) conversion.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Unquoted `$var` or `$@` | `"$var"`, `"$@"` | Word splitting and globbing on spaces and `*` |
| `for f in $(ls)` | `for f in ./*` or `find -print0` | Breaks on spaces and newlines in names |
| `cmd="tool $args"; $cmd` | `cmd=(tool "${args[@]}"); "${cmd[@]}"` | Strings lose quoting; arrays keep it |
| `rm -rf "$DIR/"` with an unchecked variable | `rm -rf -- "${DIR:?}/"` | An empty variable deletes from `/` |
| `curl ... \| bash` in scripts you ship | Download, verify a checksum or signature, then run | Unverified remote code execution |
| Logs and data on stdout together | Logs to stderr, data to stdout | Callers can pipe output safely |
| `cd dir` without checking | `cd dir \|\| die "..."` or rely on `set -e` explicitly | Later commands run in the wrong directory |

## Verification checklist

- [ ] Shebang and syntax match the target shells; strict mode and traps are in place.
- [ ] Every expansion is quoted; commands are built as arrays.
- [ ] Destructive steps have `${var:?}` guards, `--`, a dry-run mode and confirmation.
- [ ] `-h` prints usage; invalid input exits 2 with a message on stderr.
- [ ] ShellCheck and shfmt are clean; bats tests cover success and failure paths.
- [ ] `.gitattributes` forces LF and the executable bit is committed.

## Related

- Workflows: `/verify`, `/code-review`, `/build-fix`.
- Knowledge: `powershell-scripting`, `task-runners`, `regex-text-processing`, `linux-admin`, `ci-cd-github-actions`, `linting-formatting`.
- Agents: `code-reviewer`, `test-engineer`, `security-guard`.
