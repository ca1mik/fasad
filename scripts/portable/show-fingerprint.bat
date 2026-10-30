@echo off
chcp 65001 >nul
setlocal

rem Показывает отпечаток ЭТОГО компьютера — код, по которому выпускается
rem лицензия. Сборка привязана к одной машине: на другом компьютере сервер
rem не поднимется, пока рядом с backend\.env не ляжет license.key именно
rem для него.
rem
rem Отпечаток можно узнать и из start.bat — он его печатает, когда лицензия
rem не подошла, — но там ради этого надо ждать тридцать секунд и смотреть на
rem сообщение об ошибке. Этот файл просто показывает код сразу.

set "ROOT=%~dp0"
set "PYTHON=%ROOT%python\python.exe"

if not exist "%PYTHON%" (
    echo [!] Не найден python\python.exe — папка python повреждена или отсутствует.
    pause
    exit /b 1
)

echo ==========================================================
echo   Отпечаток этого компьютера
echo ==========================================================
echo.

cd /d "%ROOT%backend"
"%PYTHON%" -c "from app.core.license import machine_fingerprint; print('   ' + machine_fingerprint())"

echo.
echo   Отправьте этот код разработчику — по нему выпускается
echo   license.key для этого компьютера. Готовый файл положите
echo   рядом с backend\.env под именем license.key.
echo ==========================================================
echo.

pause
