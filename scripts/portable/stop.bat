@echo off
chcp 65001 >nul
setlocal

rem Останавливает сервер и интерфейс, запущенные start.bat.
rem
rem Ищем процессы по пути к файлу, а не по заголовку окна.
rem
rem По заголовку не работает: Next.js при старте переименовывает своё консольное
rem окно в «next-server (v15.5.14)», затирая заданное нами «Fasad — интерфейс».
rem taskkill такое окно не находил, и интерфейс продолжал висеть на порту 3000
rem даже после «Остановлено» — а следующий запуск падал на занятом порту.
rem
rem Путь надёжнее ещё и тем, что бьёт ровно по этой папке: node.exe и python.exe
rem из других проектов на компьютере не трогаются, даже если запущены.

set "FASAD_ROOT=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$root = $env:FASAD_ROOT; $found = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) }); foreach ($p in $found) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }; if ($found.Count) { Write-Host ('Остановлено процессов: ' + $found.Count) } else { Write-Host 'Система не запущена — останавливать нечего.' }"

rem Окна-обёртки закрываются сами, как только внутри них завершился сервер.
rem Заголовок «Fasad — сервер» переживает запуск, поэтому на всякий случай
rem добиваем и по нему: если окно почему-то осталось пустым, оно закроется.
taskkill /FI "WINDOWTITLE eq Fasad — сервер*" /T /F >nul 2>&1

pause
