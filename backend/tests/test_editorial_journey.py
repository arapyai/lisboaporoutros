"""API journey: no ready-route seed and no mocked editorial/readiness responses."""

from app.api.routes import admin_automation, admin_routes
from app.models.entities import AudioGenerationJob
from tests.test_admin_automation import MP3_ONE
from tests.test_admin_content import auth_header
from tests.test_route_readiness import StubProvider

CSV = (
    b"point_name,address,lat_override,lng_override,author_name,content_pt,content_en,"
    b"content_type,source_work\n"
    b"Lugar A,Rua A,38.71,-9.14,Autora QA,Primeiro trecho,First passage,prose,Obra A\n"
    b"Lugar B,Rua B,38.72,-9.13,Autora QA,Segundo trecho,Second passage,prose,Obra B\n"
    b"Linha invalida,Rua C,38.73,-9.12,Autora QA,,Missing original,prose,Obra C\n"
)


def data(response):
    assert response.status_code == 200, response.text
    return response.json()["data"]


class ForbiddenAudioProvider:
    def generate_audio(self, *_args, **_kwargs):
        raise AssertionError("This journey must never call a paid audio provider")


def test_import_review_manual_audio_route_readiness_and_publication_journey(
    client, db_session, monkeypatch
):
    headers = auth_header(client, db_session)
    monkeypatch.setattr(admin_automation, "elevenlabs_service", ForbiddenAudioProvider())
    # Only the external walking provider is doubled; API rules and persistence are real.
    monkeypatch.setattr(admin_routes, "directions_provider_factory", lambda: StubProvider())
    files = {"file": ("journey.csv", CSV, "text/csv")}
    preview = data(client.post("/api/v1/admin/points/import/preview", headers=headers, files=files))
    assert [row["action"] for row in preview] == ["create", "create", "error"]
    assert "content_pt is required" in preview[2]["errors"]
    assert data(client.get("/api/v1/admin/texts", headers=headers)) == []

    imported = data(
        client.post("/api/v1/admin/points/import/confirm", headers=headers, files=files)
    )
    assert imported["created"] == 2
    assert len(imported["errors"]) == 1
    texts = data(client.get("/api/v1/admin/texts", headers=headers))
    assert len(texts) == 2
    assert all(text["origin"] == "import" for text in texts)
    translations = data(client.get("/api/v1/admin/translations", headers=headers))
    assert len(translations) == 2
    assert all(version["status"] == "pending" for version in translations)

    route = data(
        client.post(
            "/api/v1/admin/routes",
            headers=headers,
            json={
                "title_pt": "Jornada QA",
                "description_pt": "Percurso de teste isolado.",
                "difficulty": "easy",
                "is_published": False,
                "segments": [
                    {"position": 0, "kind": "text", "text_id": texts[0]["id"]},
                    {
                        "position": 1,
                        "kind": "bridge",
                        "bridge_content_pt": "Entre os dois lugares.",
                    },
                    {"position": 2, "kind": "text", "text_id": texts[1]["id"]},
                ],
            },
        )
    )
    route_url = f"/api/v1/admin/routes/{route['id']}"
    bridge_url = f"{route_url}/segments/{route['segments'][1]['id']}"
    assert not route["is_published"]
    blocked = client.put(f"{route_url}/publication", headers=headers, json={"is_published": True})
    assert blocked.status_code == 409
    readiness = data(client.get(f"{route_url}/readiness?lang=en", headers=headers))
    assert not readiness["ready"]
    assert {
        "missing_text_translation",
        "missing_text_audio",
        "missing_bridge_translation",
        "missing_bridge_audio",
        "missing_route_translation",
        "routing_stale",
    } <= {issue["code"] for issue in readiness["issues"]}

    for version in translations:
        blocked_audio = client.post(
            f"/api/v1/admin/audio/{version['text_id']}/en/generate", headers=headers
        )
        assert blocked_audio.status_code == 409
        assert "Approved translation required" in blocked_audio.json()["detail"]
        assert db_session.query(AudioGenerationJob).count() == 0
        reviewed = data(
            client.put(
                f"/api/v1/admin/translations/{version['id']}/review",
                headers=headers,
                json={"content": version["content"], "status": "approved"},
            )
        )
        assert reviewed["status"] == "approved"
        assert reviewed["reviewed_by"] == "admin@example.com"

    uploads = []
    for text in texts:
        for lang in ["pt", "en"]:
            audio = data(
                client.put(
                    f"/api/v1/admin/audio/{text['id']}/{lang}/upload",
                    headers=headers,
                    files={"file": ("manual.mp3", MP3_ONE, "audio/mpeg")},
                )
            )
            assert audio["manually_uploaded"]
            assert client.get(audio["public_url"]).content == MP3_ONE
            uploads.append(audio)
        generated = data(
            client.post(f"/api/v1/admin/audio/{text['id']}/en/generate", headers=headers)
        )
        assert generated["status"] == "completed"
        assert generated["audio"]["manually_uploaded"]

    data(
        client.put(
            f"{bridge_url}/translations/en",
            headers=headers,
            json={"content": "Between the two places.", "status": "approved"},
        )
    )
    for lang in ["pt", "en"]:
        audio = data(
            client.put(
                f"{bridge_url}/audio/{lang}/upload",
                headers=headers,
                files={"file": ("bridge.mp3", MP3_ONE, "audio/mpeg")},
            )
        )
        assert audio["manually_uploaded"]
        uploads.append(audio)
    # Saving pending route metadata is not human approval and does not unlock publication.
    metadata = {"title": "QA journey", "description": "Isolated route.", "status": "pending"}
    data(client.put(f"{route_url}/translations/en", headers=headers, json=metadata))
    data(client.post(f"{route_url}/recalculate", headers=headers, json={"legs": []}))
    assert (
        client.put(
            f"{route_url}/publication", headers=headers, json={"is_published": True}
        ).status_code
        == 409
    )
    final_blockers = data(client.get(f"{route_url}/readiness?lang=en", headers=headers))
    assert {issue["code"] for issue in final_blockers["issues"]} == {"missing_route_translation"}
    data(
        client.put(
            f"{route_url}/translations/en", headers=headers, json={**metadata, "status": "approved"}
        )
    )
    for lang in ["pt", "en"]:
        assert data(client.get(f"{route_url}/readiness?lang={lang}", headers=headers)) == {
            "lang": lang,
            "ready": True,
            "issues": [],
        }
    assert data(client.get("/api/v1/routes")) == []
    published = data(
        client.put(f"{route_url}/publication", headers=headers, json={"is_published": True})
    )
    assert published["is_published"]
    for lang in ["pt", "en"]:
        public = data(client.get(f"/api/v1/routes/{route['id']}?lang={lang}"))
        assert len(public["segments"]) == 3
        rss = client.get(f"/api/v1/routes/{route['id']}/podcast.rss?lang={lang}")
        assert rss.status_code == 200
        assert rss.text.count("<enclosure ") == 3
    for audio in uploads:
        assert client.get(audio["public_url"]).content == MP3_ONE
    repeated = data(
        client.post("/api/v1/admin/points/import/confirm", headers=headers, files=files)
    )
    assert repeated["texts"]["reused"] == 2
    assert repeated["translations"]["reused"] == 2
    assert all(
        version["status"] == "approved"
        for version in data(client.get("/api/v1/admin/translations", headers=headers))
    )
