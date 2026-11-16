from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from app.api.deps import get_current_admin
from app.core.config import get_settings
from app.models.entities import AdminUser
from app.schemas.common import EnvelopeMeta, envelope

router = APIRouter(tags=["health"])


@router.get("/health")
async def healthcheck() -> dict[str, object]:
    return envelope({"status": "ok"}, EnvelopeMeta())


@router.get("/api/v1/admin/health")
async def admin_health(
    request: Request,
    response: Response,
    _: Annotated[AdminUser, Depends(get_current_admin)],
) -> dict[str, object]:
    response.headers["Cache-Control"] = "no-store"
    report = await request.app.state.integration_health.report(get_settings())
    return envelope(report, EnvelopeMeta())
