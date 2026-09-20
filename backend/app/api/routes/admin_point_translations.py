from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_admin
from app.core.db import get_db
from app.models.entities import AdminUser, Point, PointTranslation
from app.models.enums import TranslationStatus
from app.schemas.common import EnvelopeMeta, envelope
from app.services.editorial_translations import (
    mark_manual_translation,
    resolve_target_language,
    serialize_editorial_metadata,
)
from app.services.llm import LLMTranslationService, request_point_translation

router = APIRouter(prefix="/api/v1/admin/points", tags=["admin-point-translations"])
translation_service = LLMTranslationService()


class PointTranslationWrite(BaseModel):
    title: str = Field(min_length=1)
    description: str | None = None
    status: TranslationStatus = TranslationStatus.PENDING


def point_or_404(db: Session, point_id: UUID) -> Point:
    point = db.scalar(
        select(Point).options(selectinload(Point.translations)).where(Point.id == point_id)
    )
    if point is None:
        raise HTTPException(status_code=404, detail="Point not found")
    return point


def target_language_or_400(db: Session, lang: str) -> str:
    try:
        return resolve_target_language(db, lang)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def serialize_point_translation(item: PointTranslation) -> dict[str, object]:
    return {
        "id": str(item.id),
        "point_id": str(item.point_id),
        "title": item.title,
        "description": item.description,
        **serialize_editorial_metadata(item),
    }


@router.get("/{point_id}/translations")
def list_point_translations(
    point_id: UUID,
    _: Annotated[AdminUser, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    point = point_or_404(db, point_id)
    items = sorted(point.translations, key=lambda item: item.lang)
    return envelope(
        [serialize_point_translation(item) for item in items],
        EnvelopeMeta(total=len(items)),
    )


@router.put("/{point_id}/translations/{lang}")
def upsert_point_translation(
    point_id: UUID,
    lang: str,
    payload: PointTranslationWrite,
    current_admin: Annotated[AdminUser, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    point = point_or_404(db, point_id)
    language = target_language_or_400(db, lang)
    item = next((value for value in point.translations if value.lang == language), None)
    if item is None:
        item = PointTranslation(point_id=point.id, lang=language, title=payload.title)
        db.add(item)
    item.title = payload.title
    item.description = payload.description
    mark_manual_translation(item, status=payload.status, reviewer=current_admin.email)
    db.commit()
    db.refresh(item)
    return envelope(serialize_point_translation(item), EnvelopeMeta())


@router.post("/{point_id}/translations/{lang}/generate")
def generate_point_translation(
    point_id: UUID,
    lang: str,
    _: Annotated[AdminUser, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    point = point_or_404(db, point_id)
    language = target_language_or_400(db, lang)
    item = request_point_translation(db, point, language, translation_service)
    db.commit()
    db.refresh(item)
    return envelope(serialize_point_translation(item), EnvelopeMeta())


@router.delete("/{point_id}/translations/{lang}")
def delete_point_translation(
    point_id: UUID,
    lang: str,
    _: Annotated[AdminUser, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    point = point_or_404(db, point_id)
    language = target_language_or_400(db, lang)
    item = next((value for value in point.translations if value.lang == language), None)
    if item is None:
        raise HTTPException(status_code=404, detail="Point translation not found")
    db.delete(item)
    db.commit()
    return envelope({"deleted": True}, EnvelopeMeta())
