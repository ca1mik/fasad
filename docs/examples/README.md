# Примеры данных

Ниже собраны примерные варианты того, как в системе будут выглядеть:

- входящие заявки из разных каналов
- нормализованные `Lead`
- `Client`
- `Order`
- `OrderItem`
- сгенерированные `Part`
- production-отчёты работников
- сводка для dashboard

## Сценарий 1. Шкаф-купе из формы сайта

### Входящий intake payload

Файл: [intake-website-wardrobe.json](./intake-website-wardrobe.json)

Смысл:

- клиент оставил заявку с сайта
- система извлекла имя, телефон, email и габариты
- после intake создаются `Client` и `Lead`

### Как будет выглядеть `Lead`

```json
{
  "id": "6be4d0aa-0d53-4f54-a70c-f425d7791e77",
  "source_channel": "website_form",
  "external_message_id": "site-2026-wardrobe-001",
  "subject": "Заявка на шкаф-купе",
  "raw_text": "Нужен шкаф-купе 1800x2400x600, цвет белый дуб, клиент Иван Петров, +79991234567, ivan.petrov@example.com",
  "normalized_text": "Нужен шкаф-купе 1800x2400x600, цвет белый дуб.",
  "parsed_payload_json": {
    "client_name": "Иван Петров",
    "phone": "+79991234567",
    "email": "ivan.petrov@example.com",
    "text": "Шкаф-купе 1800x2400x600, цвет белый дуб",
    "dimensions": {
      "width": 1800,
      "height": 2400,
      "depth": 600
    }
  },
  "status": "new",
  "client_id": "8e6de79d-5ef6-4630-8fe4-93ac09508975",
  "assigned_manager_id": null,
  "attachments": []
}
```

### Как будет выглядеть `Client`

```json
{
  "id": "8e6de79d-5ef6-4630-8fe4-93ac09508975",
  "full_name": "Иван Петров",
  "phone": "+79991234567",
  "email": "ivan.petrov@example.com",
  "address": "Москва, ул. Лесная, 14",
  "comment": "Предпочитает связь после 15:00"
}
```

### Как будет выглядеть `Order`

```json
{
  "id": "fcb86e97-2411-4218-a57b-b4546ff1eff1",
  "order_number": "ORD-2026-00017",
  "client_id": "8e6de79d-5ef6-4630-8fe4-93ac09508975",
  "manager_id": "2b4a9d5e-2581-4dba-b0cd-b69177e3f1a5",
  "status_id": "32f5d95d-665e-4a9e-8a3a-79eb17cbd8b0",
  "currency": "RUB",
  "total_amount": "94500.00",
  "discount_amount": "5000.00",
  "final_amount": "89500.00",
  "comment": "Шкаф в нишу, согласовать внутреннее наполнение",
  "source_lead_id": "6be4d0aa-0d53-4f54-a70c-f425d7791e77",
  "client": {
    "full_name": "Иван Петров",
    "phone": "+79991234567",
    "email": "ivan.petrov@example.com"
  },
  "status": {
    "code": "calculating",
    "name": "Calculating"
  }
}
```

### Как будет выглядеть `OrderItem`

Файл для создания через API: [order-item-wardrobe.json](./order-item-wardrobe.json)

```json
{
  "id": "3b8cf5f4-e8d8-4dcf-8681-1d3a0f617ca4",
  "order_id": "fcb86e97-2411-4218-a57b-b4546ff1eff1",
  "template_id": "wardrobe-basic-template-id",
  "item_type": "wardrobe_basic",
  "name": "Шкаф-купе в нишу",
  "width": "1800.00",
  "height": "2400.00",
  "depth": "600.00",
  "quantity": 1,
  "params_json": {
    "doors_count": 2,
    "shelves_count": 5,
    "section_count": 2,
    "color": "white_oak"
  },
  "price": "89500.00"
}
```

### Как будут выглядеть `Part`

```json
[
  {
    "part_code": "WR-SIDE-L",
    "name": "Left side panel",
    "length": "2400.00",
    "width": "600.00",
    "thickness": "18.00",
    "quantity": 1,
    "edges": [
      { "side": "front", "length_mm": "2400.00" }
    ],
    "operations": []
  },
  {
    "part_code": "WR-SHELF-01",
    "name": "Shelf",
    "length": "864.00",
    "width": "564.00",
    "thickness": "18.00",
    "quantity": 5,
    "edges": [
      { "side": "front", "length_mm": "864.00" }
    ],
    "operations": [
      { "operation_type": "drill", "x": "37.00", "y": "37.00", "depth": "12.00" }
    ]
  }
]
```

## Сценарий 2. Кухонный модуль из email

### Входящий email payload

Файл: [intake-email-kitchen.json](./intake-email-kitchen.json)

Смысл:

- письмо приходит с вложением эскиза
- создаётся `Lead`
- менеджер переводит его в `Order`
- используется шаблон `kitchen_module_basic`

### Как будет выглядеть kitchen order

```json
{
  "order_number": "ORD-2026-00021",
  "client": {
    "full_name": "Анна Смирнова",
    "phone": "+79997775544",
    "email": "anna.smirnova@example.com"
  },
  "status": {
    "code": "approved",
    "name": "Approved"
  },
  "items": [
    {
      "item_type": "kitchen_module_basic",
      "name": "Нижний модуль кухни 600",
      "width": "600.00",
      "height": "720.00",
      "depth": "560.00",
      "quantity": 4,
      "params_json": {
        "facade_type": "mdf_oak",
        "drawers": 3,
        "legs": true
      }
    }
  ],
  "final_amount": "126800.00"
}
```

### Пример item payload

Файл: [order-item-kitchen.json](./order-item-kitchen.json)

## Сценарий 3. Быстрая заявка из WhatsApp

Такой lead обычно приходит неполным, а менеджер потом дополняет данные:

```json
{
  "source_channel": "whatsapp",
  "external_message_id": "wamid.HBgNODc5OTAwMDAwMDAx",
  "subject": null,
  "raw_text": "Здравствуйте, нужен фасад на кухню. Размер примерно 716x396, 8 штук.",
  "normalized_text": "Нужны фасады кухни 716x396, 8 штук.",
  "parsed_payload_json": {
    "client_name": null,
    "phone": "+79990000001",
    "email": null,
    "text": "Фасады кухни 716x396, 8 штук",
    "dimensions": {
      "width": 396,
      "height": 716,
      "quantity": 8
    }
  },
  "status": "new",
  "client_id": "existing-client-id-or-new-client-id"
}
```

## Как будет выглядеть production stage

```json
{
  "id": "805ad343-83f0-4cec-b902-df656d89dd9d",
  "order_id": "fcb86e97-2411-4218-a57b-b4546ff1eff1",
  "status": "in_progress",
  "workflow_stage": {
    "code": "cutting",
    "name": "Cutting",
    "work_center": {
      "code": "cutting",
      "name": "Cutting Area"
    }
  },
  "assigned_user": {
    "full_name": "Cutting Operator",
    "login": "operator.cutting"
  }
}
```

## Как будет выглядеть отчёт работника по детали

```json
{
  "id": "847e6231-9a86-49db-b2a7-fd887c4359ef",
  "order_stage_instance_id": "805ad343-83f0-4cec-b902-df656d89dd9d",
  "part_id": "part-shelf-01-id",
  "worker_id": "worker-cutting-id",
  "report_status": "done",
  "quantity_done": 5,
  "quantity_defect": 0,
  "comment": "Полка раскроена без замечаний",
  "photo_file_name": "shelf-batch-01.jpg",
  "photo_file_path": "production/fcb86e97-2411-4218-a57b-b4546ff1eff1/805ad343-83f0-4cec-b902-df656d89dd9d/part-reports/abcd1234.jpg",
  "part": {
    "part_code": "WR-SHELF-01",
    "name": "Shelf",
    "quantity": 5
  },
  "worker": {
    "full_name": "Cutting Operator",
    "login": "operator.cutting"
  }
}
```

## Как будет выглядеть карточка работника

```json
{
  "id": "worker-cutting-id",
  "full_name": "Cutting Operator",
  "login": "operator.cutting",
  "role_code": "operator",
  "role_name": "Operator",
  "active_stage_count": 3,
  "completed_reports_count": 18,
  "done_quantity": 64,
  "defect_quantity": 2,
  "recent_reports": [
    {
      "part": {
        "part_code": "WR-SHELF-01",
        "name": "Shelf"
      },
      "quantity_done": 5,
      "quantity_defect": 0,
      "created_at": "2026-04-01T18:45:00Z"
    }
  ]
}
```

## Как это будет выглядеть в списках UI

### Leads list

| source_channel | client | status | created_at |
|---|---|---|---|
| website_form | Иван Петров | new | 2026-04-01 11:25 |
| email | Анна Смирнова | in_progress | 2026-04-01 12:10 |
| whatsapp | Не определён | new | 2026-04-01 12:44 |

### Orders list

| order_number | client | status | amount |
|---|---|---|---|
| ORD-2026-00017 | Иван Петров | calculating | 89 500 RUB |
| ORD-2026-00021 | Анна Смирнова | approved | 126 800 RUB |
| ORD-2026-00023 | ООО «Альфа Интерьер» | manufacturing | 248 400 RUB |

### Workers list

| worker | role | active_stage_count | completed_reports_count | done_quantity |
|---|---|---:|---:|---:|
| Cutting Operator | operator | 3 | 18 | 64 |
| Assembly Operator | operator | 2 | 9 | 12 |
| Technologist User | technologist | 1 | 4 | 0 |

## Как использовать эти примеры

1. payload-файлы можно брать как основу для Swagger/Postman
2. JSON-блоки показывают целевую форму данных после intake и обработки
3. табличные примеры показывают, как это будет выглядеть в UI
