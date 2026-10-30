# Fasad Production Platform

Production-minded skeleton веб-системы для автоматизации мебельного и фасадного производства.

Проект строится как модульный монолит с понятными доменными границами. На текущем этапе уже доступны:

- intake заявок из разных каналов
- **живой email-канал: IMAP-приём заявок и SMTP-ответы из inbox**
- clients / leads / orders
- каталог изделий и быстрый расчёт
- смета заказа по справочнику артикулов, оплаты и баланс клиента
- отчёты за период с выгрузкой в Excel и печатью в PDF
- менеджерский раскрой листа в табличном формате
- production workflow с этапами, фото и отчётами работников
- единый inbox для диалогов
- cutting export и mock CNC
- RBAC, audit, seed, тесты и локальный bootstrap

## Что уже работает

### Backend

- FastAPI + SQLAlchemy 2.x + Alembic
- JWT auth и RBAC
- unified intake через `UnifiedLeadIn`
- adapters для email / Telegram / WhatsApp / generic webhook
- реальный email-канал: IMAP poller как RQ-джоба, планировщик `app.workers.scheduler`,
  SMTP-отправка ответов, health-check, шифрование учётных данных (Fernet)
- `ChannelAccount`, `Conversation`, `Message`, `MessageAttachment`
- clients, leads, orders, templates, materials
- parts generator для `wardrobe_basic` и `kitchen_module_basic`
- pricing, stock reserve/writeoff, documents, cutting export, mock CNC
- production workflow, worker reporting, stage evidence
- Telegram bot demo flow
- film cutting estimate API для менеджера

### Frontend

- Next.js App Router + TypeScript
- русифицированный manager shell
- `/dashboard`
- `/leads` с ручным intake
- `/catalog` с быстрым расчётом
- `/film-cutting` с рабочим столом раскроя
- `/inbox` и `/inbox/[id]`
- `/orders`, `/production`, `/workers`
- admin pages для users / roles / permissions / channels / audit

## Менеджерский раскрой листа

На странице `/film-cutting` менеджер может:

- работать со стандартным пресетом `2750×1250` мм по умолчанию
- быстро переключаться между типовыми форматами листа
- задавать поля листа и общий gap по X/Y
- добавлять детали вручную или из каталога
- закреплять отдельную деталь за конкретным листом
- задавать индивидуальный `gapX / gapY`
- запрещать или разрешать поворот детали
- выбирать материал и видеть его узор на карте
- импортировать позиции строками `1246x436x2`, `1246*436*2` или `1246 436 2`
- получать несколько карт размещения, если детали не помещаются в один лист
- видеть остатки, рабочую зону, координаты и статистику по листам
- переключать визуальный режим карты: прямые углы / скругления, сетка / без сетки
- сразу создавать lead в CRM из готового расчёта

Важно: это manager tool для оперативной оценки и подготовки, а не финальный production-grade optimizer. Следующий технологический этап остаётся отдельным контуром: ручная правка карт, drag/drop, работа с остатками как со складскими единицами и внешний оптимизатор.

## Как потом подключить реальные каналы

Архитектура уже подготовлена так, чтобы позже просто подключить transport layer без переделки ядра CRM.

### Уже подключено

**Email** — рабочий транспорт в обе стороны, см. [docs/email-channel.md](docs/email-channel.md).
Настраивается на `/admin/channels`: IMAP/SMTP, пароль приложения, интервал опроса,
кнопка «Проверить соединение». Пароли шифруются ключом `CHANNEL_SECRET_KEY` и не
возвращаются в API.

Для работы нужны три процесса: `backend`, `worker` (выполняет джобы) и
`scheduler` (ставит джобы по расписанию).

### Останется подключить

- реальный Telegram dispatcher и long-polling на bot token
- WhatsApp Business API provider

То есть ядро CRM уже готово к тому, чтобы дать доступ к Telegram или WhatsApp и дописать конкретные интеграционные адаптеры — как это уже сделано для почты.

## Локальный запуск без Docker

### Первый запуск

```powershell
cd "C:\Users\koall\OneDrive\Рабочий стол\fasad"
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\run-local.ps1 -InstallDeps -ResetDb
```

### Повторный запуск

```powershell
cd "C:\Users\koall\OneDrive\Рабочий стол\fasad"
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\run-local.ps1
```

Откроются:

- frontend: `http://localhost:3000/login`
- backend docs: `http://127.0.0.1:8000/docs`
- health: `http://127.0.0.1:8000/health`

## Запуск через Docker

```powershell
cd "C:\Users\koall\OneDrive\Рабочий стол\fasad"
Copy-Item .env.example .env -Force
Copy-Item .\backend\.env.example .\backend\.env -Force
Copy-Item .\frontend\.env.example .\frontend\.env.local -Force
docker compose up --build -d
docker compose exec backend alembic upgrade head
docker compose exec backend python scripts/seed.py
```

## Портативный запуск с флешки

Отдельная самодостаточная сборка — без Python, Node.js или Docker на целевой
машине, только двойной клик по `start.bat`. Собирается один раз командой
`.\scripts\build-portable.ps1`, подробности и ограничения — в
[docs/portable-usb.md](docs/portable-usb.md).

## Тестовые пользователи

- `admin / admin123`
- `manager / manager123`
- `technologist / tech123`
- `operator.cutting / operator123`
- `operator.assembly / operator123`

## Полезные страницы

- `/manager`
- `/dashboard`
- `/leads`
- `/catalog`
- `/film-cutting`
- `/inbox`
- `/orders`
- `/production`
- `/workers`
- `/admin`
- `/admin/channels`

## Основные команды

### Backend

```powershell
& ".\backend\.venv\Scripts\python.exe" -m pytest backend\app\tests -q
& ".\backend\.venv\Scripts\python.exe" -m ruff check backend\app backend\scripts
& ".\backend\.venv\Scripts\python.exe" -m black --check backend\app backend\scripts
```

### Frontend

```powershell
cd frontend
npm run test
npm run lint
npm run typecheck
npm run build
```

## Проверено

На текущем этапе успешно проходят:

- `pytest` — 484 теста
- `ruff check`
- `black --check`
- `npm run test` — 31 тест
- `npm run lint`
- `npm run typecheck`
- `npm run build`

Что покрыто тестами, а что проверяется прогоном в настоящем браузере и почему —
в [docs/testing.md](docs/testing.md).

## Что дальше

Следующие инженерные шаги (план по фазам — в [CLAUDE.md](CLAUDE.md)):

1. Реальные транспорты Telegram и WhatsApp (email уже подключён).
2. Rework / QR / labels в production.
3. `cutting_jobs`, `cutting_maps` и технологический preview раскроя.
4. Semi-manual adjustment и drag/drop для технолога.
5. External optimizer integration.
6. Real CNC postprocessors.
7. Расширенный склад и traceability.

## Документация

- [docs/architecture.md](docs/architecture.md)
- [docs/domain.md](docs/domain.md)
- [docs/api.md](docs/api.md)
- [docs/intake.md](docs/intake.md)
- [docs/inbox.md](docs/inbox.md)
- [docs/email-channel.md](docs/email-channel.md)
- [docs/outreach.md](docs/outreach.md) — холодная рассылка по фасадным
  производствам через настроенный почтовый канал
- [docs/directions.md](docs/directions.md)
- [docs/portable-usb.md](docs/portable-usb.md) — сборка без установки
  зависимостей, запуск с флешки
- [licensing/README.md](licensing/README.md) — привязка портативной сборки
  к компьютеру клиента, выпуск `license.key`
- [docs/telegram-bot.md](docs/telegram-bot.md)
- [docs/production.md](docs/production.md)
- [docs/cutting-and-configurator.md](docs/cutting-and-configurator.md)
- [docs/imports.md](docs/imports.md)
- [docs/print-forms.md](docs/print-forms.md)
- [docs/lead-intake-table.md](docs/lead-intake-table.md)
- [docs/price-book-and-money.md](docs/price-book-and-money.md)
- [docs/statements-and-exports.md](docs/statements-and-exports.md)
- [docs/testing.md](docs/testing.md) — чем проверяется система и где граница
  между тестом и прогоном в браузере
- [docs/implementation-plan.md](docs/implementation-plan.md)
- [docs/examples/README.md](docs/examples/README.md)
