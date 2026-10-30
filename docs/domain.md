# Доменная модель

## Intake

Все каналы приведения заявок сходятся в единую модель:

- `UnifiedLeadIn`
- `UnifiedSenderIn`
- `UnifiedAttachmentIn`

Результат intake:

1. сохранение raw payload
2. нормализация текста
3. извлечение клиента и параметров
4. поиск/создание клиента
5. создание `Lead`
6. привязка вложений
7. аудит события

## Клиенты и заявки

- `Client` хранит контактные данные и комментарий
- `Lead` хранит источник, текст, нормализованный payload и связь с клиентом
- `LeadAttachment` хранит ссылку на сохраненный файл

## Заказы

- `Order` является центральной сущностью orchestration
- `OrderItem` хранит параметрическое изделие
- `OrderStatus` и `OrderStatusHistory` ведут lifecycle заказа

## Производственная подготовка

- `ProductTemplate` описывает параметрический шаблон изделия
- `Part`, `PartEdge`, `PartOperation` описывают результат инженерной генерации
- `Export` хранит cutting exports
- `CncJob` хранит mock CNC outputs
- `Document` хранит коммерческие и производственные документы

## Склад

- `StockItem` хранит агрегированный остаток по material type и material id
- `StockMovement` фиксирует reserve/writeoff trace

## Аудит

`AuditLog` фиксирует ключевые бизнес-действия:

- create client
- create lead
- create order
- change status
- generate parts
- calculate order
- reserve stock
- writeoff stock
- export cutting
- generate cnc

