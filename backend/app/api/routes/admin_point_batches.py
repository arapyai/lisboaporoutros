from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.api.routes.admin_batches import _load_batch, _serialize_batch
from app.core.db import get_db
from app.models.entities import AdminUser, ContentGenerationBatch, Point
from app.schemas.common import EnvelopeMeta, envelope
from app.services.languages import get_active_language, get_source_language
from app.services.translation_jobs import create_point_translation_job

router = APIRouter(prefix="/api/v1/admin/automation/point-batches", tags=["admin-automation"])


class PointBatchCreateRequest(BaseModel):
    point_ids: list[UUID] = Field(min_length=1)
    target_languages: list[str] = Field(min_length=1)
    policy: Literal["missing_only", "replace_automatic"] = "missing_only"
    source: Literal["points", "point-csv"] = "points"


@router.post("")
def create_point_batch(
    payload: PointBatchCreateRequest,
    current_admin: Annotated[AdminUser, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    point_ids = list(dict.fromkeys(payload.point_ids))
    points = list(db.scalars(select(Point).where(Point.id.in_(point_ids))).all())
    if len(points) != len(point_ids):
        raise HTTPException(status_code=404, detail="One or more points were not found")

    source_language = get_source_language(db).code
    target_languages: list[str] = []
    for language in dict.fromkeys(payload.target_languages):
        try:
            normalized = get_active_language(db, language).code
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if normalized == source_language:
            raise HTTPException(status_code=400, detail="Target language is the source language")
        target_languages.append(normalized)

    batch = ContentGenerationBatch(
        created_at=datetime.now(UTC),
        requested_by=current_admin.email,
        source=payload.source,
        voice_overrides={},
        auto_approve_translations=False,
        generate_translated_audio=False,
        status="running",
        current_stage="generating_translations",
    )
    db.add(batch)
    db.flush()
    create_point_translation_job(
        db,
        current_admin.email,
        [(point.id, lang) for point in points for lang in target_languages],
        batch_id=batch.id,
        policy=payload.policy,
    )
    batch = _load_batch(db, batch.id)
    return envelope(_serialize_batch(db, batch, include_items=True), EnvelopeMeta())
