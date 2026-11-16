# Everything Antigravity (EAG) Windows PowerShell Installer
$ErrorActionPreference = "Stop"

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host " 🚀 Installing Everything Antigravity (EAG)" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

$RepoDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillsSrc = Join-Path $RepoDir "skills"
$PluginSrc = Join-Path $RepoDir "plugins\everything-antigravity"

$UserHome = [System.Environment]::GetFolderPath('UserProfile')
$AntigravitySkills = Join-Path $UserHome ".gemini\antigravity\skills"
$AntigravityPlugins = Join-Path $UserHome ".gemini\config\plugins"

New-Item -ItemType Directory -Force -Path $AntigravitySkills | Out-Null
New-Item -ItemType Directory -Force -Path $AntigravityPlugins | Out-Null

Write-Host "[1/2] Linking skills to Google Antigravity..." -ForegroundColor Yellow
if (Test-Path $SkillsSrc) {
    Get-ChildItem -Directory -Path $SkillsSrc | ForEach-Object {
        $target = Join-Path $AntigravitySkills $_.Name
        if (Test-Path $target) { Remove-Item -Recurse -Force $target }
        New-Item -ItemType SymbolicLink -Path $target -Target $_.FullName | Out-Null
    }
}

Write-Host "[2/2] Linking plugin to Google Antigravity plugins..." -ForegroundColor Yellow
if (Test-Path $PluginSrc) {
    $pluginTarget = Join-Path $AntigravityPlugins "everything-antigravity"
    if (Test-Path $pluginTarget) { Remove-Item -Recurse -Force $pluginTarget }
    New-Item -ItemType SymbolicLink -Path $pluginTarget -Target $PluginSrc | Out-Null
}

Write-Host "=========================================================" -ForegroundColor Green
Write-Host " 🎉 Everything Antigravity (EAG) installed successfully!" -ForegroundColor Green
Write-Host " Run 'python src\cli.py status' to verify." -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green
