from __future__ import annotations

import uuid
from datetime import datetime

from app.modules.shared.schemas import ORMModel


class CncJobRead(ORMModel):
    id: uuid.UUID
    order_id: uuid.UUID
    part_id: uuid.UUID | None
    machine_name: str
    postprocessor: str
    file_name: str
    file_path: str
    version: int
    created_at: datetime
    created_by: uuid.UUID | None
