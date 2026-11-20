# Everything Antigravity installer for Windows PowerShell 5.1+ and PowerShell 7+.
# Thin wrapper around `node bin\eag.js install`; all options are passed through:
#   .\install.ps1                          # Antigravity (+ Gemini CLI if detected)
#   .\install.ps1 --target antigravity,gemini --profile strict
#   .\install.ps1 --dry-run                # show the plan, change nothing
#   .\install.ps1 --link                   # contributors: junction this checkout instead of copying
$ErrorActionPreference = 'Stop'

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Error 'Everything Antigravity needs Node.js 18 or newer (the hooks and the eag CLI run on Node). Install it from https://nodejs.org (or: winget install OpenJS.NodeJS.LTS), then re-run .\install.ps1'
    exit 1
}

$major = [int](& node -p "process.versions.node.split('.')[0]")
if ($major -lt 18) {
    Write-Error "Node.js 18+ is required (found $(& node --version))."
    exit 1
}

$eag = Join-Path $PSScriptRoot 'bin\eag.js'
& node $eag install @args
exit $LASTEXITCODE
