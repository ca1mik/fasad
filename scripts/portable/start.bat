@echo off
chcp 65001 >nul
rem Обычный setlocal, без enabledelayedexpansion: с ним cmd съедает «!» прямо
rem в тексте echo, и все сообщения «[!] …» печатались как «[] …».
setlocal

rem Fasad Production Platform — портативный запуск.
rem Работает из любой папки и с любой буквы диска: все пути ниже
rem строятся от расположения этого файла (%~dp0), а не зашиты заранее.
rem Ничего ставить не нужно — python\ и node\ уже внутри этой папки.
rem
rem Система открывается и на этом компьютере (localhost), и с любого другого
rem ПК локальной сети — по адресу этого компьютера. Адрес НЕ зашит в файл:
rem он определяется при каждом запуске, поэтому смена IP роутером ничего
rem не ломает и один и тот же start.bat годится для любого компьютера.

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "FRONTEND_DIR=%ROOT%frontend"
set "PYTHON=%ROOT%python\python.exe"
set "NODE=%ROOT%node\node.exe"
set "BACKEND_LOG=%BACKEND_DIR%\server.log"

set "BACKEND_PORT=8000"
rem Порт интерфейса. 3000 занимать нельзя: на нём часто висит что-то ещё
rem (dev-сервер соседнего проекта), и тогда «localhost» уводит не туда —
rem Windows сначала пробует IPv6, а Next.js слушает только IPv4.
set "FRONTEND_PORT=3001"

rem Адрес этого компьютера в локальной сети — по нему систему открывают с
rem других ПК. Пустое значение = определить автоматически. Вписывать адрес
rem руками нужно только если в компьютере несколько сетевых карт и
rem автоопределение выбрало не ту (например, при включённом VPN).
set "LAN_IP="

echo ==========================================================
echo   Fasad Production Platform
echo ==========================================================
echo.

if not exist "%PYTHON%" (
    echo [!] Не найден python\python.exe — папка python повреждена или отсутствует.
    pause
    exit /b 1
)
if not exist "%NODE%" (
    echo [!] Не найден node\node.exe — папка node повреждена или отсутствует.
    pause
    exit /b 1
)

rem Не принимай чужой процесс на занятом порту за успешно запущенный Fasad.
"%PYTHON%" -c "import socket; s=socket.socket(); s.bind(('127.0.0.1', %BACKEND_PORT%)); s.close()" 2>nul
if errorlevel 1 (
    echo [!] Порт %BACKEND_PORT% занят. Остановите прежний сервер или другую программу.
    pause
    exit /b 1
)

rem Стандартные пароли из демо-базы нельзя выставлять в локальную сеть.
rem Пока их не сменили, интерфейс слушает только этот компьютер.
pushd "%BACKEND_DIR%"
set "PYTHONIOENCODING=utf-8"
"%PYTHON%" -m app.core.lan_credentials
if errorlevel 1 set "LAN_ONLY=1"
popd
if defined LAN_ONLY echo [!] Доступ из сети закрыт до смены стандартных паролей.
set "FRONTEND_HOST=0.0.0.0"
if defined LAN_ONLY set "FRONTEND_HOST=127.0.0.1"
"%PYTHON%" -c "import socket; s=socket.socket(); s.bind(('%FRONTEND_HOST%', %FRONTEND_PORT%)); s.close()" 2>nul
if errorlevel 1 (
    echo [!] Порт %FRONTEND_PORT% занят. Остановите прежний интерфейс или другую программу.
    pause
    exit /b 1
)

if exist "%ROOT%unblock.ps1" (
    echo [1/4] Снимаю блокировку Windows со всех файлов папки...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%unblock.ps1" -Path "%ROOT:~0,-1%" >nul 2>&1
)

rem ---------------------------------------------------------------------------
rem Адрес в локальной сети.
rem
rem Берём адрес только физической сетевой карты (Ethernet/Wi-Fi) из частного
rem диапазона. Виртуальные адаптеры отбрасываем намеренно: у VPN метрика
rem маршрута обычно ниже, чем у настоящей карты, и «главным» адресом машины
rem оказался бы адрес туннеля (10.x), по которому из офисной сети никто
rem не достучится. При прочих равных предпочитаем карту со шлюзом.
rem ---------------------------------------------------------------------------
rem Команда ниже намеренно написана без конвейеров и вся в одну строку: этот
rem for/f разбирает сначала cmd, и `|` внутри него оборвал бы команду на
rem половине. По той же причине detection вынесен из скобок if — круглые
rem скобки PowerShell внутри блока `if (...)` cmd считает своими и ломает
rem разбор (получали пустой адрес).
echo [2/4] Определяю адрес компьютера в локальной сети...
if defined LAN_IP goto :ip_ready
for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$g=@(); foreach($c in Get-NetIPConfiguration){ if($c.IPv4DefaultGateway){ $g+=$c.InterfaceIndex } }; $p=@(); foreach($a in Get-NetAdapter -Physical){ if($a.Status -eq 'Up'){ $p+=$a.ifIndex } }; $best=''; $bm=999999; foreach($i in Get-NetIPAddress -AddressFamily IPv4){ if($p -notcontains $i.InterfaceIndex){continue}; $o=$i.IPAddress.Split('.'); $a0=[int]$o[0]; $a1=[int]$o[1]; if(-not(($a0 -eq 10) -or ($a0 -eq 192 -and $a1 -eq 168) -or ($a0 -eq 172 -and $a1 -ge 16 -and $a1 -le 31))){continue}; $m=[int]$i.InterfaceMetric; if($g -notcontains $i.InterfaceIndex){$m+=100000}; if($m -lt $bm){$bm=$m; $best=$i.IPAddress} }; $best" 2^>nul`) do set "LAN_IP=%%i"
:ip_ready
if defined LAN_IP goto :ip_found
echo     [!] Сетевая карта не найдена — система будет доступна только
echo         на этом компьютере, по адресу localhost.
goto :ip_done

:ip_found
echo     Адрес этого компьютера: %LAN_IP%

:ip_done

rem ---------------------------------------------------------------------------
rem Правило брандмауэра на порт интерфейса.
rem
rem Без него Windows молча режет входящие подключения, и с других ПК страница
rem просто не открывается — без единого сообщения об ошибке. Добавить правило
rem может только администратор, поэтому если прав нет — не падаем, а печатаем
rem готовую команду: её достаточно выполнить один раз на этом компьютере.
rem ---------------------------------------------------------------------------
rem Имя правила содержит порт намеренно: сменится порт — прежнее правило уже не
rem подойдёт, а проверка по общему имени «нашла» бы его и новое не добавилось.
if not defined LAN_IP goto :firewall_done
if defined LAN_ONLY goto :firewall_done
netsh advfirewall firewall show rule name="Fasad UI %FRONTEND_PORT%" >nul 2>&1
if not errorlevel 1 goto :firewall_done
net session >nul 2>&1
if errorlevel 1 goto :firewall_no_admin
netsh advfirewall firewall add rule name="Fasad UI %FRONTEND_PORT%" dir=in action=allow protocol=TCP localport=%FRONTEND_PORT% >nul 2>&1
if errorlevel 1 goto :firewall_no_admin
echo     Правило брандмауэра на порт %FRONTEND_PORT% добавлено.
goto :firewall_done

:firewall_no_admin
echo     [!] Нет правила брандмауэра на порт %FRONTEND_PORT%. Если с других ПК
echo         страница не открывается — один раз запустите этот файл от имени
echo         администратора, либо выполните в командной строке админа:
echo         netsh advfirewall firewall add rule name="Fasad UI %FRONTEND_PORT%" dir=in action=allow protocol=TCP localport=%FRONTEND_PORT%

:firewall_done

rem Бэкенд запускается через отдельный сгенерированный .bat, а не через
rem "cmd /c "cd /d "%X%" && ..."" одной строкой — та форма ломается, если
rem путь к папке содержит & (например "R&D"): cmd считает кавычки по всей
rem строке общим счётчиком, а не по вложенности, и %X% там раскрывается
rem фактически ВНЕ кавычек. Отдельный файл этой проблемы не имеет вообще.
rem
rem Бэкенд слушает только 127.0.0.1 намеренно. Наружу его выставлять не нужно:
rem браузер обращается к API по тому же адресу, что и к странице, а интерфейс
rem сам проксирует /api/v1 на бэкенд внутри этого компьютера. Лишний открытый
rem порт — это только лишняя дыра.
set "LAUNCH_BACKEND=%TEMP%\fasad_launch_backend_%RANDOM%.bat"
> "%LAUNCH_BACKEND%" (
    echo @echo off
    echo chcp 65001 ^>nul
    echo cd /d "%BACKEND_DIR%"
    echo set "PYTHONIOENCODING=utf-8"
    echo "%PYTHON%" -m uvicorn app.main:app --host 127.0.0.1 --port %BACKEND_PORT% ^> "%BACKEND_LOG%" 2^>^&1
)

echo [3/4] Запускаю сервер...
del /q "%BACKEND_LOG%" >nul 2>&1
start "Fasad — сервер" /min cmd /c "%LAUNCH_BACKEND%"

echo     Жду, пока сервер поднимется...
set /a BACKEND_TRIES=0
:wait_backend
rem Пауза через ping, а не timeout: timeout отказывается работать, если у
rem процесса перенаправлен ввод («Input redirection is not supported»), и тогда
rem цикл ожидания вырождается в тридцать мгновенных проверок подряд.
ping -n 2 127.0.0.1 >nul
set /a BACKEND_TRIES+=1
"%PYTHON%" -c "import json,sys,urllib.request; d=json.load(urllib.request.urlopen('http://127.0.0.1:%BACKEND_PORT%/health', timeout=1)); sys.exit(0 if d.get('status')=='ok' and d.get('database')=='ok' and d.get('app')=='Fasad Production Platform' else 1)" 2>nul
if not errorlevel 1 goto backend_ready
if %BACKEND_TRIES% GEQ 30 goto backend_failed
goto wait_backend

:backend_failed
echo.
echo ==========================================================
echo   [!] Сервер не поднялся за 30 секунд.
echo ==========================================================
if exist "%BACKEND_LOG%" (
    echo   Последние строки лога сервера ^(%BACKEND_LOG%^):
    echo.
    more "%BACKEND_LOG%"
) else (
    echo   Файл лога не создался — сервер не запустился вообще.
)
echo ==========================================================
del /q "%LAUNCH_BACKEND%" >nul 2>&1
pause
exit /b 1

:backend_ready
del /q "%LAUNCH_BACKEND%" >nul 2>&1

rem После смены демо-паролей интерфейс слушает 0.0.0.0 — все сетевые карты.
rem До смены паролей он слушает только 127.0.0.1 этого компьютера.
rem
rem API_URL — адрес бэкенда для запросов, которые интерфейс делает сам, со
rem своей стороны. Это всегда 127.0.0.1: бэкенд стоит на этом же компьютере,
rem и ходить к нему через внешний адрес незачем. Такой адрес ещё и переживает
rem смену IP — в отличие от зашитого адреса сети.
rem
rem Запросы из браузера идут не сюда: страница обращается к /api/v1 по своему
rem собственному адресу, и интерфейс проксирует их на бэкенд сам. Поэтому и
rem с другого ПК API работает, и настраивать под него ничего не нужно.
set "LAUNCH_FRONTEND=%TEMP%\fasad_launch_frontend_%RANDOM%.bat"
> "%LAUNCH_FRONTEND%" (
    echo @echo off
    echo chcp 65001 ^>nul
    echo cd /d "%FRONTEND_DIR%"
    echo set "PORT=%FRONTEND_PORT%"
    echo set "HOSTNAME=%FRONTEND_HOST%"
    echo set "API_URL=http://127.0.0.1:%BACKEND_PORT%/api/v1"
    echo "%NODE%" server.js
)

echo [4/4] Запускаю интерфейс...
start "Fasad — интерфейс" /min cmd /c "%LAUNCH_FRONTEND%"

rem Ждём, пока интерфейс действительно поднимется, а не фиксированные 3
rem секунды. Заодно это чинит гонку: временный .bat удаляется только после
rem того, как cmd его дочитал, иначе на медленной машине файл исчезал
rem раньше, чем доходила очередь до последней строки.
set /a FRONTEND_TRIES=0
:wait_frontend
rem Пауза через ping, а не timeout: timeout отказывается работать, если у
rem процесса перенаправлен ввод («Input redirection is not supported»), и тогда
rem цикл ожидания вырождается в тридцать мгновенных проверок подряд.
ping -n 2 127.0.0.1 >nul
set /a FRONTEND_TRIES+=1
"%PYTHON%" -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:%FRONTEND_PORT%/login', timeout=3).close()" 2>nul
if not errorlevel 1 goto frontend_ready
if %FRONTEND_TRIES% GEQ 30 goto frontend_failed
goto wait_frontend

:frontend_failed
echo.
echo   [!] Интерфейс не поднялся за 30 секунд. Откройте окно
echo       «Fasad — интерфейс» и посмотрите, что оно пишет.
del /q "%LAUNCH_FRONTEND%" >nul 2>&1
pause
exit /b 1

:frontend_ready
del /q "%LAUNCH_FRONTEND%" >nul 2>&1

echo.
echo ==========================================================
echo   Готово. Открываю систему в браузере...
echo.
echo   На этом компьютере:  http://127.0.0.1:%FRONTEND_PORT%
if defined LAN_ONLY goto :local_only_line
if not defined LAN_IP goto :no_lan_line
echo   С других ПК сети:    http://%LAN_IP%:%FRONTEND_PORT%
goto :lan_line_done

:no_lan_line
echo   С других ПК:         недоступно — нет сетевого адреса.
goto :lan_line_done

:local_only_line
echo   С других ПК:         временно закрыто — смените демо-пароли и перезапустите.

:lan_line_done
echo   Вход: используйте пароль своей учётной записи.
echo.
echo   Это окно можно закрыть — сервер и интерфейс работают в двух
echo   свёрнутых окнах и продолжат работать без него.
echo.
echo   Чтобы остановить систему, запустите stop.bat. Искать окна
echo   глазами не надо: Next.js переименовывает своё окно в
echo   «next-server», и на «Fasad — интерфейс» оно не похоже.
echo ==========================================================
echo.

start "" "http://127.0.0.1:%FRONTEND_PORT%"

pause
