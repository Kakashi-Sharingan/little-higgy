$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Requirements.ps1')
try { Start-LHServices -SourceRoot (Split-Path $PSScriptRoot -Parent) }
catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }
