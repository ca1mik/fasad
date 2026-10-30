param(
    [switch]$InstallDeps,
    [switch]$ResetDb,
    [switch]$NoServers,
    [switch]$SkipSmoke,
    # Start the channel poll scheduler in inline mode (no Redis/RQ needed).
    # Use it to test the live email channel locally.
    [switch]$WithChannelPoller,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$backendRoot = Join-Path $projectRoot "backend"
$frontendRoot = Join-Path $projectRoot "frontend"
$backendPython = Join-Path $backendRoot ".venv\\Scripts\\python.exe"

function Step {
    param([string]$Text)
    Write-Host ""
    Write-Host "==> $Text" -ForegroundColor Cyan
}

function Ensure-ExampleFile {
    param(
        [string]$Source,
        [string]$Target
    )

    if (-not (Test-Path -LiteralPath $Target)) {
        Copy-Item -LiteralPath $Source -Destination $Target -Force
        Write-Host "Created $Target from example." -ForegroundColor Yellow
    }
}

function Run-Cmd {
    param(
        [string]$WorkDir,
        [string]$Exe,
        [string[]]$CmdArgs
    )

    $cmdText = "{0} {1}" -f $Exe, ($CmdArgs -join " ")
    if ($DryRun) {
        Write-Host ("dry-run: cd {0}; {1}" -f $WorkDir, $cmdText) -ForegroundColor DarkYellow
        return
    }

    Push-Location $WorkDir
    try {
        & $Exe @CmdArgs
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed: $cmdText"
        }
    }
    finally {
        Pop-Location
    }
}

function Ensure-BackendVenv {
    if (Test-Path -LiteralPath $backendPython) {
        return
    }

    Step "Create backend venv"
    if ($DryRun) {
        Write-Host "dry-run: py -m venv .venv" -ForegroundColor DarkYellow
        return
    }

    Push-Location $backendRoot
    try {
        if (Get-Command py -ErrorAction SilentlyContinue) {
            py -m venv .venv
        }
        else {
            python -m venv .venv
        }
    }
    finally {
        Pop-Location
    }
}

function Ensure-BackendPip {
    if ($DryRun) {
        Write-Host "dry-run: ensure backend pip" -ForegroundColor DarkYellow
        return
    }

    try {
        & $backendPython -m pip --version *> $null
    }
    catch {
    }

    if ($LASTEXITCODE -eq 0) {
        return
    }

    Step "Bootstrap pip in backend venv"
    Run-Cmd -WorkDir $backendRoot -Exe $backendPython -CmdArgs @("-m", "ensurepip", "--upgrade")
}

function Test-BackendModule {
    param([string]$ModuleName)

    if ($DryRun) {
        return $true
    }

    try {
        & $backendPython -c "import $ModuleName" *> $null
    }
    catch {
    }

    return $LASTEXITCODE -eq 0
}

function Ensure-BackendDependencies {
    $needsInstall = $InstallDeps -or -not (Test-BackendModule -ModuleName "alembic") -or -not (Test-BackendModule -ModuleName "fastapi")
    if (-not $needsInstall) {
        return
    }

    Step "Install backend dependencies"
    Run-Cmd -WorkDir $backendRoot -Exe $backendPython -CmdArgs @("-m", "pip", "install", "-e", ".[dev]")
}

function Ensure-FrontendDependencies {
    if (-not $InstallDeps -and (Test-Path -LiteralPath (Join-Path $frontendRoot "node_modules"))) {
        return
    }

    Step "Install frontend dependencies"
    Run-Cmd -WorkDir $frontendRoot -Exe "npm.cmd" -CmdArgs @("install")
}

function Set-FrontendLocalEnv {
    # NEXT_PUBLIC_API_URL — относительный путь: браузер (в т.ч. клиента через
    # туннель) ходит на тот же адрес, что открыл, а next.config.ts проксирует
    # /api/v1 на бэкенд. Абсолютный http://localhost:8000 работал бы только на
    # этой же машине — у внешнего клиента "localhost" означает его устройство,
    # и вход всегда падает с "неверный логин или пароль" (см. .env.example).
    $content = @"
NEXT_PUBLIC_API_URL=/api/v1
API_URL=http://localhost:8000/api/v1
"@

    if ($DryRun) {
        Write-Host "dry-run: write frontend/.env.local" -ForegroundColor DarkYellow
        return
    }

    Set-Content -LiteralPath (Join-Path $frontendRoot ".env.local") -Value $content -Encoding UTF8
}

function Set-LocalBackendEnv {
    $env:DATABASE_URL = "sqlite:///./app.db"
    $env:REDIS_URL = "redis://localhost:6379/0"
    $env:CORS_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
}

function Wait-Url {
    param(
        [string]$Url,
        [string]$Name,
        [int]$TimeoutSec = 120
    )

    if ($DryRun) {
        Write-Host ("dry-run: wait {0} -> {1}" -f $Name, $Url) -ForegroundColor DarkYellow
        return
    }

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                Write-Host ("{0} is up: {1}" -f $Name, $Url) -ForegroundColor Green
                return
            }
        }
        catch {
            Start-Sleep -Seconds 2
        }
    }

    throw "Timeout waiting for $Name at $Url"
}

function Start-DevWindow {
    param([string]$Command)

    if ($DryRun) {
        Write-Host ("dry-run: start powershell -> {0}" -f $Command) -ForegroundColor DarkYellow
        return
    }

    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        $Command
    ) | Out-Null
}

function Run-SmokeLogin {
    if ($DryRun) {
        Write-Host "dry-run: smoke login" -ForegroundColor DarkYellow
        return
    }

    $body = @{
        login = "admin"
        password = "admin123"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/auth/login" -Method Post -ContentType "application/json" -Body $body
    if (-not $response.data.token.access_token) {
        throw "Smoke login did not return JWT"
    }
}

Push-Location $projectRoot
try {
    Step "Prepare env files"
    Ensure-ExampleFile -Source ".env.example" -Target ".env"
    Ensure-ExampleFile -Source "backend/.env.example" -Target "backend/.env"
    Ensure-ExampleFile -Source "frontend/.env.example" -Target "frontend/.env.local"
    Set-FrontendLocalEnv

    Ensure-BackendVenv
    Ensure-BackendPip
    Ensure-BackendDependencies
    Ensure-FrontendDependencies

    Step "Prepare local database"
    Set-LocalBackendEnv
    if ($ResetDb -and -not $DryRun) {
        Remove-Item -LiteralPath (Join-Path $backendRoot "app.db") -Force -ErrorAction SilentlyContinue
    }

    Run-Cmd -WorkDir $backendRoot -Exe $backendPython -CmdArgs @(
        "-c",
        "from alembic.config import main; main(argv=['upgrade', 'head'])"
    )
    Run-Cmd -WorkDir $backendRoot -Exe $backendPython -CmdArgs @("scripts/seed.py")

    if (-not $NoServers) {
        Step "Start backend and frontend"

        $backendCommand = @"
Set-Location '$backendRoot'
`$env:DATABASE_URL='sqlite:///./app.db'
`$env:REDIS_URL='redis://localhost:6379/0'
`$env:CORS_ORIGINS='http://localhost:3000,http://127.0.0.1:3000'
& '$backendPython' -m uvicorn app.main:app --reload
"@

        $frontendCommand = @"
Set-Location '$frontendRoot'
npm run dev
"@

        Start-DevWindow -Command $backendCommand
        Start-DevWindow -Command $frontendCommand

        if ($WithChannelPoller) {
            $schedulerCommand = @"
Set-Location '$backendRoot'
`$env:DATABASE_URL='sqlite:///./app.db'
`$env:CHANNEL_POLL_INLINE='true'
& '$backendPython' -m app.workers.scheduler
"@
            Start-DevWindow -Command $schedulerCommand
        }

        Step "Wait for services"
        Wait-Url -Url "http://127.0.0.1:8000/health" -Name "Backend"
        Wait-Url -Url "http://localhost:3000/login" -Name "Frontend"

        if (-not $SkipSmoke) {
            Step "Smoke login"
            Run-SmokeLogin
        }
    }

    Step "Done"
    Write-Host "Frontend: http://localhost:3000/login" -ForegroundColor Green
    Write-Host "Backend docs: http://127.0.0.1:8000/docs" -ForegroundColor Green
    Write-Host "Login: admin / admin123" -ForegroundColor Green
}
finally {
    Pop-Location
}
