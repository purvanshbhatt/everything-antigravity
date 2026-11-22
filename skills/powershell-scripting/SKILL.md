---
name: powershell-scripting
description: >-
  Writes and reviews PowerShell 7 scripts and modules: advanced functions with
  parameter validation, pipeline input and object output, terminating versus
  non-terminating errors, native exit codes, ShouldProcess (-WhatIf/-Confirm)
  for destructive actions, cross-platform paths, module manifests,
  PSScriptAnalyzer and Pester 5 tests. Use when automating with PowerShell on
  Windows, Linux or macOS, or turning ad hoc scripts into tested modules.
---

# PowerShell Scripting

PowerShell passes objects, not text. Good scripts emit typed objects, fail on
the first real error, support `-WhatIf` for anything destructive, and run
unchanged on Windows, Linux and macOS under `pwsh`.

## When to use

- Automating Windows, Azure, Microsoft 365 or cross-platform tasks with `pwsh`.
- Scripts that continue after errors, print text instead of objects, or break on Linux.
- Turning a pile of `.ps1` files into a module with a manifest and tests.
- Adding PSScriptAnalyzer and Pester to CI.

## When not to use

- POSIX shell scripts for Linux containers and CI images: use `bash-scripting`.
- Cross-platform task orchestration: use `task-runners`.
- Windows desktop or server administration policy (Group Policy, domain security): ask a qualified administrator; never change system security settings from a script without explicit approval.
- Complex applications with heavy logic: use `csharp-dotnet`.

## Workflow

1. **Target PowerShell 7 explicitly.** Add `#Requires -Version 7.2` (or your minimum) at the top. Windows PowerShell 5.1 (`powershell.exe`) differs in defaults, encoding and available operators.

   ```powershell
   $PSVersionTable.PSVersion
   Get-Module -ListAvailable Pester, PSScriptAnalyzer | Select-Object Name, Version
   ```

   **Check:** The script runs under `pwsh`, and the minimum version is declared.

2. **Set error behaviour at the top.** Use `Set-StrictMode -Version Latest` and `$ErrorActionPreference = 'Stop'` so errors terminate and can be caught. Native programs do not throw on non-zero exit by default: check `$LASTEXITCODE`, or set `$PSNativeCommandUseErrorActionPreference = $true` (PowerShell 7.4+, verify for your version).

   **Check:** A failing cmdlet or native command stops the script with a non-zero exit code.

3. **Write advanced functions.** Use `[CmdletBinding()]`, typed and validated `param()` blocks, `ValueFromPipeline` with `process {}` for streaming input, and output `[pscustomobject]` records. Use `Write-Verbose`/`Write-Information` for messages, never `Write-Host` for data.

   **Check:** Output can be piped to `Where-Object`, `Sort-Object` and `ConvertTo-Json` without parsing strings.

4. **Make destructive actions safe.** Add `SupportsShouldProcess` and wrap each change in `if ($PSCmdlet.ShouldProcess($target, $action))`. Set `ConfirmImpact = 'High'` for deletions. When the agent runs such a script, run with `-WhatIf` first and get the user's confirmation before the real run.

   **Check:** `-WhatIf` lists every change and modifies nothing.

5. **Keep paths and environment portable.** Use `Join-Path`, `$HOME`, `[IO.Path]::GetTempPath()`, `$IsWindows`/`$IsLinux`/`$IsMacOS`, and full cmdlet names. Remember Linux file systems are case-sensitive.

   **Check:** The script passes its tests on at least one Windows and one Linux runner.

6. **Lint and test.**

   ```powershell
   Install-Module PSScriptAnalyzer, Pester -Scope CurrentUser   # or Install-PSResource; ask before installing
   Invoke-ScriptAnalyzer -Path . -Recurse -Settings PSGallery
   Invoke-Pester -Path ./tests -Output Detailed
   ```

   **Check:** No analyzer errors or warnings remain unexplained, and Pester passes.

7. **Package as a module when there are several functions.** Create `MyTools/MyTools.psm1` and a manifest with `New-ModuleManifest`, listing exported functions explicitly. Publishing (`Publish-PSResource` or `Publish-Module`) is outward-facing: confirm with the user and read the API key from a secret store, never from the script.

   **Check:** `Import-Module ./MyTools -Force` exposes only the intended commands (`Get-Command -Module MyTools`).

## Patterns

### Advanced function template

```powershell
#Requires -Version 7.2
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Remove-StaleArtifact {
    [CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'High')]
    [OutputType([pscustomobject])]
    param(
        [Parameter(Mandatory, ValueFromPipeline, ValueFromPipelineByPropertyName)]
        [Alias('FullName')]
        [ValidateNotNullOrEmpty()]
        [string[]] $Path,

        [ValidateRange(1, 3650)]
        [int] $OlderThanDays = 30
    )
    begin   { $cutoff = (Get-Date).AddDays(-$OlderThanDays) }
    process {
        foreach ($p in $Path) {
            $item = Get-Item -LiteralPath $p
            if ($item.LastWriteTime -ge $cutoff) { continue }
            if ($PSCmdlet.ShouldProcess($item.FullName, 'Remove')) {
                try {
                    Remove-Item -LiteralPath $item.FullName -Recurse -Force
                    [pscustomobject]@{ Path = $item.FullName; Removed = $true; Error = $null }
                }
                catch [System.IO.IOException] {
                    Write-Error -ErrorRecord $_ -ErrorAction Continue
                    [pscustomobject]@{ Path = $item.FullName; Removed = $false; Error = $_.Exception.Message }
                }
            }
        }
    }
}

# Usage: preview first, then run for real after confirmation
Get-ChildItem ./build -Directory | Remove-StaleArtifact -OlderThanDays 14 -WhatIf
```

### Native commands

```powershell
$output = & git rev-parse --short HEAD 2>&1
if ($LASTEXITCODE -ne 0) { throw "git failed ($LASTEXITCODE): $output" }

$gcloudArgs = @('run', 'deploy', $Service, '--source', '.', '--region', $Region)
& gcloud @gcloudArgs     # splat an array; never build one command string
```

### Gotchas that cause real bugs

| Gotcha | Fix |
| :--- | :--- |
| Every uncaptured expression becomes function output | Assign to `$null` (`$null = $list.Add($x)`) or cast to `[void]` |
| `$x -eq $null` filters when `$x` is an array | Put `$null` on the left: `$null -eq $x` |
| `ConvertTo-Json` truncates nested objects (default depth 2) | Pass `-Depth 10` (or what you need) |
| A single result is a scalar, not an array | Wrap with `@(...)` before using `.Count` or indexing |
| `-Path` interprets wildcards like `[` and `*` | Use `-LiteralPath` for user-supplied paths |
| Aliases (`ls`, `rm`, `curl`, `sort`) differ by platform | Use full cmdlet names in scripts |
| `ForEach-Object -Parallel` runspaces cannot see outer variables | Pass them with `$using:name`, and set `-ThrottleLimit` |
| `Invoke-RestMethod` throws on 4xx/5xx | Use `-SkipHttpErrorCheck` with `-StatusCodeVariable` when you handle status yourself |

### Pester 5 test

```powershell
BeforeAll { . $PSScriptRoot/../src/Remove-StaleArtifact.ps1 }

Describe 'Remove-StaleArtifact' {
    BeforeEach {
        $dir = New-Item -ItemType Directory -Path (Join-Path $TestDrive 'old')
        $dir.LastWriteTime = (Get-Date).AddDays(-90)
    }
    It 'reports but does not delete with -WhatIf' {
        Remove-StaleArtifact -Path $dir.FullName -WhatIf
        Test-Path $dir.FullName | Should -BeTrue
    }
    It 'removes directories older than the cutoff' {
        $r = Remove-StaleArtifact -Path $dir.FullName -Confirm:$false
        $r.Removed | Should -BeTrue
        Test-Path $dir.FullName | Should -BeFalse
    }
}
```

In Pester 5, put setup code inside `BeforeAll`/`BeforeEach`/`It`; code at the
top level of a `Describe` runs during discovery, not during the test run.
`$TestDrive` is a temporary folder that Pester creates and removes for you.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `Write-Host` for results | Emit objects; `Write-Verbose` for diagnostics | Host output cannot be piped, captured or tested |
| `Format-Table` inside functions | Format only at the end of an interactive pipeline | Format objects break downstream cmdlets |
| `catch { }` that swallows everything | Catch specific exception types and rethrow or `Write-Error` | Silent failures |
| Assume native commands throw | Check `$LASTEXITCODE` or enable native error preference | Failures pass unnoticed |
| `Invoke-Expression` with built strings | Call operator `&` with an argument array | Injection and quoting bugs |
| Change machine execution policy in a script | Sign scripts, or ask the user to decide policy | Weakens system security for everything |
| Hard-coded `C:\` or `\` separators | `Join-Path`, `$HOME`, `[IO.Path]` APIs | Breaks on Linux and macOS |

## Verification checklist

- [ ] `#Requires`, `Set-StrictMode` and `$ErrorActionPreference = 'Stop'` are set; native exit codes are checked.
- [ ] Functions are advanced functions with validated parameters and object output.
- [ ] Destructive functions support `-WhatIf`/`-Confirm`, and real runs were confirmed by the user.
- [ ] Paths and commands are portable; tests pass on Windows and Linux.
- [ ] PSScriptAnalyzer is clean and Pester passes.
- [ ] Modules export an explicit function list; publishing was confirmed and used a stored secret.

## Related

- Workflows: `/verify`, `/code-review`, `/build-fix`.
- Knowledge: `bash-scripting`, `task-runners`, `csharp-dotnet`, `azure-essentials`, `ci-cd-github-actions`, `secrets-management`.
- Agents: `code-reviewer`, `test-engineer`, `security-guard`.
