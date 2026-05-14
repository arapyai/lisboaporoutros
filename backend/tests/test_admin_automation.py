from app.models.entities import AudioFile, Text, Translation, Voice
from app.models.enums import SupportedLanguage, TranslationStatus
from tests.test_admin_content import auth_header
from tests.test_api_public import seed_public_data


def test_translation_workflow_stays_pending_until_review(client, db_session) -> None:
    headers = auth_header(client, db_session)
    ids = seed_public_data(db_session)
    text = db_session.query(Text).filter(Text.point_id == ids["point"].id).one()

    response = client.post(f"/api/v1/admin/translations/{text.id}/es", headers=headers)

    assert response.status_code == 200
    assert response.json()["data"]["status"] == "pending"


def test_translation_review_requires_explicit_status(client, db_session) -> None:
    headers = auth_header(client, db_session)
    ids = seed_public_data(db_session)
    text = db_session.query(Text).filter(Text.point_id == ids["point"].id).one()
    translation = Translation(
        text_id=text.id,
        lang=SupportedLanguage.ES,
        content="No soy nada.",
        status=TranslationStatus.PENDING,
    )
    db_session.add(translation)
    db_session.commit()

    response = client.put(
        f"/api/v1/admin/translations/{translation.id}/review",
        headers=headers,
        json={"content": "No soy nada.", "status": "approved"},
    )

    assert response.status_code == 200
    assert response.json()["data"]["status"] == "approved"


def test_voice_sync_and_default_selection(client, db_session) -> None:
    headers = auth_header(client, db_session)

    sync = client.post("/api/v1/admin/voices/sync", headers=headers)
    assert sync.status_code == 200

    voice = db_session.query(Voice).filter(Voice.elevenlabs_id == "voice-default").one()
    response = client.put(f"/api/v1/admin/voices/{voice.id}/default", headers=headers)

    assert response.status_code == 200
    assert response.json()["data"]["default_voice_id"] == str(voice.id)


def test_manual_audio_upload_is_preserved_over_auto_regeneration(client, db_session) -> None:
    headers = auth_header(client, db_session)
    ids = seed_public_data(db_session)
    text = db_session.query(Text).filter(Text.point_id == ids["point"].id).one()

    upload = client.put(
        f"/api/v1/admin/audio/{text.id}/en/upload",
        headers=headers,
        json={"public_url": "https://audio.example/manual.mp3", "voice_id": "manual"},
    )
    assert upload.status_code == 200

    generate = client.post(f"/api/v1/admin/audio/{text.id}/en/generate", headers=headers)
    assert generate.status_code == 200

    audio_file = db_session.query(AudioFile).filter(AudioFile.text_id == text.id).one()
    assert audio_file.public_url == "https://audio.example/manual.mp3"
    assert audio_file.manually_uploaded is True


def test_audio_job_runs_and_sse_reports_completion(client, db_session) -> None:
    headers = auth_header(client, db_session)
    ids = seed_public_data(db_session)
    text = db_session.query(Text).filter(Text.point_id == ids["point"].id).one()

    response = client.post(
        "/api/v1/admin/audio/jobs",
        headers=headers,
        json={"items": [{"text_id": str(text.id), "lang": "en"}]},
    )

    assert response.status_code == 200
    job_id = response.json()["data"]["job_id"]

    events = client.get(f"/api/v1/admin/audio/jobs/{job_id}/events", headers=headers)
    assert events.status_code == 200
    assert "completed" in events.text
