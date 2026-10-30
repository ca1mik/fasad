param(
    [switch]$ResetData,
    [switch]$SkipSmoke,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

function Step {
    param([string]$Text)
    Write-Host ""
    Write-Host "==> $Text" -ForegroundColor Cyan
}

function Run-Cmd {
    param(
        [string]$Exe,
        [string[]]$CmdArgs
    )

    $cmdText = "$Exe $($CmdArgs -join ' ')"
    if ($DryRun) {
        Write-Host "[dry-run] $cmdText" -ForegroundColor DarkYellow
        return
    }

    & $Exe @CmdArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $cmdText"
    }
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

function Assert-DockerAvailable {
    if ($DryRun) {
        Write-Host "[dry-run] check docker daemon" -ForegroundColor DarkYellow
        return
    }

    & docker info *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker daemon is not running. Start Docker Desktop and wait until Engine running, then run the script again."
    }
}

function Wait-Url {
    param(
        [string]$Url,
        [string]$Name,
        [int]$TimeoutSec = 180
    )

    if ($DryRun) {
        Write-Host "[dry-run] wait $Name -> $Url" -ForegroundColor DarkYellow
        return
    }

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                Write-Host "$Name is up: $Url" -ForegroundColor Green
                return
            }
        }
        catch {
            Start-Sleep -Seconds 2
        }
    }

    throw "Timeout waiting for $Name at $Url"
}

function Run-SmokeTest {
    param(
        [string]$BackendBaseUrl,
        [string]$FrontendUrl
    )

    if ($DryRun) {
        Write-Host "[dry-run] smoke test -> $BackendBaseUrl" -ForegroundColor DarkYellow
        return
    }

    Step "Smoke test"

    $loginBody = @{
        login = "admin"
        password = "admin123"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$BackendBaseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
    $token = $loginResponse.data.token.access_token
    if (-not $token) {
        throw "Smoke test failed: no token"
    }

    $headers = @{ Authorization = "Bearer $token" }

    $leadBody = @{
        source_channel = "website_form"
        text = "Name: Smoke Test, phone +79990001122, email smoke@example.com, wardrobe 1200x2400x600"
        raw_payload = @{
            form_id = "smoke-1"
        }
    } | ConvertTo-Json -Depth 5

    $leadResponse = Invoke-RestMethod -Uri "$BackendBaseUrl/leads/intake" -Method Post -ContentType "application/json" -Body $leadBody
    $leadId = $leadResponse.data.id
    if (-not $leadId) {
        throw "Smoke test failed: lead not created"
    }

    $orderResponse = Invoke-RestMethod -Uri "$BackendBaseUrl/leads/$leadId/create-order" -Method Post -Headers $headers -ContentType "application/json" -Body "{}"
    $orderId = $orderResponse.data.id
    if (-not $orderId) {
        throw "Smoke test failed: order not created"
    }

    $templatesResponse = Invoke-RestMethod -Uri "$BackendBaseUrl/templates?page=1&size=10" -Headers $headers
    $templateId = $templatesResponse.data[0].id
    if (-not $templateId) {
        throw "Smoke test failed: template not found"
    }

    $itemBody = @{
        template_id = $templateId
        item_type = "wardrobe_basic"
        name = "Smoke wardrobe"
        width = 1200
        height = 2400
        depth = 600
        quantity = 1
    } | ConvertTo-Json -Depth 5

    Invoke-RestMethod -Uri "$BackendBaseUrl/orders/$orderId/items" -Method Post -Headers $headers -ContentType "application/json" -Body $itemBody | Out-Null
    Invoke-RestMethod -Uri "$BackendBaseUrl/orders/$orderId/generate-parts" -Method Post -Headers $headers | Out-Null
    Invoke-RestMethod -Uri "$BackendBaseUrl/orders/$orderId/calculate" -Method Post -Headers $headers | Out-Null
    Invoke-RestMethod -Uri "$BackendBaseUrl/orders/$orderId/export-cutting" -Method Post -Headers $headers | Out-Null
    Invoke-RestMethod -Uri "$BackendBaseUrl/orders/$orderId/generate-cnc" -Method Post -Headers $headers | Out-Null
    Invoke-RestMethod -Uri "$BackendBaseUrl/orders/$orderId/workflow/bootstrap" -Method Post -Headers $headers -ContentType "application/json" -Body "{}" | Out-Null

    $stagesResponse = Invoke-RestMethod -Uri "$BackendBaseUrl/orders/$orderId/stages" -Headers $headers
    if (-not $stagesResponse.data -or $stagesResponse.data.Count -lt 1) {
        throw "Smoke test failed: workflow stages not created"
    }

    Write-Host "Smoke test passed. Order: $orderId" -ForegroundColor Green
    Write-Host "Frontend: $FrontendUrl/login" -ForegroundColor Green
}

Push-Location $projectRoot
try {
    Step "Prepare env files"
    Ensure-ExampleFile -Source ".env.example" -Target ".env"
    Ensure-ExampleFile -Source "backend/.env.example" -Target "backend/.env"
    Ensure-ExampleFile -Source "frontend/.env.example" -Target "frontend/.env.local"

    Step "Check docker"
    Assert-DockerAvailable

    if ($ResetData) {
        Step "Reset docker volumes"
        Run-Cmd -Exe "docker" -CmdArgs @("compose", "down", "-v")
    }

    Step "Build and start containers"
    Run-Cmd -Exe "docker" -CmdArgs @("compose", "up", "--build", "-d")

    Step "Wait for services"
    Wait-Url -Url "http://localhost:8000/health" -Name "Backend"
    Wait-Url -Url "http://localhost:3000/login" -Name "Frontend"

    Step "Run migrations"
    Run-Cmd -Exe "docker" -CmdArgs @("compose", "exec", "-T", "backend", "alembic", "upgrade", "head")

    Step "Seed database"
    Run-Cmd -Exe "docker" -CmdArgs @("compose", "exec", "-T", "backend", "python", "scripts/seed.py")

    Step "Run backend tests"
    Run-Cmd -Exe "docker" -CmdArgs @("compose", "exec", "-T", "backend", "pytest", "-q")

    if (-not $SkipSmoke) {
        Run-SmokeTest -BackendBaseUrl "http://127.0.0.1:8000/api/v1" -FrontendUrl "http://localhost:3000"
    }

    Step "Done"
    Write-Host "Frontend: http://localhost:3000/login" -ForegroundColor Green
    Write-Host "Backend docs: http://localhost:8000/docs" -ForegroundColor Green
    Write-Host "Login: admin / admin123" -ForegroundColor Green
}
finally {
    Pop-Location
}
