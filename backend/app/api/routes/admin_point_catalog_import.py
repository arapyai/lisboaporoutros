from typing import Annotated

from fastapi import APIRouter, Depends, File, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.api.routes.admin_import import read_csv_upload
from app.core.db import get_db
from app.models.entities import AdminUser, Language
from app.schemas.common import EnvelopeMeta, envelope
from app.services.point_catalog_import import (
    apply_catalog_import,
    build_catalog_template,
    preview_catalog_import,
)

router = APIRouter(
    prefix="/api/v1/admin/points/catalog-import", tags=["admin-point-catalog-import"]
)
csv_file = File(...)


@router.get("/template")
def download_template(
    _: Annotated[AdminUser, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    languages = list(
        db.scalars(
            select(Language.code)
            .where(Language.is_active.is_(True), Language.is_source.is_(False))
            .order_by(Language.code)
        ).all()
    )
    return Response(
        content=build_catalog_template(languages),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="point_catalog_template.csv"'},
    )


@router.post("/preview")
async def preview_import(
    _: Annotated[AdminUser, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = csv_file,
) -> dict[str, object]:
    items = preview_catalog_import(await read_csv_upload(file), db)
    return envelope([item.__dict__ for item in items], EnvelopeMeta(total=len(items)))


@router.post("/confirm")
async def confirm_import(
    _: Annotated[AdminUser, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = csv_file,
) -> dict[str, object]:
    return envelope(apply_catalog_import(await read_csv_upload(file), db), EnvelopeMeta())
