Set-StrictMode -Version Latest

function Get-LHNodeRelease {
    param([Parameter(Mandatory=$true)]$Releases)
    $release = $Releases | Where-Object { $_.lts -and $_.version -match '^v24\.' } | Select-Object -First 1
    if (-not $release) { throw 'A supported Node.js 24 LTS release was not found.' }
    return $release
}

function Get-LHChecksum {
    param([string]$Text, [string]$Filename)
    $escaped = [regex]::Escape($Filename)
    foreach ($line in ($Text -split "`n")) {
        if ($line.Trim() -match "^([a-fA-F0-9]{64})\s+$escaped`$") { return $Matches[1].ToLowerInvariant() }
    }
    throw "Official checksum is missing for $Filename."
}

function Test-LHHash {
    param([string]$Path, [string]$Sha256)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash -ieq $Sha256
}

function Get-LHFile {
    param([string]$Url, [string]$Destination, [string]$Sha256)
    if ($Sha256 -notmatch '^[a-fA-F0-9]{64}$') { throw 'A valid SHA256 checksum is required before downloading.' }
    if (([uri]$Url).Scheme -ne 'https') { throw 'Downloads must use HTTPS.' }
    if (Test-LHHash $Destination $Sha256) { Write-Host "Already verified: $(Split-Path $Destination -Leaf)"; return }
    New-Item -ItemType Directory -Force -Path (Split-Path $Destination -Parent) | Out-Null
    $partial = "$Destination.partial"
    if (-not (Test-LHHash $partial $Sha256)) {
        $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
        if (-not $curl) { throw 'Windows curl.exe is required. Install current Windows updates, then rerun setup.' }
        Write-Host "Downloading $(Split-Path $Destination -Leaf)..."
        & $curl.Source --fail --location --retry 3 --retry-delay 2 --continue-at - --output $partial $Url
        if ($LASTEXITCODE -ne 0) { throw 'The download was interrupted. Rerun setup to resume it.' }
    }
    if (-not (Test-LHHash $partial $Sha256)) {
        Remove-Item -LiteralPath $partial -Force
        throw "Checksum mismatch for $(Split-Path $Destination -Leaf). The downloaded file was removed. Rerun setup."
    }
    if (Test-Path -LiteralPath $Destination) {
        $backup = $Destination + '.before-little-higgy-' + [guid]::NewGuid().ToString('N')
        Move-Item -LiteralPath $Destination -Destination $backup
    }
    Move-Item -LiteralPath $partial -Destination $Destination
}

function Expand-LH7Zip {
    param([string]$Archive, [string]$Destination, [switch]$TarOnly)
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    $tar = Get-Command tar.exe -ErrorAction SilentlyContinue
    if ($tar) {
        & $tar.Source -xf $Archive -C $Destination
        if ($LASTEXITCODE -eq 0) { return }
    }
    if (-not $TarOnly) {
        $seven = Get-Command 7z.exe -ErrorAction SilentlyContinue
        if (-not $seven) {
            $installed = Join-Path $env:ProgramFiles '7-Zip\7z.exe'
            if (Test-Path $installed) { $seven = Get-Item $installed }
        }
        if ($seven) {
            $exe = if ($seven -is [System.Management.Automation.ApplicationInfo]) { $seven.Source } else { $seven.FullName }
            & $exe x $Archive "-o$Destination" -y
            if ($LASTEXITCODE -eq 0) { return }
        }
    }
    throw 'This Windows tar cannot extract the ComfyUI archive. Install 7-Zip from https://www.7-zip.org/ and rerun setup.'
}

function Test-LHComfy {
    param([string]$Base = 'http://127.0.0.1:8188')
    try { $stats = Invoke-RestMethod "$Base/system_stats" -TimeoutSec 3; return $null -ne $stats.PSObject.Properties['devices'] }
    catch { return $false }
}

function Get-LHFreePort {
    param([int]$First = 3000, [int]$Last = 3010)
    for ($port = $First; $port -le $Last; $port++) {
        $listener = $null
        try {
            $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $port)
            $listener.Start()
            return $port
        } catch { } finally { if ($listener) { $listener.Stop() } }
    }
    throw 'Ports 3000-3010 are busy. Close an old Little Higgy window and try again.'
}

function Get-LHInstallRoot {
    if (-not $env:LOCALAPPDATA) { throw 'Windows LOCALAPPDATA is not available.' }
    return Join-Path $env:LOCALAPPDATA 'LittleHiggy'
}

function Start-LHServices {
    param([string]$SourceRoot, [string]$InstallRoot = (Get-LHInstallRoot))
    $configPath = Join-Path $InstallRoot 'runtime.json'
    if (-not (Test-Path $configPath)) { throw 'Run SETUP-LOCAL-REQUIREMENTS.bat first.' }
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    $node = Join-Path $config.NodeDir 'node.exe'
    if (-not (Test-Path $node)) { throw 'Node runtime is missing. Rerun SETUP-LOCAL-REQUIREMENTS.bat.' }
    if (-not (Test-LHComfy)) {
        if (-not $config.ComfyRoot) { throw 'Start your existing ComfyUI at port 8188, then run Little Higgy again.' }
        $python = Join-Path $config.ComfyRoot 'python_embeded\python.exe'
        if (-not (Test-Path $python)) { throw 'ComfyUI runtime is missing. Rerun setup.' }
        $engineArgs = @('-s', 'ComfyUI/main.py', '--windows-standalone-build', '--listen', '127.0.0.1', '--port', '8188', '--enable-cors-header', 'https://kakashi-sharingan.github.io')
        if ($config.Mode -eq 'cpu') { $engineArgs += '--cpu' }
        Write-Host "Starting ComfyUI ($($config.Mode)) in its own window..."
        $engine = Start-Process -FilePath $python -ArgumentList $engineArgs -WorkingDirectory $config.ComfyRoot -PassThru
        $ready = $false
        for ($i = 0; $i -lt 90; $i++) {
            if (Test-LHComfy) { $ready = $true; break }
            $engine.Refresh()
            if ($engine.HasExited) { throw 'ComfyUI exited before it became ready. Check its window. Rerun setup with -CPU if GPU initialization failed.' }
            Start-Sleep -Seconds 2
        }
        if (-not $ready) { throw 'ComfyUI is still starting. Check its window, then run START-LITTLE-HIGGY.bat again.' }
    } else { Write-Host 'Using the ComfyUI instance already running on port 8188.' }
    $env:PATH = "$($config.NodeDir);$env:PATH"
    $env:NEXT_TELEMETRY_DISABLED = '1'
    $env:ELECTRON_SKIP_BINARY_DOWNLOAD = '1'
    Remove-Item Env:NEXT_PUBLIC_LITTLE_HIGGY_PAGES -ErrorAction SilentlyContinue
    if (-not (Test-Path (Join-Path $SourceRoot '.next\BUILD_ID'))) {
        throw 'The local studio is not built. Rerun SETUP-LOCAL-REQUIREMENTS.bat.'
    }
    $port = Get-LHFreePort
    $runner = Join-Path $SourceRoot 'windows\Run-Studio.ps1'
    $shell = Join-Path $PSHOME 'powershell.exe'
    if (-not (Test-Path $shell)) { $shell = (Get-Process -Id $PID).Path }
    $arguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -SourceRoot "{1}" -NodeDir "{2}" -Port {3}' -f $runner, $SourceRoot, $config.NodeDir, $port
    $studio = Start-Process -FilePath $shell -ArgumentList $arguments -WorkingDirectory $SourceRoot -PassThru
    $ready = $false
    for ($i = 0; $i -lt 45; $i++) {
        try {
            $response = Invoke-WebRequest "http://127.0.0.1:$port/studio" -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch { }
        $studio.Refresh()
        if ($studio.HasExited) { throw 'Little Higgy exited. Check its window for the error.' }
        Start-Sleep -Seconds 2
    }
    if (-not $ready) { throw 'Little Higgy is not ready yet. Check its studio window.' }
    $url = "http://localhost:$port/studio"
    Write-Host "Ready: $url" -ForegroundColor Green
    Start-Process $url
}
