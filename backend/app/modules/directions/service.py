from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.modules.audit.service import AuditService
from app.modules.directions.models import ProductionDirection
from app.modules.directions.schemas import DirectionCreate, DirectionUpdate
from app.modules.price_book.kinds import kind_number_suffix


class DirectionService:
    @staticmethod
    def list_directions(db: Session, *, only_active: bool = False) -> list[ProductionDirection]:
        stmt = select(ProductionDirection).order_by(
            ProductionDirection.sort_order.asc(), ProductionDirection.name.asc()
        )
        if only_active:
            stmt = stmt.where(ProductionDirection.is_active.is_(True))
        return list(db.scalars(stmt).all())

    @staticmethod
    def get_direction(db: Session, direction_id: uuid.UUID) -> ProductionDirection:
        direction = db.get(ProductionDirection, direction_id)
        if not direction:
            raise NotFoundError("Производственное направление не найдено")
        return direction

    @staticmethod
    def get_by_code(db: Session, code: str) -> ProductionDirection | None:
        return db.scalar(select(ProductionDirection).where(ProductionDirection.code == code))

    @staticmethod
    def require_by_code(db: Session, code: str) -> ProductionDirection:
        direction = DirectionService.get_by_code(db, code)
        if not direction:
            raise NotFoundError(f"Производственное направление «{code}» не найдено")
        return direction

    @staticmethod
    def resolve(
        db: Session,
        *,
        direction_id: uuid.UUID | None = None,
        direction_code: str | None = None,
    ) -> ProductionDirection | None:
        """Направление по id или коду. ``None`` — направление не указано.

        Направление опционально: заказы, созданные до внедрения справочника,
        и заявки, в которых менеджер ещё не выбрал направление, остаются без него.
        """
        if direction_id is not None:
            return DirectionService.get_direction(db, direction_id)
        if direction_code:
            return DirectionService.require_by_code(db, direction_code)
        return None

    @staticmethod
    def format_order_number(
        sequence: int,
        direction: ProductionDirection | None,
        work_kind: str | None = None,
    ) -> str:
        """Номер заказа по ТЗ: эмаль — «1024», ПВХ — «1024-П», шпон — «1024-Ш».

        Буква направления главнее буквы типа работ: направление менеджер выбрал
        руками, а тип работ система вывела из строк заявки.

        Но у эмали своей буквы нет («1024» и есть эмаль), и тогда букву даёт тип
        работ — заказчик просил, чтобы она зависела «от фрезы, мыла, шпона и
        т.д.». Раньше тип работ смотрели только когда направление вообще не
        выбрано, поэтому заявка «Эмаль + фрезеровка» уходила в цех голым числом
        и пачку было не отличить от обычной эмали.
        """
        base = f"{sequence:04d}"
        suffix = (direction.number_suffix or "").strip() if direction else ""
        if not suffix and work_kind:
            suffix = kind_number_suffix(work_kind)
        return f"{base}-{suffix}" if suffix else base

    @staticmethod
    def create_direction(
        db: Session, payload: DirectionCreate, acting_user_id: uuid.UUID | None = None
    ) -> ProductionDirection:
        if DirectionService.get_by_code(db, payload.code):
            raise ConflictError("Направление с таким кодом уже существует")

        # Сравнение в Python, а не в SQL: справочник крошечный, а регистр
        # кириллицы БД обрабатывают по-разному. Пустая буква разрешена только
        # одному направлению — иначе номера станут неразличимы.
        suffix = (payload.number_suffix or "").strip().casefold()
        for existing in DirectionService.list_directions(db):
            if (existing.number_suffix or "").strip().casefold() == suffix:
                label = f"«{payload.number_suffix}»" if suffix else "без буквы"
                raise ConflictError(
                    f"Номер {label} уже занят направлением «{existing.name}». "
                    "Выберите другую букву."
                )
        direction = ProductionDirection(**payload.model_dump())
        db.add(direction)
        db.flush()
        AuditService.log_event(
            db,
            entity_type="production_direction",
            entity_id=str(direction.id),
            action="create_direction",
            user_id=str(acting_user_id) if acting_user_id else None,
            new_value={"code": direction.code, "name": direction.name},
        )
        db.commit()
        return DirectionService.get_direction(db, direction.id)

    @staticmethod
    def update_direction(
        db: Session,
        direction_id: uuid.UUID,
        payload: DirectionUpdate,
        acting_user_id: uuid.UUID | None = None,
    ) -> ProductionDirection:
        direction = DirectionService.get_direction(db, direction_id)
        old_value = {"name": direction.name, "is_active": direction.is_active}
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(direction, key, value)
        AuditService.log_event(
            db,
            entity_type="production_direction",
            entity_id=str(direction.id),
            action="update_direction",
            user_id=str(acting_user_id) if acting_user_id else None,
            old_value=old_value,
            new_value={"name": direction.name, "is_active": direction.is_active},
        )
        db.commit()
        return DirectionService.get_direction(db, direction.id)
