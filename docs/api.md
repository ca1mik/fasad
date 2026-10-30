# API Overview

Основной префикс API:

`/api/v1`

Полная интерактивная документация:

- `http://localhost:8000/docs`

## Auth

- `POST /auth/login`
- `GET /auth/me`

## Admin

- `GET /admin/users`
- `POST /admin/users`
- `PATCH /admin/users/{user_id}`
- `GET /admin/roles`
- `POST /admin/roles`
- `PATCH /admin/roles/{role_id}`
- `GET /admin/permissions`
- `POST /admin/permissions`
- `PATCH /admin/permissions/{permission_id}`
- `GET /admin/audit`

## Clients

- `GET /clients`
- `POST /clients`
- `GET /clients/{client_id}`

## Leads

- `POST /leads/intake`
- `GET /leads`
- `GET /leads/{lead_id}`
- `POST /leads/{lead_id}/create-order`

## Производственные направления

- `GET /directions` — справочник (`?only_active=true`)
- `POST /directions` — новое направление, право `orders.manage`
- `PATCH /directions/{direction_id}` — переименовать или выключить

Номер заказа получает букву направления: эмаль — `0001`, ПВХ — `0001-П`,
шпон — `0001-Ш`. Подробности — [directions.md](directions.md).

## Клиенты — карточка

- `GET /clients/{client_id}` — реквизиты с организацией, история заказов и сводка
  покупок; в `statement` — баланс, разрез по заказам и лента начислений с оплатами
- `PATCH /clients/{client_id}` — правка реквизитов
- `GET /clients/{client_id}/statement.xlsx` — выписка взаиморасчётов книгой Excel

См. [statements-and-exports.md](statements-and-exports.md)

## Заявки — уточнение

- `PATCH /leads/{lead_id}` — направление, статус, ответственный
- `GET /leads?direction_code=pvc` — заявки одного направления

## Messaging и Inbox

### Intake endpoints

- `POST /messaging/email/intake`
- `POST /messaging/telegram/webhook`
- `POST /messaging/telegram/bot/webhook`
- `POST /messaging/telegram/bot/telegram-api`
- `POST /messaging/whatsapp/webhook`
- `POST /messaging/webhook/intake`

### Inbox endpoints

- `GET /messaging/conversations`
- `GET /messaging/conversations/{conversation_id}`
- `POST /messaging/conversations/{conversation_id}/mark-read`
- `POST /messaging/conversations/{conversation_id}/assign`
- `POST /messaging/conversations/{conversation_id}/messages`

### Channel accounts

- `GET /messaging/channel-accounts`
- `POST /messaging/channel-accounts`
- `PATCH /messaging/channel-accounts/{account_id}`
- `POST /messaging/channel-accounts/{account_id}/health-check` — проверка IMAP и SMTP
- `POST /messaging/channel-accounts/{account_id}/poll` — немедленный опрос ящика

Все требуют право `channels.manage`.

Учётные данные передаются в поле `secrets` (`imap_password`, `smtp_password`) при
create/update и обратно **не возвращаются**. В ответе есть только
`configured_secrets` — список имён заданных секретов. Пустое или отсутствующее
значение при update означает «оставить текущий пароль».

Подробности — [email-channel.md](email-channel.md).

## Orders

- `GET /orders`
- `POST /orders`
- `GET /orders/statuses` — справочник статусов заказа (для кнопок и фильтров)
- `GET /orders/{order_id}`
- `PATCH /orders/{order_id}` — правка карточки: `has_texture`, `comment`.
  Передаются только изменяемые поля, остальные не трогаются
- `POST /orders/{order_id}/items`
- `POST /orders/{order_id}/generate-parts`
- `POST /orders/{order_id}/calculate`
- `POST /orders/{order_id}/change-status`
- `POST /orders/{order_id}/reserve-stock`
- `POST /orders/{order_id}/writeoff-stock`

## Production

- `GET /materials`
- `POST /materials`
- `GET /edge-materials`
- `POST /edge-materials`
- `GET /hardware`
- `POST /hardware`
- `GET /production/workflows`
- `GET /production/queue`
- `POST /orders/{order_id}/workflow/bootstrap`
- `GET /orders/{order_id}/stages`
- `GET /production/stages/{stage_id}`
- `POST /production/stages/{stage_id}/start`
- `POST /production/stages/{stage_id}/complete`
- `POST /production/stages/{stage_id}/block`
- `POST /production/stages/{stage_id}/assign`
- `POST /production/stages/{stage_id}/evidence`
- `GET /production/stages/{stage_id}/part-progress`
- `GET /production/stages/{stage_id}/part-reports`
- `POST /production/stages/{stage_id}/part-reports`
- `GET /workers`
- `GET /workers/me`
- `GET /workers/{worker_id}`

## Cutting и CNC

- `POST /orders/{order_id}/export-cutting`
- `POST /orders/{order_id}/generate-cnc`
- `GET /orders/{order_id}/parts`
- `GET /orders/{order_id}/exports`
- `GET /orders/{order_id}/cnc-jobs`

## Загрузка списка деталей

- `POST /imports/parts` — разбор бланка заказчика (`.xlsx`, `.xls`, `.csv`),
  ничего не сохраняет. См. [imports.md](imports.md)

## Печатные бланки

- `GET /leads/{lead_id}/blank.xlsx` — бланк заказа файлом Excel.
  См. [print-forms.md](print-forms.md)

## Справочник цен

Прайс — это деньги, поэтому весь раздел закрыт правами `orders.manage` или
`templates.manage`. Работнику цеха он не положен: описание его роли обещает,
что денег он не видит.

- `GET /price-book/options` — типы работ, единицы и направления для списков.
  У направления рядом едет `kind` — тип работ прайса того же направления: под
  ним заводится номенклатура из артикулов, набранных в заявке руками
- `GET /price-book` — список артикулов (`search`, `kind`, `only_active`)
- `POST /price-book` — завести артикул
- `GET /price-book/{item_id}` — артикул с историей цены
- `PATCH /price-book/{item_id}` — правка; изменение цены пишется в историю

Артикул нормализуется на входе: приставка «арт.» срезается, словесный хвост
отбрасывается — «арт. 112 пвх эмаль» становится «112». Составной номер вроде
«ФР 01» остаётся целым.

См. [price-book-and-money.md](price-book-and-money.md)

## Смета, деньги и файлы заказа

- `GET /orders/payment-methods` — способы оплаты
- `PUT /orders/{order_id}/positions` — таблица позиций целиком; цена берётся из
  справочника, у нестандарта — своя. Пересчитывает сумму заказа
- `POST /orders/{order_id}/payments` — записать оплату
- `DELETE /orders/{order_id}/payments/{payment_id}` — удалить оплату
- `POST /orders/{order_id}/shipped` — галочка «отгружено», ставит `shipped_at`
- `GET /orders/{order_id}/files` — файлы заказа
- `POST /orders/{order_id}/files` — приложить файл (multipart, поле `comment`)
- `GET /documents/{document_id}/download` — скачать файл
- `PATCH /documents/{document_id}` — правка комментария
- `DELETE /documents/{document_id}` — удалить (только приложенные вручную)

`GET /orders/{order_id}` теперь отдаёт `positions`, `payments` и `balance`.

`POST /leads/{lead_id}/create-order` переносит посчитанные строки заявки в смету
заказа: цена копируется как есть, строки без цены пропускаются.
См. [lead-intake-table.md](lead-intake-table.md)

## Подсказки для полей

- `GET /reference-values` — цвета и фрезеровки, которые студия уже писала,
  отсортированные по частоте. Источник — заявки, позиции заказов и справочники.
  См. [lead-intake-table.md](lead-intake-table.md)

## Отчёт по обработке

- `GET /reports/work-kinds` — фрезеровка, шпон, мыло за период;
  `metric=accepted|shipped`, разбивка по типу работы и по артикулу

## Выгрузки отчётов

Фильтры те же, что у отчётов на экране, включая `direction_code`; ответ — книга
Excel, имя файла по-русски через `filename*=UTF-8''`.

- `GET /reports/volume.xlsx`
- `GET /reports/orders.xlsx` — строка = заказ с суммой и площадью. Принимает
  `client_ids` и `inactive_days`: отмеченные галочками главнее, без них берутся
  клиенты, подходящие под порог «не покупал N дней»
- `GET /reports/work-kinds.xlsx`
- `GET /reports/clients.xlsx`
- `GET /reports/production-time.xlsx`

Весь раздел отчётов закрыт правом `reports.read`. Отдельно от `dashboard.read`:
сводка нужна цеху ради своих этапов и брака, а выручка студии и клиентская
база — нет.

PDF собирает браузер со страницы `/reports/print`.
См. [statements-and-exports.md](statements-and-exports.md)

## Templates и Catalog

- `GET /templates`
- `POST /templates`
- `GET /templates/catalog`
- `POST /templates/catalog/estimate`
- `POST /templates/catalog/lead`

## Stock

- `GET /stock/items`
- `GET /stock/movements`

## Dashboard

- `GET /dashboard/summary`
- `GET /dashboard/production`

## Единый стиль ответа

Большинство endpoint’ов возвращают envelope:

```json
{
  "data": {},
  "meta": {
    "page": 1,
    "size": 20,
    "total": 100,
    "pages": 5
  }
}
```

## Ключевые сценарии

### Intake -> Lead -> Inbox

1. Внешний канал отправляет webhook.
2. Adapter собирает `UnifiedLeadIn`.
3. Создается `Client`.
4. Создается `Lead`.
5. Создается или переиспользуется `Conversation`.
6. В диалог добавляется `Message`.

### Lead -> Order

1. Открывается карточка lead.
2. Вызывается `POST /leads/{lead_id}/create-order`.
3. Система создает order и связывает его с lead.

### Order -> Parts -> Production

1. Создается item заказа.
2. Генерируются детали.
3. Выполняется калькуляция.
4. Запускается workflow.
5. Работники отчитываются по деталям и этапам.
