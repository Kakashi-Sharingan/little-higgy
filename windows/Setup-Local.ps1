param([switch]$CPU, [switch]$NoLaunch, [string]$InstallRoot)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Requirements.ps1')
$sourceRoot = Split-Path $PSScriptRoot -Parent
try {
    if (-not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') {
        throw 'This automatic installer supports 64-bit Intel/AMD Windows. ARM64 Windows needs a separate supported ComfyUI installation.'
    }
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    if (-not $InstallRoot) { $InstallRoot = Get-LHInstallRoot }
    $InstallRoot = [IO.Path]::GetFullPath($InstallRoot)
    New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
    $volume = Get-PSDrive -Name ([IO.Path]::GetPathRoot($InstallRoot).Substring(0,1))
    if ($volume.Free -lt 20GB) { throw 'Setup needs about 20 GB of free disk space for downloads, extraction, dependencies and the model.' }
    Write-Host ''
    Write-Host 'LITTLE HIGGY - LOCAL REQUIREMENTS' -ForegroundColor Green
    Write-Host "Installing only into $InstallRoot and the extracted app folder."
    Write-Host 'First run downloads roughly 6-7 GB. No paid API or generation credits are used.'
    Write-Host 'A CPU can run the model, but rendering may be very slow.'
    $cache = Join-Path $InstallRoot 'downloads'
    New-Item -ItemType Directory -Force -Path $cache | Out-Null

    # Private Node LTS runtime. No global Node installation or admin rights needed.
    $headers = @{ 'User-Agent' = 'Little-Higgy-Local-Setup' }
    $releases = Invoke-RestMethod 'https://nodejs.org/dist/index.json' -Headers $headers
    $release = Get-LHNodeRelease $releases
    $filename = "node-$($release.version)-win-x64.zip"
    $sums = (Invoke-WebRequest "https://nodejs.org/dist/$($release.version)/SHASUMS256.txt" -UseBasicParsing).Content
    $nodeHash = Get-LHChecksum $sums $filename
    $nodeZip = Join-Path $cache $filename
    $nodeDir = Join-Path $InstallRoot "node-$($release.version)-win-x64"
    if (-not (Test-Path (Join-Path $nodeDir 'node.exe'))) {
        Get-LHFile "https://nodejs.org/dist/$($release.version)/$filename" $nodeZip $nodeHash
        Expand-Archive -LiteralPath $nodeZip -DestinationPath $InstallRoot -Force
    }
    & (Join-Path $nodeDir 'node.exe') --version
    if ($LASTEXITCODE -ne 0) { throw 'The private Node runtime could not start.' }

    $comfyRoot = Join-Path $InstallRoot 'ComfyUI_windows_portable'
    $reused = $false
    if (Test-LHComfy) {
        $models = Invoke-RestMethod 'http://127.0.0.1:8188/object_info/CheckpointLoaderSimple' -TimeoutSec 5
        $available = @($models.CheckpointLoaderSimple.input.required.ckpt_name[0])
        if ($available.Count -eq 0) { throw 'An existing ComfyUI is running without checkpoints. Stop it to let setup install its own engine, or add a compatible checkpoint to your existing installation first.' }
        $reused = $true
        Write-Host 'Existing ComfyUI detected. Its installation and models will not be changed.'
    }
    $mode = 'cpu'
    if (-not $reused) {
        if (-not (Test-Path (Join-Path $comfyRoot 'python_embeded\python.exe')) -or -not (Test-Path (Join-Path $comfyRoot 'ComfyUI\main.py'))) {
            $comfy = Invoke-RestMethod 'https://api.github.com/repos/Comfy-Org/ComfyUI/releases/latest' -Headers $headers
            $asset = $comfy.assets | Where-Object { $_.name -eq 'ComfyUI_windows_portable_nvidia.7z' } | Select-Object -First 1
            if (-not $asset -or $asset.digest -notmatch '^sha256:([a-fA-F0-9]{64})$') { throw 'The official ComfyUI portable archive or SHA256 digest is unavailable. No unverified package will be installed.' }
            $comfyHash = $Matches[1]
            $archive = Join-Path $cache "$($comfy.tag_name)-$($asset.name)"
            Get-LHFile $asset.browser_download_url $archive $comfyHash
            $stage = Join-Path $InstallRoot ('extract-' + [guid]::NewGuid().ToString('N'))
            Expand-LH7Zip $archive $stage
            $extracted = Join-Path $stage 'ComfyUI_windows_portable'
            if (-not (Test-Path (Join-Path $extracted 'python_embeded\python.exe'))) { throw 'ComfyUI archive layout was unexpected. Nothing was started.' }
            if (Test-Path $comfyRoot) { throw "A partial engine already exists at $comfyRoot. Rename that folder, then rerun setup. Your files have been retained." }
            Move-Item -LiteralPath $extracted -Destination $comfyRoot
            Remove-Item -LiteralPath $stage -Force
        }
        $python = Join-Path $comfyRoot 'python_embeded\python.exe'
        if (-not $CPU) {
            Write-Host 'Testing local NVIDIA/CUDA support...'
            $gpuArgs = @('-s', '-c', '"import torch; assert torch.cuda.is_available(); x=torch.zeros(1,device=''cuda''); print(torch.cuda.get_device_name(0))"')
            $gpuTest = Start-Process -FilePath $python -ArgumentList $gpuArgs -Wait -PassThru -NoNewWindow -RedirectStandardError (Join-Path $InstallRoot 'gpu-check-error.log') -RedirectStandardOutput (Join-Path $InstallRoot 'gpu-check.log')
            if ($gpuTest.ExitCode -eq 0) { $mode = 'cuda' } else { Write-Host 'CUDA was not usable. Using CPU mode; your drivers have not been changed.' }
        }
        # Pinned SD 1.5 checkpoint from its model repository. safetensors avoids pickle execution.
        $modelRevision = '451f4fe16113bff5a5d2269ed5ad43b0592e9a14'
        $modelName = 'v1-5-pruned-emaonly.safetensors'
        $modelHash = '6ce0161689b3853acaa03779ec93eafe75a02f4ced659bee03f50797806fa2fa'
        $checkpoint = Join-Path $comfyRoot "ComfyUI\models\checkpoints\$modelName"
        Write-Host 'Model: Stable Diffusion 1.5 (CreativeML Open RAIL-M license; see MODEL-LICENSES.md).'
        Get-LHFile "https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5/resolve/$modelRevision/$modelName" $checkpoint $modelHash
    }
    $config = @{ SchemaVersion=1; NodeDir=$nodeDir; ComfyRoot=if ($reused) { '' } else { $comfyRoot }; Mode=$mode }
    $config | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $InstallRoot 'runtime.json') -Encoding UTF8
    $env:PATH = "$nodeDir;$env:PATH"
    $env:NEXT_TELEMETRY_DISABLED = '1'
    $env:ELECTRON_SKIP_BINARY_DOWNLOAD = '1'
    Remove-Item Env:NEXT_PUBLIC_LITTLE_HIGGY_PAGES -ErrorAction SilentlyContinue
    Push-Location $sourceRoot
    try {
        if (-not (Test-Path 'node_modules\next\dist\bin\next')) {
            & (Join-Path $nodeDir 'npm.cmd') ci --no-audit --no-fund
            if ($LASTEXITCODE -ne 0) { throw 'App dependency installation failed. Rerun setup after fixing the error above.' }
        }
        & (Join-Path $nodeDir 'npm.cmd') run build
        if ($LASTEXITCODE -ne 0) { throw 'The Little Higgy build failed. See the terminal output above.' }
    } finally { Pop-Location }
    Write-Host 'Local requirements are ready.' -ForegroundColor Green
    if (-not $NoLaunch) { Start-LHServices -SourceRoot $sourceRoot -InstallRoot $InstallRoot }
} catch {
    Write-Host ''
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host 'Setup stopped. Existing model files and installations have been retained.'
    exit 1
}
