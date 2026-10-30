param([string]$Path)
# Снимает пометку Windows "файл скачан из интернета" (Mark-of-the-Web) со всех
# файлов портативной сборки. Без этого перенос папки по сети/флешке на другой
# компьютер может привести к тому, что node.exe/python.exe тихо блокируются
# (SmartScreen), и фронтенд/бэкенд не запускаются без единой видимой ошибки.
Get-ChildItem -LiteralPath $Path -Recurse -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue
