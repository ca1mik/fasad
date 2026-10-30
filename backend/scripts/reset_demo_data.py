"""Чистит рабочие данные: клиентов, заявки, заказы, диалоги, справочники.

Зачем. После наладки в базе остаются демонстрационные клиенты, тестовые заказы и
диалоги. Они мешают работать: лезут в подсказки артикулов и цветов, портят
отчёты и суммы. Этот скрипт оставляет пустую систему, готовую к настоящей
работе.

Что остаётся. Настройка: пользователи, роли, права, статусы заказов,
производственные направления, участки и этапы. Без них система не работает, и
трогать их нельзя.

Что уходит. Всё, что относится к работе: клиенты, заявки, заказы со сметами и
оплатами, детали, диалоги, документы, артикулы справочника цен, склад,
демонстрационный каталог корпусной мебели и журнал действий.

Действие необратимое, поэтому по умолчанию скрипт только показывает список.
Перед запуском с ``--apply`` он сам делает копию базы рядом с ней.

    python scripts/reset_demo_data.py                 # показать, что уйдёт
    python scripts/reset_demo_data.py --apply         # выполнить
    python scripts/reset_demo_data.py --apply --keep-audit   # оставить журнал
"""

from __future__ import annotations

import shutil
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import SessionLocal

#: Порядок важен: сначала то, что ссылается, потом то, на что ссылаются.
#: Иначе внешние ключи не дадут удалить родителя.
TABLES_IN_ORDER: list[tuple[str, str]] = [
    ("stage_part_reports", "отчёты по деталям"),
    ("stage_evidence", "фотофиксация этапов"),
    ("stage_assignments", "назначения на этапы"),
    ("order_stage_instances", "этапы заказов"),
    ("cnc_jobs", "задания ЧПУ"),
    ("exports", "выгрузки"),
    ("documents", "документы и печатные формы"),
    ("order_payments", "оплаты"),
    ("order_positions", "строки смет"),
    ("order_status_history", "история статусов"),
    ("order_items", "позиции каталога в заказах"),
    ("part_edges", "кромки деталей"),
    ("part_operations", "операции по деталям"),
    ("parts", "детали"),
    ("stock_movements", "движения склада"),
    ("stock_items", "остатки склада"),
    ("message_attachments", "вложения сообщений"),
    ("messages", "сообщения"),
    ("conversations", "диалоги"),
    ("lead_attachments", "вложения заявок"),
    ("orders", "заказы"),
    ("leads", "заявки"),
    ("clients", "клиенты"),
    ("price_item_changes", "история цен"),
    ("price_items", "артикулы справочника"),
    ("telegram_bot_sessions", "сессии демо-бота"),
    # Демонстрационный каталог корпусной мебели: шкафы, ЛДСП, конфирматы. К
    # фасадам отношения не имеет и только мешает в списках.
    ("product_templates", "шаблоны изделий (демо)"),
    ("hardware", "фурнитура (демо)"),
    ("edge_materials", "кромочные материалы (демо)"),
    ("materials", "материалы (демо)"),
]

#: Журнал действий — отдельно: его иногда хотят сохранить как историю.
AUDIT_TABLE = ("audit_log", "журнал действий")


def database_file() -> Path | None:
    """Путь к файлу базы, если это SQLite. Для Postgres копию делает pg_dump."""
    url = str(get_settings().database_url)
    marker = "sqlite:///"
    if marker not in url:
        return None
    return Path(url.split(marker, 1)[1])


def backup_database() -> Path | None:
    """Копия базы рядом с ней. Без копии удалять нельзя."""
    source = database_file()
    if not source or not source.exists():
        return None
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = source.with_name(f"{source.stem}.before-reset-{stamp}{source.suffix}")
    shutil.copy2(source, target)
    return target


def main() -> None:
    apply = "--apply" in sys.argv
    keep_audit = "--keep-audit" in sys.argv

    tables = list(TABLES_IN_ORDER)
    if not keep_audit:
        tables.append(AUDIT_TABLE)

    db = SessionLocal()
    try:

        def count(table: str) -> int:
            """Сколько строк. -1 — такой таблицы в базе нет."""
            try:
                return int(
                    db.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar() or 0
                )  # noqa: S608
            except Exception:  # noqa: BLE001
                db.rollback()
                return -1

        print("Будет удалено:")
        total = 0
        for table, label in tables:
            rows = count(table)
            if rows < 0:
                print(f"  {label:<30} таблицы нет — пропускаем")
                continue
            total += rows
            print(f"  {label:<30} {rows}")
        print(f"\nВсего записей: {total}")

        if keep_audit:
            print("Журнал действий сохраняется: передан --keep-audit")

        print(
            "\nОстанется без изменений: пользователи, роли, права, статусы заказов,\n"
            "направления, участки и этапы производства."
        )

        if not apply:
            print("\nПоказ без записи. Для удаления добавьте --apply")
            return

        backup = backup_database()
        if backup:
            print(f"\nКопия базы: {backup}")
        else:
            print("\nВНИМАНИЕ: база не SQLite — копию сделайте сами (pg_dump) до продолжения.")

        removed = 0
        for table, label in tables:
            try:
                result = db.execute(text(f"DELETE FROM {table}"))  # noqa: S608
                removed += result.rowcount or 0
            except Exception as exc:  # noqa: BLE001
                db.rollback()
                print(f"  {label}: не удалось ({type(exc).__name__})")
        db.commit()

        print(f"\nУдалено записей: {removed}")
        left = [(label, count(table)) for table, label in tables]
        remaining = [(label, rows) for label, rows in left if rows > 0]
        if remaining:
            print("Осталось (проверьте, так ли задумано):")
            for label, rows in remaining:
                print(f"  {label:<30} {rows}")
        else:
            print("Рабочих данных в базе не осталось.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
