from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Text, Translation
from app.models.enums import SupportedLanguage, TranslationStatus


@dataclass
class GeminiService:
    def translate(self, text: Text, target_lang: SupportedLanguage) -> str:
        return f"[{target_lang.value}] {text.content_pt}"


def request_translation(
    db: Session,
    text: Text,
    target_lang: SupportedLanguage,
    service: GeminiService,
) -> Translation:
    existing = db.scalar(
        select(Translation).where(Translation.text_id == text.id, Translation.lang == target_lang)
    )
    content = service.translate(text, target_lang)
    if existing is None:
        translation = Translation(
            text_id=text.id,
            lang=target_lang,
            content=content,
            status=TranslationStatus.PENDING,
            auto_translated=True,
        )
        db.add(translation)
        db.flush()
        return translation

    existing.content = content
    existing.status = TranslationStatus.PENDING
    existing.auto_translated = True
    existing.reviewed_by = None
    existing.reviewed_at = None
    db.flush()
    return existing
