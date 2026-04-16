from pydantic import BaseModel, Field


class EnvelopeMeta(BaseModel):
    page: int | None = None
    per_page: int | None = None
    total: int | None = None
    extra: dict[str, object] = Field(default_factory=dict)


def envelope(data: object, meta: EnvelopeMeta) -> dict[str, object]:
    return {"data": data, "meta": meta.model_dump()}
