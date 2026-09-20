from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.core.db import get_db
from app.models.entities import AdminUser, Point, PointType
from app.models.point_type_catalog import POINT_TYPE_COLORS, POINT_TYPE_ICONS
from app.schemas.common import EnvelopeMeta, envelope
from app.services.point_types import allocate_point_type_slug, serialize_point_type

router = APIRouter(prefix="/api/v1/admin/point-types", tags=["admin-point-types"])


class PointTypeWrite(BaseModel):
    name_pt: str = Field(min_length=1, max_length=120)
    icon_key: str
    color: str
    sort_order: int = 0
    is_active: bool = True

    @field_validator("icon_key")
    @classmethod
    def validate_icon(cls, value: str) -> str:
        if value not in POINT_TYPE_ICONS:
            raise ValueError("Unknown point type icon")
        return value

    @field_validator("color")
    @classmethod
    def validate_color(cls, value: str) -> str:
        normalized = value.upper()
        if normalized not in POINT_TYPE_COLORS:
            raise ValueError("Unknown point type color")
        return normalized


def get_point_type_or_404(db: Session, point_type_id: UUID) -> PointType:
    point_type = db.get(PointType, point_type_id)
    if point_type is None:
        raise HTTPException(status_code=404, detail="Point type not found")
    return point_type


@router.get("")
def list_point_types(
    _: Annotated[AdminUser, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    items = db.scalars(select(PointType).order_by(PointType.sort_order, PointType.name_pt)).all()
    return envelope([serialize_point_type(item) for item in items], EnvelopeMeta(total=len(items)))


@router.post("")
def create_point_type(
    payload: PointTypeWrite,
    _: Annotated[AdminUser, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    point_type = PointType(
        slug=allocate_point_type_slug(db, payload.name_pt), **payload.model_dump()
    )
    db.add(point_type)
    db.commit()
    db.refresh(point_type)
    return envelope(serialize_point_type(point_type), EnvelopeMeta())


@router.put("/{point_type_id}")
def update_point_type(
    point_type_id: UUID,
    payload: PointTypeWrite,
    _: Annotated[AdminUser, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    point_type = get_point_type_or_404(db, point_type_id)
    for field, value in payload.model_dump().items():
        setattr(point_type, field, value)
    db.commit()
    db.refresh(point_type)
    return envelope(serialize_point_type(point_type), EnvelopeMeta())


@router.delete("/{point_type_id}")
def delete_point_type(
    point_type_id: UUID,
    _: Annotated[AdminUser, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    point_type = get_point_type_or_404(db, point_type_id)
    point_count = db.scalar(
        select(func.count(Point.id)).where(Point.point_type_id == point_type.id)
    )
    if point_count:
        raise HTTPException(
            status_code=409,
            detail={"code": "point_type_in_use", "point_count": point_count},
        )
    db.delete(point_type)
    db.commit()
    return envelope({"deleted": True}, EnvelopeMeta())
