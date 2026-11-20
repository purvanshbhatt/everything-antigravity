---
trigger: glob
globs: "**/*.sh, **/*.bash, **/*.zsh, **/*.ps1, **/*.psm1"
description: Bash, zsh and PowerShell scripting conventions
---

# Shell scripts

## Bash and zsh

- Start bash scripts with `#!/usr/bin/env bash` and strict mode:

  ```bash
  set -euo pipefail
  trap 'echo "error on line $LINENO" >&2' ERR
  ```

- `#!/bin/sh` scripts must be POSIX: no `[[ ]]`, arrays, `local` portability assumptions or `pipefail` unless the target shell supports it. zsh scripts declare `#!/usr/bin/env zsh`; zsh does not word-split unquoted variables like bash, so never assume identical behaviour.
- Quote every expansion: `"$var"`, `"$@"`, `"${arr[@]}"`, `"$(cmd)"`. Use `$(...)`, never backticks.
- Use `[[ ... ]]` in bash, `local` for function variables, and `readonly` for constants.
- Pass `--` before user-supplied paths (`rm -- "$file"`). Guard destructive paths: `rm -rf -- "${dir:?}/build"`.
- Temporary files via `mktemp` with cleanup: `tmp=$(mktemp -d); trap 'rm -rf -- "$tmp"' EXIT`.
- Do not parse `ls`. Use globs or `find ... -print0 | xargs -0`. Read lines with `while IFS= read -r line`.
- `command -v tool >/dev/null` to check dependencies, not `which`. `printf` over `echo -e`.
- Errors and diagnostics go to stderr (`>&2`); exit with a non-zero code on failure. Scripts are idempotent where possible.
- Code must pass `shellcheck` (and `shfmt` if configured). Disable a check only inline with a reason.
- Never pipe a download into a shell (`curl ... | bash`). Download, verify a checksum or signature, then run.
- Commit `.sh` files with LF line endings (`*.sh text eol=lf` in `.gitattributes`).

## PowerShell

- Use approved verbs (`Get-Verb`) in `Verb-Noun` function names, and `[CmdletBinding()]` with a typed `param()` block plus validation attributes (`[ValidateNotNullOrEmpty()]`, `[ValidateSet()]`).
- Fail fast: set `$ErrorActionPreference = 'Stop'` at script top or pass `-ErrorAction Stop` to cmdlets whose failure must stop the script, and wrap them in `try { } catch { }` with a contextual message. `Set-StrictMode -Version Latest` in scripts you own.
- `-ErrorAction` does not apply to native executables: check `$LASTEXITCODE` after calling `git`, `npm`, `docker` and similar.
- Destructive functions declare `[CmdletBinding(SupportsShouldProcess)]` and guard changes with `if ($PSCmdlet.ShouldProcess($target)) { ... }` so `-WhatIf` and `-Confirm` work.
- No aliases in scripts (`Get-ChildItem`, not `ls`/`gci`; `Where-Object`, not `?`). Use full parameter names.
- Build paths with `Join-Path` and quote paths with spaces. Prefer `$PSScriptRoot` over the current directory.
- Return objects, not formatted text. Use `Write-Verbose`, `Write-Warning` and `Write-Error` for messages; `Write-Host` only for interactive UI.
- Never store credentials in scripts; use `SecretManagement`, environment variables or `Get-Credential` interactively.
- Target PowerShell 7 (`pwsh`) unless the script must run on Windows PowerShell 5.1, and say which in a comment.
- Lint with PSScriptAnalyzer (`Invoke-ScriptAnalyzer -Path .`) when available.
- Shipping both `.sh` and `.ps1` variants of a helper: keep behaviour, flags and exit codes identical.
