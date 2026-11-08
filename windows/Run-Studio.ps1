param([string]$SourceRoot, [string]$NodeDir, [int]$Port = 3000)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $SourceRoot
$env:PATH = "$NodeDir;$env:PATH"
$env:NEXT_TELEMETRY_DISABLED = '1'
$env:COMFYUI_URL = 'http://127.0.0.1:8188'
Remove-Item Env:NEXT_PUBLIC_LITTLE_HIGGY_PAGES -ErrorAction SilentlyContinue
Write-Host "Little Higgy: http://localhost:$Port/studio"
Write-Host 'Keep this window open. Press Ctrl+C to stop the studio.'
& (Join-Path $NodeDir 'node.exe') (Join-Path $SourceRoot 'node_modules\next\dist\bin\next') start --hostname 127.0.0.1 --port $Port
if ($LASTEXITCODE -ne 0) { Write-Host 'The studio stopped with an error.' -ForegroundColor Red; Read-Host 'Press Enter to close' }
