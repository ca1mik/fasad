param([Parameter(Mandatory = $true)][string]$Target)

$ErrorActionPreference = 'Stop'
$targetPath = [IO.Path]::GetFullPath($Target).TrimEnd('\')
$sourcePath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'frontend'))
$frontendPath = Join-Path $targetPath 'frontend'
if (-not (Test-Path -LiteralPath (Join-Path $targetPath 'backend'))) {
    throw "Fasad backend is missing: $targetPath"
}
if (-not (Test-Path -LiteralPath (Join-Path $frontendPath 'server.js'))) {
    throw "Fasad frontend is missing: $frontendPath"
}
if (-not (Test-Path -LiteralPath (Join-Path $sourcePath 'server.js'))) {
    throw "Update payload is missing: $sourcePath"
}

# Every path used for a directory move is derived from and checked against the
# selected portable folder. The database, backend and license are never moved.
$rootPrefix = $targetPath + '\'
$stagePath = Join-Path $targetPath ('frontend-update-' + [guid]::NewGuid().ToString('N'))
$backupPath = Join-Path $targetPath ('frontend-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
foreach ($path in @($frontendPath, $stagePath, $backupPath)) {
    $fullPath = [IO.Path]::GetFullPath($path)
    if (-not $fullPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Unsafe update path: $fullPath"
    }
}
if (Test-Path -LiteralPath $backupPath) {
    throw "Backup already exists: $backupPath"
}

Write-Host 'Copying new frontend...'
New-Item -ItemType Directory -Path $stagePath | Out-Null
& robocopy $sourcePath $stagePath /E /NFL /NDL /NJH /NJS /NC /NS | Out-Null
if ($LASTEXITCODE -ge 8) {
    throw "Copy failed (robocopy exit $LASTEXITCODE); current frontend was not changed."
}
if (-not (Test-Path -LiteralPath (Join-Path $stagePath 'server.js'))) {
    throw 'Staged frontend has no server.js.'
}

Write-Host 'Stopping Fasad processes from the selected folder...'
Get-CimInstance Win32_Process | Where-Object {
    $_.ExecutablePath -and $_.ExecutablePath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)
} | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

Write-Host 'Replacing frontend...'
Move-Item -LiteralPath $frontendPath -Destination $backupPath
try {
    Move-Item -LiteralPath $stagePath -Destination $frontendPath
} catch {
    Move-Item -LiteralPath $backupPath -Destination $frontendPath
    throw
}
Write-Host "Update installed. Previous frontend: $backupPath"
foreach ($scriptName in @('start.bat', 'stop.bat', 'show-fingerprint.bat')) {
    $scriptPath = Join-Path $PSScriptRoot $scriptName
    if (Test-Path -LiteralPath $scriptPath) {
        Copy-Item -LiteralPath $scriptPath -Destination (Join-Path $targetPath $scriptName) -Force
    }
}

# The signed key belongs to one specific computer. Copy it only when the
# portable Python reports the matching fingerprint; other installations keep
# their own license untouched.
$licensePath = Join-Path $PSScriptRoot 'manager-server-license.key'
$pythonPath = Join-Path $targetPath 'python\python.exe'
if ((Test-Path -LiteralPath $licensePath) -and (Test-Path -LiteralPath $pythonPath)) {
    $expected = (Get-Content -LiteralPath $licensePath -Raw | ConvertFrom-Json).fingerprint
    Push-Location (Join-Path $targetPath 'backend')
    try {
        $actual = ((& $pythonPath -c 'from app.core.license import machine_fingerprint; print(machine_fingerprint())' | Select-Object -Last 1) | Out-String).Trim()
        $fingerprintOk = $LASTEXITCODE -eq 0
    } catch {
        $actual = ''
        $fingerprintOk = $false
    } finally {
        Pop-Location
    }
    if ($fingerprintOk -and $actual -eq $expected) {
        Copy-Item -LiteralPath $licensePath -Destination (Join-Path $targetPath 'backend\license.key') -Force
        Write-Host 'Manager server license installed.'
    } else {
        Write-Host 'License belongs to another PC; existing license was not changed.'
    }
}
Write-Host 'Run start.bat in the portable folder.'
