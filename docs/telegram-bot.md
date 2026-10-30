# Telegram Bot Intake

## Цель

Показать, как Telegram bot может собирать предварительную заявку без менеджера на первом касании:

1. клиент выбирает тип изделия
2. вводит размеры
3. выбирает материал
4. получает ориентировочную сумму и площадь
5. оставляет имя и телефон
6. система создает `Lead` в CRM

## Что Реализовано

- webhook-ready endpoint с меню и шагами сценария
- хранение состояния диалога в `telegram_bot_sessions`
- расчет по примерному каталогу
- создание `Lead` с каналом `telegram_bot`
- demo-страница в frontend `/catalog`

## Endpoint'ы

### 1. CRM/demo endpoint

`POST /api/v1/messaging/telegram/bot/webhook`

Возвращает envelope с ответом бота:

- `text`
- `session_state`
- `buttons`
- `lead_id`
- `estimated_total`
- `estimated_area_sqm`

Этот endpoint удобен для frontend-симулятора и внутренних тестов.

### 2. Telegram API webhook-ready endpoint

`POST /api/v1/messaging/telegram/bot/telegram-api`

Возвращает структуру, которую можно использовать как ответ Telegram webhook:

```json
{
  "method": "sendMessage",
  "chat_id": 9100,
  "text": "Выберите изделие для примерного расчета...",
  "reply_markup": {
    "inline_keyboard": [
      [
        { "text": "Шкаф", "callback_data": "product:wardrobe_basic" }
      ]
    ]
  }
}
```

## Сценарий Диалога

### Шаги

1. `/start`
2. выбор изделия: `wardrobe_basic` или `kitchen_module_basic`
3. ширина
4. высота
5. глубина
6. выбор материала
7. имя
8. телефон
9. создание лида в CRM

## Что Уходит В Lead

В `raw_payload` и `parsed_payload_json` сохраняются:

- код изделия
- размеры
- материал
- предварительная площадь
- предварительная сумма
- служебные данные Telegram-сессии

Пример `source_channel`:

- `telegram_bot`

## Что Осталось Для Реального Подключения

- добавить `TELEGRAM_BOT_TOKEN`
- настроить публичный webhook URL
- при необходимости вынести отправку ответов в отдельный adapter/service
- подключить media/file download из Telegram API вместо stub-логики
