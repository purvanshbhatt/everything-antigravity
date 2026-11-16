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
$AntigravityConfigSkills = Join-Path $UserHome ".gemini\config\skills"
$AntigravityPlugins = Join-Path $UserHome ".gemini\config\plugins"

New-Item -ItemType Directory -Force -Path $AntigravitySkills | Out-Null
New-Item -ItemType Directory -Force -Path $AntigravityConfigSkills | Out-Null
New-Item -ItemType Directory -Force -Path $AntigravityPlugins | Out-Null

function Create-SafeLink($linkPath, $targetPath) {
    if (Test-Path $linkPath) {
        Remove-Item -Recurse -Force $linkPath
    }
    try {
        New-Item -ItemType SymbolicLink -Path $linkPath -Target $targetPath | Out-Null
    } catch {
        # Fallback to Junction if developer mode / symlink privileges are disabled
        New-Item -ItemType Junction -Path $linkPath -Target $targetPath | Out-Null
    }
}

Write-Host "[1/2] Linking skills to Google Antigravity..." -ForegroundColor Yellow
if (Test-Path $SkillsSrc) {
    Get-ChildItem -Directory -Path $SkillsSrc | ForEach-Object {
        $target1 = Join-Path $AntigravitySkills $_.Name
        $target2 = Join-Path $AntigravityConfigSkills $_.Name
        Create-SafeLink $target1 $_.FullName
        Create-SafeLink $target2 $_.FullName
    }
}

Write-Host "[2/2] Linking plugin to Google Antigravity plugins..." -ForegroundColor Yellow
if (Test-Path $PluginSrc) {
    $pluginTarget = Join-Path $AntigravityPlugins "everything-antigravity"
    Create-SafeLink $pluginTarget $PluginSrc
}

Write-Host "=========================================================" -ForegroundColor Green
Write-Host " 🎉 Everything Antigravity (EAG) installed successfully!" -ForegroundColor Green
Write-Host " Run 'python src\cli.py status' to verify." -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green
