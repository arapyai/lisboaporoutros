from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.entities import PointType
from app.schemas.common import EnvelopeMeta, envelope
from app.services.point_types import serialize_point_type

router = APIRouter(prefix="/api/v1/point-types", tags=["point-types"])


@router.get("")
def list_point_types(db: Annotated[Session, Depends(get_db)]) -> dict[str, object]:
    items = db.scalars(
        select(PointType)
        .where(PointType.is_active.is_(True))
        .order_by(PointType.sort_order, PointType.name_pt)
    ).all()
    return envelope([serialize_point_type(item) for item in items], EnvelopeMeta(total=len(items)))
