from fastapi import APIRouter

from app.schemas.common import EnvelopeMeta, envelope

router = APIRouter(tags=["health"])


@router.get("/health")
async def healthcheck() -> dict[str, object]:
    return envelope({"status": "ok"}, EnvelopeMeta())
