<#
    Public HTTPS tunnel to a local service (cloudflared quick tunnel).
    Needed for inbound webhooks (Telegram / WhatsApp) and for opening
    mobile scan pages from a phone outside the LAN.

    Examples:
        ./scripts/run-tunnel.ps1 -Port 3000     # share the whole app: one link, frontend
                                                # proxies /api/v1 to the backend itself
        ./scripts/run-tunnel.ps1                # backend only (127.0.0.1:8000), raw API
        ./scripts/run-tunnel.ps1 -PrintUrlOnly  # print URL, leave tunnel running detached

    Port 3000 needs the frontend running (npm run build && npm run start) and the
    backend on 8000; see next.config.ts rewrites.
#>
param(
    [int]$Port = 8000,
    [string]$TargetHost = "127.0.0.1",
    # File that receives the current public URL (handy for other scripts).
    [string]$UrlFile = "",
    [switch]$PrintUrlOnly,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $UrlFile) {
    $UrlFile = Join-Path $projectRoot ".tunnel-url"
}

function Step {
    param([string]$Text)
    Write-Host ""
    Write-Host "==> $Text" -ForegroundColor Cyan
}

function Resolve-Cloudflared {
    $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    $candidates = @(
        "C:\Program Files (x86)\cloudflared\cloudflared.exe",
        "C:\Program Files\cloudflared\cloudflared.exe"
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    throw "cloudflared not found. Install it: winget install --id Cloudflare.cloudflared"
}

$cloudflared = Resolve-Cloudflared
$target = "http://{0}:{1}" -f $TargetHost, $Port

Step "Probe local service $target"
try {
    $probe = Invoke-WebRequest -Uri $target -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    Write-Host ("Local service responded: HTTP {0}" -f $probe.StatusCode) -ForegroundColor Green
}
catch {
    Write-Host "Local service on $target is not responding; the tunnel will serve 502." -ForegroundColor Yellow
    Write-Host "Start the stack first: ./scripts/run-local.ps1" -ForegroundColor Yellow
}

Step "Start quick tunnel to $target"
if ($DryRun) {
    Write-Host ("dry-run: {0} tunnel --url {1} --no-autoupdate" -f $cloudflared, $target) -ForegroundColor DarkYellow
    return
}

$logFile = Join-Path $env:TEMP ("fasad-tunnel-{0}.log" -f $Port)
if (Test-Path -LiteralPath $logFile) {
    Remove-Item -LiteralPath $logFile -Force
}

$process = Start-Process -FilePath $cloudflared `
    -ArgumentList @("tunnel", "--url", $target, "--no-autoupdate", "--logfile", $logFile) `
    -PassThru -WindowStyle Hidden

$publicUrl = $null
for ($i = 0; $i -lt 60; $i++) {
    if (Test-Path -LiteralPath $logFile) {
        $match = Select-String -Path $logFile -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($match) {
            $publicUrl = $match.Matches[0].Value
            break
        }
    }
    if ($process.HasExited) {
        throw "cloudflared exited with code $($process.ExitCode). Log: $logFile"
    }
    Start-Sleep -Milliseconds 500
}

if (-not $publicUrl) {
    try { $process.Kill() } catch {}
    throw "No public URL after 30 seconds. Log: $logFile"
}

Set-Content -LiteralPath $UrlFile -Value $publicUrl -Encoding utf8

Write-Host ""
Write-Host "Public URL: $publicUrl" -ForegroundColor Green
if ($Port -eq 3000) {
    Write-Host "  app (send this):   $publicUrl"
    Write-Host "  login page:        $publicUrl/login"
}
else {
    Write-Host "  health:            $publicUrl/health"
}
Write-Host "  API:               $publicUrl/api/v1"
Write-Host "  Telegram webhook:  $publicUrl/api/v1/messaging/telegram/bot/webhook"
Write-Host "  WhatsApp webhook:  $publicUrl/api/v1/messaging/whatsapp/webhook"
Write-Host ""
Write-Host "URL saved to $UrlFile. cloudflared PID: $($process.Id)"
Write-Host "Stop it with: Stop-Process -Id $($process.Id)"

if ($PrintUrlOnly) {
    return
}

Write-Host ""
Write-Host "Tunnel is up. Press Ctrl+C to stop." -ForegroundColor Cyan
try {
    Wait-Process -Id $process.Id
}
finally {
    if (-not $process.HasExited) {
        try { $process.Kill() } catch {}
    }
    if (Test-Path -LiteralPath $UrlFile) {
        Remove-Item -LiteralPath $UrlFile -Force -ErrorAction SilentlyContinue
    }
}
