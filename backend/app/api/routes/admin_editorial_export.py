from io import BytesIO
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_admin
from app.core.db import get_db
from app.models.entities import AdminUser, Language, Point, Text
from app.services.editorial_export import build_editorial_workbook

router = APIRouter(prefix="/api/v1/admin/editorial-export", tags=["admin-editorial-export"])


class EditorialExportRequest(BaseModel):
    text_ids: list[UUID] | None = Field(default=None, max_length=5000)


@router.post("")
def export_editorial_workbook(
    payload: EditorialExportRequest,
    _: Annotated[AdminUser, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse:
    query = (
        select(Text)
        .options(
            selectinload(Text.author),
            selectinload(Text.point).selectinload(Point.point_type),
            selectinload(Text.translations),
            selectinload(Text.audio_files),
        )
        .order_by(Text.created_at, Text.id)
    )
    if payload.text_ids is not None:
        query = query.where(Text.id.in_(payload.text_ids))
    texts = db.scalars(query).all()
    language_codes = list(
        db.scalars(
            select(Language.code)
            .where(Language.is_active.is_(True))
            .order_by(Language.is_source.desc(), Language.code)
        ).all()
    )
    workbook = build_editorial_workbook(texts, language_codes)
    return StreamingResponse(
        BytesIO(workbook),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="lisboa-pacote-editorial.xlsx"'},
    )
