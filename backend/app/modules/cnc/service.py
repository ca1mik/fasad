from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.modules.audit.service import AuditService
from app.modules.cnc.models import CncJob
from app.modules.orders.models import Order
from app.modules.parts_generator.models import Part
from app.storage.factory import get_storage_backend


class CncService:
    @staticmethod
    def generate_jobs(db: Session, order: Order, acting_user_id: str | None = None) -> list[CncJob]:
        order = (
            db.scalar(
                select(Order)
                .options(selectinload(Order.parts).selectinload(Part.operations))
                .where(Order.id == order.id)
            )
            or order
        )
        if not order.parts:
            raise ValueError("Order has no generated parts")

        storage = get_storage_backend()
        version = (
            db.scalar(select(func.count()).select_from(CncJob).where(CncJob.order_id == order.id))
            or 0
        ) + 1
        created_jobs: list[CncJob] = []

        for part in order.parts:
            lines = [
                f"; Mock CNC program for {part.part_code}",
                f"; Part size: {part.length} x {part.width} x {part.thickness}",
            ]
            for operation in part.operations:
                lines.append(
                    f"{operation.operation_type.upper()} X={operation.x or 0} Y={operation.y or 0} D={operation.diameter or 0} DEPTH={operation.depth or 0}"
                )
            file_name = f"{part.part_code}-v{version}.mpr.txt"
            file_path = storage.save_text(f"cnc/{order.id}/{file_name}", "\n".join(lines))
            job = CncJob(
                order_id=order.id,
                part_id=part.id,
                machine_name="MVP-CNC-01",
                postprocessor="mock_text_v1",
                file_name=file_name,
                file_path=file_path,
                version=version,
                created_by=acting_user_id,
            )
            db.add(job)
            created_jobs.append(job)

        AuditService.log_event(
            db,
            entity_type="order",
            entity_id=str(order.id),
            action="generate_cnc",
            user_id=acting_user_id,
            new_value={"jobs_count": len(created_jobs), "version": version},
        )
        db.commit()
        return created_jobs
