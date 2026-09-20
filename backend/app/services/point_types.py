import re
import unicodedata
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import PointType
from app.models.point_type_catalog import LITERARY_POINT_TYPE_ID


def serialize_point_type(point_type: PointType) -> dict[str, object]:
    return {
        "id": str(point_type.id),
        "slug": point_type.slug,
        "name_pt": point_type.name_pt,
        "icon_key": point_type.icon_key,
        "color": point_type.color,
        "sort_order": point_type.sort_order,
        "is_active": point_type.is_active,
    }


def slugify_point_type(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    ascii_value = "".join(char for char in decomposed if not unicodedata.combining(char))
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_value.casefold()).strip("-")
    return slug[:64] or "tipo"


def allocate_point_type_slug(db: Session, name: str) -> str:
    base = slugify_point_type(name)
    existing = set(db.scalars(select(PointType.slug).where(PointType.slug.like(f"{base}%"))).all())
    if base not in existing:
        return base
    suffix = 2
    while f"{base[: 63 - len(str(suffix))]}-{suffix}" in existing:
        suffix += 1
    return f"{base[: 63 - len(str(suffix))]}-{suffix}"


def default_point_type(db: Session) -> PointType:
    point_type = db.get(PointType, LITERARY_POINT_TYPE_ID)
    if point_type is None:
        point_type = db.scalar(select(PointType).where(PointType.slug == "literary"))
    if point_type is None:
        raise ValueError("Default literary point type is not configured")
    return point_type


def active_point_type_or_error(db: Session, point_type_id: UUID) -> PointType:
    point_type = db.get(PointType, point_type_id)
    if point_type is None:
        raise ValueError("Point type not found")
    if not point_type.is_active:
        raise ValueError("Point type is inactive")
    return point_type
