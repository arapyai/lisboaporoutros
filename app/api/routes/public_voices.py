from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.entities import Voice
from app.schemas.common import EnvelopeMeta, envelope

router = APIRouter(prefix="/api/v1/voices", tags=["voices"])


@router.get("/default")
def get_default_voice(db: Annotated[Session, Depends(get_db)]) -> dict[str, object]:
    voice = db.scalar(select(Voice).where(Voice.is_default.is_(True)))
    if voice is None:
        raise HTTPException(status_code=404, detail="Default voice not found")

    return envelope(
        {
            "id": str(voice.id),
            "elevenlabs_id": voice.elevenlabs_id,
            "name": voice.name,
            "preview_url": voice.preview_url,
        },
        EnvelopeMeta(),
    )
