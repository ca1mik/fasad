from __future__ import annotations

import uuid
from collections import defaultdict
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.pagination import PageParams, pagination_meta
from app.db.mixins import utcnow
from app.modules.audit.service import AuditService
from app.modules.orders.models import Order
from app.modules.stock.models import StockItem, StockMovement


class StockService:
    @staticmethod
    def list_stock_items(db: Session, params: PageParams) -> tuple[list[StockItem], dict]:
        stmt = select(StockItem).order_by(StockItem.updated_at.desc())
        total = db.scalar(select(func.count()).select_from(StockItem)) or 0
        items = db.scalars(stmt.offset(params.offset).limit(params.size)).all()
        return items, pagination_meta(total, params)

    @staticmethod
    def list_movements(db: Session, params: PageParams) -> tuple[list[StockMovement], dict]:
        stmt = select(StockMovement).order_by(StockMovement.created_at.desc())
        total = db.scalar(select(func.count()).select_from(StockMovement)) or 0
        items = db.scalars(stmt.offset(params.offset).limit(params.size)).all()
        return items, pagination_meta(total, params)

    @staticmethod
    def _get_or_create_item(
        db: Session,
        *,
        material_type: str,
        material_id: uuid.UUID,
        unit: str,
    ) -> StockItem:
        item = db.scalar(
            select(StockItem).where(
                StockItem.material_type == material_type,
                StockItem.material_id == material_id,
            )
        )
        if item:
            return item
        item = StockItem(
            material_type=material_type,
            material_id=material_id,
            quantity=Decimal("0"),
            reserved_quantity=Decimal("0"),
            unit=unit,
        )
        db.add(item)
        db.flush()
        return item

    @staticmethod
    def reserve_for_order(db: Session, order: Order, acting_user_id: str | None = None) -> None:
        material_needs: dict[uuid.UUID, Decimal] = defaultdict(lambda: Decimal("0"))
        edge_needs: dict[uuid.UUID, Decimal] = defaultdict(lambda: Decimal("0"))

        for part in order.parts:
            material_needs[part.material_id] += (
                Decimal(part.length) * Decimal(part.width) * Decimal(part.quantity)
            ) / Decimal("1000000")
            for edge in part.edges:
                edge_needs[edge.edge_material_id] += (
                    Decimal(edge.length_mm) * Decimal(part.quantity)
                ) / Decimal("1000")

        for material_id, qty in material_needs.items():
            stock_item = StockService._get_or_create_item(
                db, material_type="material", material_id=material_id, unit="sqm"
            )
            stock_item.reserved_quantity += qty
            stock_item.updated_at = utcnow()
            db.add(
                StockMovement(
                    stock_item_id=stock_item.id,
                    order_id=order.id,
                    movement_type="reserve",
                    quantity=qty,
                    unit=stock_item.unit,
                    created_by=acting_user_id,
                    comment=f"Reserve material for order {order.order_number}",
                )
            )

        for edge_material_id, qty in edge_needs.items():
            stock_item = StockService._get_or_create_item(
                db, material_type="edge_material", material_id=edge_material_id, unit="m"
            )
            stock_item.reserved_quantity += qty
            stock_item.updated_at = utcnow()
            db.add(
                StockMovement(
                    stock_item_id=stock_item.id,
                    order_id=order.id,
                    movement_type="reserve",
                    quantity=qty,
                    unit=stock_item.unit,
                    created_by=acting_user_id,
                    comment=f"Reserve edge for order {order.order_number}",
                )
            )

        AuditService.log_event(
            db,
            entity_type="order",
            entity_id=str(order.id),
            action="reserve_stock",
            user_id=acting_user_id,
        )
        db.commit()

    @staticmethod
    def writeoff_for_order(db: Session, order: Order, acting_user_id: str | None = None) -> None:
        for part in order.parts:
            area_qty = (
                Decimal(part.length) * Decimal(part.width) * Decimal(part.quantity)
            ) / Decimal("1000000")
            stock_item = StockService._get_or_create_item(
                db, material_type="material", material_id=part.material_id, unit="sqm"
            )
            stock_item.quantity -= area_qty
            stock_item.reserved_quantity = max(
                stock_item.reserved_quantity - area_qty, Decimal("0")
            )
            stock_item.updated_at = utcnow()
            db.add(
                StockMovement(
                    stock_item_id=stock_item.id,
                    order_id=order.id,
                    movement_type="writeoff",
                    quantity=area_qty,
                    unit=stock_item.unit,
                    created_by=acting_user_id,
                    comment=f"Write off material for order {order.order_number}",
                )
            )
            for edge in part.edges:
                edge_qty = (Decimal(edge.length_mm) * Decimal(part.quantity)) / Decimal("1000")
                edge_stock_item = StockService._get_or_create_item(
                    db,
                    material_type="edge_material",
                    material_id=edge.edge_material_id,
                    unit="m",
                )
                edge_stock_item.quantity -= edge_qty
                edge_stock_item.reserved_quantity = max(
                    edge_stock_item.reserved_quantity - edge_qty, Decimal("0")
                )
                edge_stock_item.updated_at = utcnow()
                db.add(
                    StockMovement(
                        stock_item_id=edge_stock_item.id,
                        order_id=order.id,
                        movement_type="writeoff",
                        quantity=edge_qty,
                        unit=edge_stock_item.unit,
                        created_by=acting_user_id,
                        comment=f"Write off edge for order {order.order_number}",
                    )
                )

        order.production_start_at = order.production_start_at or utcnow()
        AuditService.log_event(
            db,
            entity_type="order",
            entity_id=str(order.id),
            action="writeoff_stock",
            user_id=acting_user_id,
        )
        db.commit()
