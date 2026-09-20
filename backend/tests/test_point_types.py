from io import BytesIO
from types import SimpleNamespace
from uuid import UUID

from sqlalchemy import func, select

from app.core.security import hash_password
from app.models.entities import (
    AdminUser,
    Point,
    PointTranslation,
    PointType,
    TranslationGenerationJob,
)
from app.models.enums import TextOrigin, TranslationStatus
from app.services.llm import LLMTranslationService
from app.services.point_catalog_import import build_catalog_plan
from app.services.translation_jobs import claim_next_translation_job, process_translation_job


def auth_header(client, db_session) -> dict[str, str]:
    admin = AdminUser(
        email="points-admin@example.com",
        password_hash=hash_password("secret"),
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()
    response = client.post(
        "/api/v1/admin/auth/login",
        json={"email": admin.email, "password": "secret"},
    )
    return {"Authorization": f"Bearer {response.json()['data']['access_token']}"}


def point_type_by_slug(client, slug: str, headers: dict[str, str]) -> dict[str, object]:
    response = client.get("/api/v1/admin/point-types", headers=headers)
    return next(item for item in response.json()["data"] if item["slug"] == slug)


def create_point(
    client,
    headers: dict[str, str],
    point_type_id: str,
    *,
    title: str = "Biblioteca do Jardim",
) -> dict[str, object]:
    response = client.post(
        "/api/v1/admin/points",
        json={
            "point_type_id": point_type_id,
            "title_pt": title,
            "description_pt": "Um lugar aberto para ler.",
            "address": "Rua do Jardim, Lisboa",
            "lat": 38.713,
            "lng": -9.139,
        },
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()["data"]


def test_point_type_crud_validation_and_in_use_protection(client, db_session) -> None:
    headers = auth_header(client, db_session)

    public = client.get("/api/v1/point-types")
    assert [item["slug"] for item in public.json()["data"]] == ["literary", "reading"]

    invalid = client.post(
        "/api/v1/admin/point-types",
        json={"name_pt": "Livre", "icon_key": "<svg>", "color": "#123456"},
        headers=headers,
    )
    assert invalid.status_code == 422

    created = client.post(
        "/api/v1/admin/point-types",
        json={
            "name_pt": "Café literário",
            "icon_key": "coffee",
            "color": "#6F5147",
            "sort_order": 30,
            "is_active": True,
        },
        headers=headers,
    )
    assert created.status_code == 200
    created_type = created.json()["data"]
    assert created_type["slug"] == "cafe-literario"

    updated = client.put(
        f"/api/v1/admin/point-types/{created_type['id']}",
        json={
            "name_pt": "Café e leitura",
            "icon_key": "coffee",
            "color": "#6F5147",
            "sort_order": 35,
            "is_active": True,
        },
        headers=headers,
    )
    assert updated.json()["data"]["slug"] == "cafe-literario"

    create_point(client, headers, created_type["id"])
    protected = client.delete(f"/api/v1/admin/point-types/{created_type['id']}", headers=headers)
    assert protected.status_code == 409
    assert protected.json()["detail"]["code"] == "point_type_in_use"

    deactivated = client.put(
        f"/api/v1/admin/point-types/{created_type['id']}",
        json={
            "name_pt": "Café e leitura",
            "icon_key": "coffee",
            "color": "#6F5147",
            "sort_order": 35,
            "is_active": False,
        },
        headers=headers,
    )
    assert deactivated.status_code == 200
    assert "cafe-literario" not in {
        item["slug"] for item in client.get("/api/v1/point-types").json()["data"]
    }
    assert client.get("/api/v1/points?type=cafe-literario").json()["data"] == []


def test_public_point_type_filter_and_approved_translation_fallback(client, db_session) -> None:
    headers = auth_header(client, db_session)
    reading = point_type_by_slug(client, "reading", headers)
    point = create_point(client, headers, reading["id"])

    assert client.get("/api/v1/points?type=missing").json()["data"] == []
    assert client.get("/api/v1/points?lang=xx").status_code == 400

    pending = client.put(
        f"/api/v1/admin/points/{point['id']}/translations/en",
        json={"title": "Garden Library", "description": None, "status": "pending"},
        headers=headers,
    )
    assert pending.status_code == 200
    fallback = client.get("/api/v1/points?type=reading&lang=en").json()["data"][0]
    assert fallback["title"] == "Biblioteca do Jardim"
    assert fallback["description"] == "Um lugar aberto para ler."

    approved = client.put(
        f"/api/v1/admin/points/{point['id']}/translations/en",
        json={"title": "Garden Library", "description": None, "status": "approved"},
        headers=headers,
    )
    assert approved.json()["data"]["status"] == "approved"
    localized = client.get("/api/v1/points?type=reading&lang=en").json()["data"][0]
    assert localized["title"] == "Garden Library"
    assert localized["description"] == "Um lugar aberto para ler."
    assert localized["point_type"]["icon_key"] == "library"
    assert localized["texts_count"] == 0


def test_point_translation_generation_and_batch_never_queue_audio(client, db_session) -> None:
    headers = auth_header(client, db_session)
    reading = point_type_by_slug(client, "reading", headers)
    point = create_point(client, headers, reading["id"])

    generated = client.post(
        f"/api/v1/admin/points/{point['id']}/translations/en/generate", headers=headers
    )
    assert generated.status_code == 200
    assert generated.json()["data"]["status"] == "pending"
    assert generated.json()["data"]["auto_translated"] is True

    removed = client.delete(f"/api/v1/admin/points/{point['id']}/translations/en", headers=headers)
    assert removed.status_code == 200
    batch_response = client.post(
        "/api/v1/admin/automation/point-batches",
        json={
            "point_ids": [point["id"]],
            "target_languages": ["en"],
            "policy": "missing_only",
        },
        headers=headers,
    )
    assert batch_response.status_code == 200, batch_response.text
    batch_id = batch_response.json()["data"]["id"]

    job_id = claim_next_translation_job(db_session)
    assert job_id is not None
    process_translation_job(db_session, job_id, LLMTranslationService(api_key=""))
    batch = client.get(f"/api/v1/admin/automation/batches/{batch_id}", headers=headers).json()[
        "data"
    ]
    assert batch["current_stage"] == "awaiting_review"
    assert batch["pending_reviews"][0]["target_kind"] == "point"
    assert batch["items"][0]["target_id"] == point["id"]
    assert batch["items"][0]["text_id"] is None

    audio = client.post(
        f"/api/v1/admin/automation/batches/{batch_id}/translated-audio",
        headers=headers,
    )
    assert audio.status_code == 409

    translation = db_session.scalar(
        select(PointTranslation).where(PointTranslation.point_id == UUID(point["id"]))
    )
    assert translation is not None
    approved = client.put(
        f"/api/v1/admin/points/{point['id']}/translations/en",
        json={
            "title": translation.title,
            "description": translation.description,
            "status": "approved",
        },
        headers=headers,
    )
    assert approved.status_code == 200
    completed = client.get(f"/api/v1/admin/automation/batches/{batch_id}", headers=headers).json()[
        "data"
    ]
    assert completed["status"] == "completed"
    assert db_session.scalar(select(func.count(TranslationGenerationJob.id))) == 1


def test_point_batch_replace_automatic_preserves_manual_translation(client, db_session) -> None:
    headers = auth_header(client, db_session)
    literary = point_type_by_slug(client, "literary", headers)
    point = create_point(client, headers, literary["id"])
    manual = PointTranslation(
        point_id=UUID(point["id"]),
        lang="en",
        title="Manual title",
        status=TranslationStatus.PENDING,
        origin=TextOrigin.MANUAL.value,
        auto_translated=False,
    )
    db_session.add(manual)
    db_session.commit()

    response = client.post(
        "/api/v1/admin/automation/point-batches",
        json={
            "point_ids": [point["id"]],
            "target_languages": ["en"],
            "policy": "replace_automatic",
        },
        headers=headers,
    )
    assert response.status_code == 200
    job_id = claim_next_translation_job(db_session)
    process_translation_job(db_session, job_id, LLMTranslationService(api_key=""))
    db_session.refresh(manual)
    assert manual.title == "Manual title"
    item = db_session.get(TranslationGenerationJob, job_id).items[0]
    assert item.was_skipped is True


def test_failed_point_batch_item_can_be_retried(client, db_session) -> None:
    headers = auth_header(client, db_session)
    reading = point_type_by_slug(client, "reading", headers)
    point = create_point(client, headers, reading["id"])
    response = client.post(
        "/api/v1/admin/automation/point-batches",
        json={"point_ids": [point["id"]], "target_languages": ["en"]},
        headers=headers,
    )
    batch_id = response.json()["data"]["id"]
    job = db_session.scalar(select(TranslationGenerationJob))
    item = job.items[0]
    job.status = "completed"
    job.failed = 1
    job.processed = 1
    item.status = "failed"
    item.error_message = "temporary provider error"
    db_session.commit()

    retried = client.post(
        f"/api/v1/admin/automation/batches/{batch_id}/retry-failed", headers=headers
    )
    assert retried.status_code == 200
    retry_item = retried.json()["data"]["items"][0]
    assert retry_item["target_kind"] == "point"
    assert retry_item["status"] == "pending"
    retry_job_id = claim_next_translation_job(db_session)
    assert retry_job_id is not None
    process_translation_job(db_session, retry_job_id, LLMTranslationService(api_key=""))
    assert (
        client.get(f"/api/v1/admin/automation/batches/{batch_id}", headers=headers).json()["data"][
            "current_stage"
        ]
        == "awaiting_review"
    )


def test_replace_automatic_policy_regenerates_unreviewed_point_translation(
    client, db_session
) -> None:
    headers = auth_header(client, db_session)
    reading = point_type_by_slug(client, "reading", headers)
    point = create_point(client, headers, reading["id"])
    automatic = PointTranslation(
        point_id=UUID(point["id"]),
        lang="en",
        title="Outdated automatic title",
        status=TranslationStatus.PENDING,
        origin=TextOrigin.AUTOMATIC.value,
        auto_translated=True,
    )
    db_session.add(automatic)
    db_session.commit()
    response = client.post(
        "/api/v1/admin/automation/point-batches",
        json={
            "point_ids": [point["id"]],
            "target_languages": ["en"],
            "policy": "replace_automatic",
        },
        headers=headers,
    )
    assert response.status_code == 200
    job_id = claim_next_translation_job(db_session)
    process_translation_job(db_session, job_id, LLMTranslationService(api_key=""))
    db_session.refresh(automatic)
    assert automatic.title != "Outdated automatic title"
    item = db_session.get(TranslationGenerationJob, job_id).items[0]
    assert item.was_skipped is False


def test_point_catalog_csv_preview_confirm_and_idempotency(client, db_session) -> None:
    headers = auth_header(client, db_session)
    csv_content = (
        "point_id,point_type,point_name,description_pt,address,neighborhood,city,country,"
        "lat_override,lng_override,point_name_en,description_en\n"
        ",reading,Sala de Leitura,Leitura livre,Rua Nova 1,Baixa,Lisboa,Portugal,"
        "38.7101,-9.1401,Reading Room,Free reading\n"
    )
    files = {"file": ("points.csv", BytesIO(csv_content.encode()), "text/csv")}
    preview = client.post(
        "/api/v1/admin/points/catalog-import/preview", files=files, headers=headers
    )
    assert preview.status_code == 200, preview.text
    assert preview.json()["data"][0]["action"] == "create"

    files = {"file": ("points.csv", BytesIO(csv_content.encode()), "text/csv")}
    confirmed = client.post(
        "/api/v1/admin/points/catalog-import/confirm", files=files, headers=headers
    )
    assert confirmed.status_code == 200
    result = confirmed.json()["data"]
    assert result["created"] == 1
    assert len(result["imported_point_ids"]) == 1
    translation = db_session.scalar(select(PointTranslation).where(PointTranslation.lang == "en"))
    assert translation is not None
    assert translation.status == TranslationStatus.PENDING
    assert translation.auto_translated is False
    assert translation.origin == TextOrigin.MANUAL.value

    without_description = csv_content.replace("Leitura livre", "")
    files = {"file": ("points.csv", BytesIO(without_description.encode()), "text/csv")}
    repeated = client.post(
        "/api/v1/admin/points/catalog-import/confirm", files=files, headers=headers
    )
    assert repeated.status_code == 200
    assert repeated.json()["data"]["updated"] == 1
    assert db_session.scalar(select(func.count(Point.id))) == 1
    point = db_session.scalar(select(Point))
    assert point.description_pt == "Leitura livre"

    update_by_id = (
        "point_id,point_type,point_name,description_pt,address,lat_override,lng_override\n"
        f"{point.id},,,,,,\n"
    )
    response = client.post(
        "/api/v1/admin/points/catalog-import/confirm",
        files={"file": ("points.csv", BytesIO(update_by_id.encode()), "text/csv")},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["data"]["updated"] == 1
    db_session.refresh(point)
    assert point.title_pt == "Sala de Leitura"
    assert point.description_pt == "Leitura livre"


def test_point_catalog_preview_reports_invalid_rows(client, db_session) -> None:
    headers = auth_header(client, db_session)
    csv_content = (
        "point_type,point_name,address,lat_override,lng_override\nunknown,Sem coordenadas,,95,200\n"
    )
    response = client.post(
        "/api/v1/admin/points/catalog-import/preview",
        files={"file": ("points.csv", BytesIO(csv_content.encode()), "text/csv")},
        headers=headers,
    )
    assert response.status_code == 200
    errors = response.json()["data"][0]["errors"]
    assert any("point_type" in error for error in errors)
    assert any("lat_override" in error or "lng_override" in error for error in errors)


def test_point_catalog_geocoding_deduplication_and_ambiguous_matches(db_session) -> None:
    reading = db_session.scalar(select(PointType).where(PointType.slug == "reading"))
    assert reading is not None

    geocoded_csv = (
        "point_type,point_name,address,city,country,lat_override,lng_override\n"
        "reading,Biblioteca Nova,Rua Nova 5,Lisboa,Portugal,,\n"
    )
    geocoder_calls: list[dict[str, object]] = []

    def geocoder(**kwargs):
        geocoder_calls.append(kwargs)
        return SimpleNamespace(lat=38.72, lng=-9.13)

    geocoded = build_catalog_plan(geocoded_csv, db_session, geocoder=geocoder)
    assert geocoded[0].preview.errors == []
    assert geocoded[0].preview.geocoded is True
    assert (geocoded[0].preview.lat, geocoded[0].preview.lng) == (38.72, -9.13)
    assert geocoder_calls == [
        {
            "address": "Rua Nova 5",
            "neighborhood": None,
            "city": "Lisboa",
            "country": "Portugal",
        }
    ]

    db_session.add_all(
        [
            Point(
                point_type_id=reading.id,
                title_pt="Sala Única",
                address="Rua Igual 1",
                lat=38.71,
                lng=-9.14,
            ),
            Point(
                point_type_id=reading.id,
                title_pt="Sala Unica",
                address="Rua Igual 1",
                lat=38.72,
                lng=-9.15,
            ),
        ]
    )
    db_session.commit()
    ambiguous_csv = (
        "point_type,point_name,address,lat_override,lng_override\n"
        "reading,Sala Unica,Rua Igual 1,38.73,-9.16\n"
        "reading,Sala Unica,Rua Igual 1,38.74,-9.17\n"
    )
    ambiguous = build_catalog_plan(ambiguous_csv, db_session, geocoder=geocoder)
    assert any("more than one point" in error for error in ambiguous[0].preview.errors)
    assert any("duplicated in this CSV" in error for error in ambiguous[1].preview.errors)

    reading.is_active = False
    db_session.commit()
    inactive = build_catalog_plan(
        "point_type,point_name,address,lat_override,lng_override\n"
        "reading,Outra sala,Rua Outra 2,38.70,-9.12\n",
        db_session,
        geocoder=geocoder,
    )
    assert any("unknown, inactive" in error for error in inactive[0].preview.errors)
