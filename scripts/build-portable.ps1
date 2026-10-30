<#
    Портативная сборка Fasad Production Platform — папка, которую можно
    скопировать на флешку, перенести на другой Windows-компьютер и запустить
    без установки Python, Node.js или чего-либо ещё.

    Заказчик: «чтобы я сегодня с флешки кинул это всё на комп и оно работало
    без настройки зависимостей».

    Как это работает:
    - backend ставится в embeddable Python (python.org, zip без инсталлятора) —
      настоящей установкой (`pip install .`, не editable), поэтому не зависит
      от пути, где стоит venv на машине разработчика;
    - frontend собирается с `output: "standalone"` (next.config.ts) — Next.js
      сам упаковывает минимальный node_modules и один `server.js`, который
      запускается голым `node.exe` без `npm install`;
    - оба рантайма (python.exe, node.exe) кладутся рядом как есть — им
      никакая установка не нужна, это и есть смысл словосочетания «embeddable».

    Результат — папка -Destination (по умолчанию ..\..\fasad-portable рядом
    с проектом), готовая к копированию. Внутри: python/, node/, backend/,
    frontend/, start.bat, stop.bat.

    Проверено переносом собранной папки на другой путь (не только на другой
    диск) — сервер и интерфейс поднимаются и работают с тем же app.db.
#>
param(
    [string]$Destination = "",
    [string]$PythonVersion = "3.12.10",
    [string]$NodeVersion = "20.18.0",
    [switch]$SkipSeed,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $Destination) {
    $Destination = Join-Path (Split-Path $projectRoot -Parent) "fasad-portable"
}

function Step {
    param([string]$Text)
    Write-Host ""
    Write-Host "==> $Text" -ForegroundColor Cyan
}

# Windows PowerShell 5.1 оборачивает КАЖДУЮ строку stderr внешней программы в
# NativeCommandError, даже когда программа завершилась нулевым кодом — а pip,
# alembic (logging module) и npm пишут обычные информационные строки именно
# в stderr. При глобальном $ErrorActionPreference = "Stop" (см. выше) первая
# такая строка убивала всю сборку, хотя команда реально отработала успешно.
# Настоящая ошибка определяется по $LASTEXITCODE, а не по самому факту вывода
# в stderr.
function Invoke-Native {
    param(
        [Parameter(Mandatory)][scriptblock]$Script,
        [string]$ErrorMessage = "Внешняя команда завершилась с ошибкой"
    )
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & $Script
        if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
            throw "$ErrorMessage (exit code $LASTEXITCODE)"
        }
        return $output
    } finally {
        $ErrorActionPreference = $previous
    }
}

function Remove-DirectoryWithRetry {
    <#
    Снос старой папки перед копией поверх неё (backend\app, frontend,
    frontend-src) — то есть ровно те моменты, когда антивирус ещё держит
    открытым файл, который сам только что дописал (индексирует свежескачанный
    npm install или только что собранный .next). Без ретрая сборка падала на
    ровном месте и её приходилось перезапускать руками — то на одной папке,
    то на другой, по очереди.
    #>
    param([string]$Path, [int]$Attempts = 5, [int]$DelayMs = 1000)
    for ($i = 1; $i -le $Attempts; $i++) {
        try {
            Remove-Item -Recurse -Force $Path -ErrorAction Stop
            return
        } catch {
            if ($i -eq $Attempts) { throw }
            Write-Host "  [!] Папка $Path занята (попытка $i/$Attempts) — жду и пробую снова" -ForegroundColor Yellow
            Start-Sleep -Milliseconds $DelayMs
        }
    }
}

if ($DryRun) {
    Write-Host "dry-run: собрал бы портативную версию в $Destination" -ForegroundColor DarkYellow
    return
}

New-Item -ItemType Directory -Force -Path $Destination | Out-Null
$pythonDir = Join-Path $Destination "python"
$nodeDir = Join-Path $Destination "node"
$backendDir = Join-Path $Destination "backend"
$frontendBuildDir = Join-Path $Destination "frontend-src"
$frontendDir = Join-Path $Destination "frontend"

# --- 1. Embeddable Python -----------------------------------------------
if (-not (Test-Path (Join-Path $pythonDir "python.exe"))) {
    Step "Скачиваю embeddable Python $PythonVersion"
    $pyZip = Join-Path $Destination "python-embed.zip"
    Invoke-WebRequest -Uri "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-embed-amd64.zip" -OutFile $pyZip
    New-Item -ItemType Directory -Force -Path $pythonDir | Out-Null
    Expand-Archive -Path $pyZip -DestinationPath $pythonDir -Force
    Remove-Item $pyZip

    # Embeddable-сборка по умолчанию не запускает site.main() и не видит
    # site-packages — без этого pip и сам fasad-backend не импортируются.
    $pthFile = Get-ChildItem $pythonDir -Filter "python3*._pth" | Select-Object -First 1
    @"
python312.zip
.
Lib
Lib\site-packages

import site
"@ | Set-Content -LiteralPath $pthFile.FullName -Encoding ASCII

    Step "Ставлю pip"
    $getPip = Join-Path $Destination "get-pip.py"
    Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $getPip
    Invoke-Native { & (Join-Path $pythonDir "python.exe") $getPip --no-warn-script-location } "Установка pip не удалась"
    Remove-Item $getPip
    Invoke-Native {
        & (Join-Path $pythonDir "python.exe") -m pip install --no-warn-script-location setuptools wheel
    } "pip install setuptools wheel не удался"

    # Embeddable-zip несёт vcruntime140[.dll/_1.dll] — этого одного НЕ
    # хватает. Компилированные колёса (cryptography, bcrypt, psycopg-binary,
    # pydantic-core и другие — то есть буквально всё, включая валидацию
    # запросов в FastAPI) собраны MSVC и тянут ещё msvcp140.dll/concrt140.dll,
    # которых в embeddable-пакете нет. На машине разработки они почти
    # наверняка стоят (System32) — на «голой» целевой машине без единой ранее
    # поставленной программы их может не быть вовсе, и backend не запустится
    # ни строчкой лога, просто DLL not found при первом же import cryptography.
    # Кладём рядом с python.exe: Windows ищет DLL сначала в папке самого exe,
    # и только потом в System32 — так это работает независимо от того, что
    # (не) стоит на целевой машине. Это официально задокументированный способ
    # «app-local deployment» самой Microsoft, не самодеятельность.
    Step "Докладываю недостающие DLL из VC++ Redistributable (msvcp140, concrt140)"
    $system32 = "$env:WINDIR\System32"
    foreach ($dll in @("msvcp140.dll", "concrt140.dll", "vcruntime140_1.dll", "vcruntime140_threads.dll")) {
        $source = Join-Path $system32 $dll
        if (Test-Path $source) {
            Copy-Item -Force $source (Join-Path $pythonDir $dll)
        } else {
            Write-Host "  [!] $dll не найден в $system32 — на этой машине его тоже нет, портативная сборка рискует не запуститься на целевой" -ForegroundColor Yellow
        }
    }
}

# --- 2. Backend: код + настоящая (не editable) установка -----------------
Step "Копирую backend"
New-Item -ItemType Directory -Force -Path $backendDir | Out-Null
foreach ($item in @("app", "alembic", "scripts", "pyproject.toml", "alembic.ini", ".env.example")) {
    $source = Join-Path $projectRoot "backend\$item"
    if (-not (Test-Path $source)) { continue }
    $target = Join-Path $backendDir $item
    if ((Get-Item $source).PSIsContainer -and (Test-Path $target)) {
        # Copy-Item -Recurse в УЖЕ СУЩЕСТВУЮЩУЮ папку кладёт исходник ВНУТРЬ
        # неё (получилось бы backend\app\app\...), а не поверх — из-за этого
        # backend\app физически не обновлялся ни разу с самой первой сборки,
        # сколько раз этот скрипт ни запускали. Сносим папку перед копией.
        Remove-DirectoryWithRetry -Path $target
    }
    Copy-Item -Recurse -Force $source $target
}
Get-ChildItem $backendDir -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

Step "Ставлю backend в embeddable Python (обычной установкой, не editable)"
$pipOutput = Invoke-Native {
    & (Join-Path $pythonDir "python.exe") -m pip install --no-warn-script-location (Join-Path $backendDir ".")
} "pip install backend не удался"
$pipOutput | Select-Object -Last 5

$envFile = Join-Path $backendDir ".env"
if (-not (Test-Path $envFile)) {
    Step "Пишу .env с новыми случайными секретами"
    $jwtKey = Invoke-Native {
        & (Join-Path $pythonDir "python.exe") -c "import secrets; print(secrets.token_urlsafe(48))"
    } "Генерация JWT_SECRET_KEY не удалась"
    $channelKey = Invoke-Native {
        & (Join-Path $pythonDir "python.exe") -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    } "Генерация CHANNEL_SECRET_KEY не удалась"
    @"
APP_NAME=Fasad Production Platform
ENVIRONMENT=production
DEBUG=false
DATABASE_URL=sqlite:///./app.db
REDIS_URL=redis://localhost:6379/0
JWT_SECRET_KEY=$jwtKey
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
CORS_ORIGINS=http://localhost:3001,http://127.0.0.1:3001
LOCAL_STORAGE_PATH=./storage_data
DEFAULT_CURRENCY=RUB
FIRST_SUPERUSER_LOGIN=admin
FIRST_SUPERUSER_PASSWORD=admin123
CHANNEL_SECRET_KEY=$channelKey
LICENSE_LOCK_ENABLED=true
LICENSE_FILE_PATH=./license.key
CHANNEL_POLL_DEFAULT_INTERVAL_SECONDS=120
CHANNEL_POLL_MIN_INTERVAL_SECONDS=30
CHANNEL_SCHEDULER_TICK_SECONDS=15
CHANNEL_POLL_INLINE=true
EMAIL_POLL_BATCH_LIMIT=25
EMAIL_MAX_ATTACHMENT_MB=15
EMAIL_CONNECT_TIMEOUT_SECONDS=20
ORDER_FILE_MAX_MB=25
OUTREACH_SIGNATURE=
OUTREACH_DAILY_LIMIT=25
"@ | Set-Content -LiteralPath $envFile -Encoding UTF8
}

Step "Миграции"
Push-Location $backendDir
try {
    Invoke-Native {
        & (Join-Path $pythonDir "python.exe") -c "from alembic.config import main; main(argv=['upgrade', 'head'])"
    } "Миграции alembic не прошли"
    if (-not $SkipSeed -and -not (Test-Path (Join-Path $backendDir "app.db"))) {
        Step "Сид демо-данных"
        Invoke-Native { & (Join-Path $pythonDir "python.exe") "scripts/seed.py" } "Сид демо-данных не прошёл"
    }
} finally {
    Pop-Location
}

# --- 3. Portable Node.js ---------------------------------------------------
if (-not (Test-Path (Join-Path $nodeDir "node.exe"))) {
    Step "Скачиваю portable Node.js $NodeVersion"
    $nodeZip = Join-Path $Destination "node.zip"
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip" -OutFile $nodeZip
    Expand-Archive -Path $nodeZip -DestinationPath $Destination -Force
    Rename-Item (Join-Path $Destination "node-v$NodeVersion-win-x64") "node"
    Remove-Item $nodeZip
}

# --- 4. Frontend: standalone-сборка в отдельной копии ----------------------
# Отдельная копия исходников и своя .next — чтобы сборка не задела .next
# уже запущенного `npm run dev` в основном проекте (однажды так уже уронило
# живой dev-сервер).
Step "Копирую frontend"
# robocopy у своих кодов возврата: 0-7 — разные виды успеха ("скопировано",
# "лишнее удалено" и т.п.), 8+ — реальная ошибка. Это не $LASTEXITCODE -ne 0
# как для обычных программ.
$previousEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& robocopy (Join-Path $projectRoot "frontend") $frontendBuildDir /E /XD node_modules .next /NFL /NDL /NJH /NJS /NC /NS | Out-Null
$robocopyExit = $LASTEXITCODE
$ErrorActionPreference = $previousEap
if ($robocopyExit -ge 8) {
    throw "robocopy копирования frontend завершился с ошибкой (код $robocopyExit)"
}

$configPath = Join-Path $frontendBuildDir "next.config.ts"
$config = Get-Content -Raw $configPath
if ($config -notmatch 'output:\s*"standalone"') {
    $config = $config -replace 'const nextConfig: NextConfig = \{', "const nextConfig: NextConfig = {`n  output: `"standalone`","
    Set-Content -LiteralPath $configPath -Value $config -Encoding UTF8
}

Step "npm install (портативным node)"
$env:PATH = "$nodeDir;$env:PATH"
Push-Location $frontendBuildDir
try {
    $npmCli = Join-Path $nodeDir "node_modules\npm\bin\npm-cli.js"
    Invoke-Native { & (Join-Path $nodeDir "node.exe") $npmCli install } "npm install не удался"
    Step "npm run build"
    Invoke-Native { & (Join-Path $nodeDir "node.exe") $npmCli run build } "npm run build не удался"
} finally {
    Pop-Location
}

Step "Собираю standalone-папку"
# Та же беда, что чинили для backend\app: Copy-Item -Recurse в УЖЕ
# СУЩЕСТВУЮЩУЮ папку кладёт исходник ВНУТРЬ нее, а не поверх. На повторной
# сборке (frontend\ уже есть от прошлого раза) это давало
# frontend\.next\static\static\... — сервер ищет чанки по BUILD_ID на один
# уровень выше, чем они реально лежат, и в браузере всё падает на 404 по
# JS/CSS при внешне живом старте сервера. Поэтому здесь всегда чистый снос
# перед копией, а не merge поверх старого.
if (Test-Path $frontendDir) {
    Remove-DirectoryWithRetry -Path $frontendDir
}
New-Item -ItemType Directory -Force -Path $frontendDir | Out-Null
Copy-Item -Recurse -Force (Join-Path $frontendBuildDir ".next\standalone\*") $frontendDir
New-Item -ItemType Directory -Force -Path (Join-Path $frontendDir ".next") | Out-Null
Copy-Item -Recurse -Force (Join-Path $frontendBuildDir ".next\static") (Join-Path $frontendDir ".next\static")
if (Test-Path (Join-Path $frontendBuildDir "public")) {
    Copy-Item -Recurse -Force (Join-Path $frontendBuildDir "public") (Join-Path $frontendDir "public")
}
Remove-DirectoryWithRetry -Path $frontendBuildDir

# --- 5. Скрипты запуска -----------------------------------------------------
Step "Копирую start.bat / stop.bat / show-fingerprint.bat / unblock.ps1"
Copy-Item -Force (Join-Path $PSScriptRoot "portable\start.bat") (Join-Path $Destination "start.bat")
Copy-Item -Force (Join-Path $PSScriptRoot "portable\stop.bat") (Join-Path $Destination "stop.bat")
# Отпечаток машины нужен до первого удачного запуска: сборка привязана к
# компьютеру, и на новой машине сервер не поднимется, пока не придёт license.key
# именно для неё. Без этого файла код приходилось выуживать из ошибки start.bat.
Copy-Item -Force (Join-Path $PSScriptRoot "portable\show-fingerprint.bat") (Join-Path $Destination "show-fingerprint.bat")
Copy-Item -Force (Join-Path $PSScriptRoot "portable\unblock.ps1") (Join-Path $Destination "unblock.ps1")

Step "Готово"
Write-Host "Портативная сборка: $Destination" -ForegroundColor Green
Write-Host "Запуск: $Destination\start.bat" -ForegroundColor Green
