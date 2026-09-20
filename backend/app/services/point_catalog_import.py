import csv
import io
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Language, Point, PointTranslation, PointType
from app.models.enums import TextOrigin, TranslationStatus
from app.services.csv_import import clean, normalize_lookup, parse_coordinate_pair
from app.services.geocoding import geocode_address

BASE_COLUMNS = (
    "point_id",
    "point_type",
    "point_name",
    "description_pt",
    "address",
    "neighborhood",
    "city",
    "country",
    "lat_override",
    "lng_override",
)
REQUIRED_COLUMNS = {"point_type", "point_name"}


@dataclass
class CatalogPreviewRow:
    row_number: int
    point_id: str | None
    point_name: str
    point_type: str
    action: str
    geocoded: bool
    lat: float | None
    lng: float | None
    errors: list[str]


@dataclass
class CatalogPlanRow:
    source: dict[str, str]
    preview: CatalogPreviewRow
    existing_id: UUID | None
    point_type_id: UUID | None
    translations: dict[str, tuple[str, str | None]]


def build_catalog_template(language_codes: list[str] | tuple[str, ...] = ("en",)) -> str:
    target_codes = tuple(code for code in language_codes if code != "pt")
    fields = (
        *BASE_COLUMNS,
        *(f"point_name_{code}" for code in target_codes),
        *(f"description_{code}" for code in target_codes),
    )
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    writer.writerow(
        {
            "point_type": "reading",
            "point_name": "Ponto de Leitura da Baixa",
            "description_pt": "Espaço público dedicado à leitura.",
            "address": "Praça do Comércio, Lisboa",
            "neighborhood": "Baixa",
        }
    )
    return output.getvalue()


def parse_catalog_rows(content: str) -> list[dict[str, str]]:
    reader = csv.DictReader(io.StringIO(content.lstrip("\ufeff")))
    if reader.fieldnames is None:
        raise ValueError("CSV header is required")
    fields = {field.strip() for field in reader.fieldnames if field}
    missing = REQUIRED_COLUMNS - fields
    if missing:
        raise ValueError(f"Missing required CSV columns: {', '.join(sorted(missing))}")
    return [dict(row) for row in reader]


def build_catalog_plan(
    content: str,
    db: Session,
    *,
    geocoder=geocode_address,
) -> list[CatalogPlanRow]:
    rows = parse_catalog_rows(content)
    point_types = {
        item.slug: item
        for item in db.scalars(select(PointType).where(PointType.is_active.is_(True))).all()
    }
    points = list(db.scalars(select(Point)).all())
    active_languages = set(
        db.scalars(select(Language.code).where(Language.is_active.is_(True))).all()
    )
    translation_languages = sorted(
        field.removeprefix("point_name_")
        for field in (rows[0].keys() if rows else [])
        if field.startswith("point_name_") and field != "point_name_pt"
    )
    plan: list[CatalogPlanRow] = []
    seen_matches: set[tuple[str, str]] = set()

    for row_number, row in enumerate(rows, start=2):
        errors: list[str] = []
        name = clean(row, "point_name")
        type_slug = clean(row, "point_type")
        address = clean(row, "address")
        point_type = point_types.get(type_slug) if type_slug else None

        existing: Point | None = None
        raw_id = clean(row, "point_id")
        if raw_id:
            try:
                existing = db.get(Point, UUID(raw_id))
            except ValueError:
                errors.append("point_id must be a valid UUID")
            if existing is None and not errors:
                errors.append("point_id was not found")
        elif name:
            match_key = (normalize_lookup(name), normalize_lookup(address))
            if match_key in seen_matches:
                errors.append("point_name and address are duplicated in this CSV")
            seen_matches.add(match_key)
            matches = [
                point
                for point in points
                if normalize_lookup(point.title_pt) == normalize_lookup(name)
                and normalize_lookup(point.address or "") == normalize_lookup(address)
            ]
            if len(matches) == 1:
                existing = matches[0]
            elif len(matches) > 1:
                errors.append("point_name and address match more than one point")

        if existing is None:
            if not name:
                errors.append("point_name is required when creating a point")
            if point_type is None:
                errors.append("point_type is unknown, inactive, or missing")
        elif type_slug and point_type is None:
            errors.append("point_type is unknown or inactive")
        elif not type_slug:
            point_type = existing.point_type

        coordinate_errors: list[str] = []
        lat, lng = parse_coordinate_pair(row, coordinate_errors)
        errors.extend(coordinate_errors)
        geocoded = False
        if lat is None and lng is None and existing is not None:
            lat, lng = existing.lat, existing.lng
        elif lat is None and lng is None and not coordinate_errors:
            if not address:
                errors.append("address is required when coordinates are not provided")
            else:
                try:
                    result = geocoder(
                        address=address,
                        neighborhood=clean(row, "neighborhood") or None,
                        city=clean(row, "city") or "Lisboa",
                        country=clean(row, "country") or "Portugal",
                    )
                    lat, lng, geocoded = result.lat, result.lng, True
                except Exception as exc:
                    errors.append(f"geocoding failed: {exc}")

        translations: dict[str, tuple[str, str | None]] = {}
        for lang in translation_languages:
            title = clean(row, f"point_name_{lang}")
            description = clean(row, f"description_{lang}") or None
            if not title and not description:
                continue
            if lang not in active_languages:
                errors.append(f"point_name_{lang} uses an unknown or inactive language")
            elif not title:
                errors.append(f"point_name_{lang} is required when description_{lang} is set")
            else:
                translations[lang] = (title, description)

        plan.append(
            CatalogPlanRow(
                source=row,
                preview=CatalogPreviewRow(
                    row_number=row_number,
                    point_id=str(existing.id) if existing else None,
                    point_name=name or (existing.title_pt if existing else ""),
                    point_type=type_slug or (existing.point_type.slug if existing else ""),
                    action="error" if errors else ("update" if existing else "create"),
                    geocoded=geocoded,
                    lat=lat,
                    lng=lng,
                    errors=errors,
                ),
                existing_id=existing.id if existing else None,
                point_type_id=point_type.id if point_type else None,
                translations=translations,
            )
        )
    return plan


def preview_catalog_import(content: str, db: Session, *, geocoder=geocode_address):
    return [row.preview for row in build_catalog_plan(content, db, geocoder=geocoder)]


def apply_catalog_import(content: str, db: Session, *, geocoder=geocode_address):
    plan = build_catalog_plan(content, db, geocoder=geocoder)
    created = 0
    updated = 0
    imported_ids: list[str] = []
    for item in plan:
        if item.preview.errors:
            continue
        point = db.get(Point, item.existing_id) if item.existing_id else None
        if point is None:
            point = Point(
                point_type_id=item.point_type_id,
                title_pt=item.preview.point_name,
                description_pt=clean(item.source, "description_pt") or None,
                address=clean(item.source, "address") or None,
                neighborhood=clean(item.source, "neighborhood") or None,
                lat=item.preview.lat,
                lng=item.preview.lng,
            )
            db.add(point)
            db.flush()
            created += 1
        else:
            point.point_type_id = item.point_type_id
            for field, source_field in (
                ("title_pt", "point_name"),
                ("description_pt", "description_pt"),
                ("address", "address"),
                ("neighborhood", "neighborhood"),
            ):
                value = clean(item.source, source_field)
                if value:
                    setattr(point, field, value)
            if clean(item.source, "lat_override") and clean(item.source, "lng_override"):
                point.lat = item.preview.lat
                point.lng = item.preview.lng
            updated += 1
        imported_ids.append(str(point.id))

        for lang, (title, description) in item.translations.items():
            translation = db.scalar(
                select(PointTranslation).where(
                    PointTranslation.point_id == point.id,
                    PointTranslation.lang == lang,
                )
            )
            if translation is None:
                translation = PointTranslation(point_id=point.id, lang=lang, title=title)
                db.add(translation)
            translation.title = title
            if description:
                translation.description = description
            translation.status = TranslationStatus.PENDING
            translation.auto_translated = False
            translation.origin = TextOrigin.MANUAL.value
            translation.reviewed_by = None
            translation.reviewed_at = None
    db.commit()
    return {
        "created": created,
        "updated": updated,
        "errors": [row.preview.__dict__ for row in plan if row.preview.errors],
        "imported_point_ids": list(dict.fromkeys(imported_ids)),
    }
