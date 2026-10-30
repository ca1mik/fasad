from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.pagination import PageParams, get_page_params
from app.core.responses import envelope
from app.db.session import get_db
from app.modules.auth.dependencies import require_permissions
from app.modules.shared.schemas import Envelope
from app.modules.stock.schemas import StockItemRead, StockMovementRead
from app.modules.stock.service import StockService
from app.modules.users.models import User

router = APIRouter()

# Остатки и движения материала — зона склада и производства. Заказчик считает
# остатки коммерческой информацией: работник цеха отчитывается по этапам, а не
# смотрит, сколько плиты лежит на складе.
STOCK_READ = ("stock.manage", "production.manage")


@router.get("/items", response_model=Envelope[list[StockItemRead]])
def list_stock_items(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permissions(*STOCK_READ))],
    params: Annotated[PageParams, Depends(get_page_params)],
) -> dict[str, object]:
    items, meta = StockService.list_stock_items(db, params)
    return envelope([StockItemRead.model_validate(item) for item in items], meta)


@router.get("/movements", response_model=Envelope[list[StockMovementRead]])
def list_stock_movements(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permissions(*STOCK_READ))],
    params: Annotated[PageParams, Depends(get_page_params)],
) -> dict[str, object]:
    items, meta = StockService.list_movements(db, params)
    return envelope([StockMovementRead.model_validate(item) for item in items], meta)
