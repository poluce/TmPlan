param(
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'

$repoRoot = $PSScriptRoot
$appDir = Join-Path $repoRoot 'apps\web'

function Assert-Command {
  param([Parameter(Mandatory = $true)][string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

if (-not (Test-Path -LiteralPath $appDir -PathType Container)) {
  throw "apps\\web directory not found: $appDir"
}

Assert-Command -Name 'node'
Assert-Command -Name 'npm'
Assert-Command -Name 'cargo'

$nodeModulesDir = Join-Path $appDir 'node_modules'
if (-not $SkipInstall -and -not (Test-Path -LiteralPath $nodeModulesDir -PathType Container)) {
  Write-Host 'Installing frontend dependencies with npm ci...'
  Push-Location $appDir
  try {
    npm ci
  }
  finally {
    Pop-Location
  }
}

Write-Host 'Starting Tauri desktop app in dev mode...'
Write-Host 'Keep this terminal open for Next.js hot reload and Tauri auto-reload.'
Write-Host 'Press Ctrl+C in this window to stop the dev process.'

Push-Location $appDir
try {
  npm run tauri:dev
}
finally {
  Pop-Location
}
