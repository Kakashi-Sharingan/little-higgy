$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path $PSScriptRoot -Parent
foreach ($script in Get-ChildItem (Join-Path $root 'windows') -Filter '*.ps1') {
    $parseErrors = $null
    $tokens = $null
    [System.Management.Automation.Language.Parser]::ParseFile($script.FullName, [ref]$tokens, [ref]$parseErrors) | Out-Null
    if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
}
. (Join-Path $root 'windows\Requirements.ps1')
function Assert-LH([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message }; Write-Host "PASS: $Message" }
$releases = @([pscustomobject]@{version='v26.0.0';lts='New'}, [pscustomobject]@{version='v24.22.2';lts='Krypton'}, [pscustomobject]@{version='v24.22.1';lts='Krypton'})
Assert-LH ((Get-LHNodeRelease $releases).version -eq 'v24.22.2') 'Selects latest supported Node 24 LTS, not an untested newer major'
$hash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
$sum = Get-LHChecksum "$hash  node-v24.22.2-win-x64.zip`r`n" 'node-v24.22.2-win-x64.zip'
Assert-LH ($sum -eq $hash) 'Matches the exact official checksum filename'
$failed = $false
try { Get-LHChecksum "$hash  wrong.zip" 'node-v24.22.2-win-x64.zip' } catch { $failed = $true }
Assert-LH $failed 'Rejects missing official checksums'
$folder = Join-Path $env:TEMP ('lh-setup-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $folder | Out-Null
try {
    $file = Join-Path $folder 'verified.txt'
    Set-Content -LiteralPath $file -Value 'local test fixture' -NoNewline
    $expected = (Get-FileHash $file -Algorithm SHA256).Hash
    Assert-LH (Test-LHHash $file $expected) 'Verifies file bytes by SHA256'
    Assert-LH (-not (Test-LHHash $file $hash)) 'Detects modified or corrupt files'
    Get-LHFile 'https://example.invalid/not-requested' $file $expected
    Assert-LH (Test-Path $file) 'Reuses verified downloads without a network request'
    $failed = $false
    try { Get-LHFile 'http://example.invalid/not-requested' $file $hash } catch { $failed = $true }
    Assert-LH $failed 'Rejects unencrypted download URLs'
    $failed = $false
    try { Get-LHFile 'https://example.invalid/not-requested' $file 'invalid' } catch { $failed = $true }
    Assert-LH $failed 'Rejects downloads without a valid hash'
    $port = Get-LHFreePort -First 39410 -Last 39420
    Assert-LH ($port -ge 39410 -and $port -le 39420) 'Finds and releases a local TCP port'
    $destination = Join-Path $folder 'unpacked'
    Expand-LH7Zip -Archive (Join-Path $root 'tests\fixtures\setup-sample.7z') -Destination $destination -TarOnly
    Assert-LH ((Get-Content (Join-Path $destination 'setup-fixture.txt') -Raw).Trim() -eq 'Little Higgy archive test') 'Built-in Windows tar extracts the portable archive format'
} finally { Remove-Item -LiteralPath $folder -Recurse -Force }
Write-Host 'Windows installer helper tests passed. No engine or model downloads were performed.'
