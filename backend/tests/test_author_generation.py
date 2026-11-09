from uuid import uuid4

import pytest

from app.api.routes import admin_entity_translations
from app.models.entities import Author, AuthorTranslation, Language
from app.models.enums import TranslationStatus
from app.services.llm import LLMTranslationService
from tests.test_admin_content import auth_header


def test_generation_upserts_pending_and_clears_previous_approval(client, db_session, monkeypatch):
    headers = auth_header(client, db_session)
    author = Author(name="Autora QA", bio_pt="Autora portuguesa.")
    db_session.add(author)
    db_session.commit()
    calls = []

    def translate(source, target, language):
        calls.append((source.name, source.bio_pt, target, language))
        return "  Portuguese author.  "

    monkeypatch.setattr(
        admin_entity_translations.translation_service, "translate_author", translate
    )
    path = f"/api/v1/admin/authors/{author.id}/translations/en"
    first = client.post(f"{path}/generate", headers=headers)
    assert first.status_code == 200
    generated = first.json()["data"]
    assert generated["bio"] == "Portuguese author."
    assert generated["status"] == "pending"
    assert generated["auto_translated"] is True
    assert generated["origin"] == "automatic"
    approved = client.put(path, headers=headers, json={"bio": "Reviewed", "status": "approved"})
    assert approved.json()["data"]["reviewed_by"] == "admin@example.com"
    assert approved.json()["data"]["reviewed_at"] is not None
    second = client.post(f"{path}/generate", headers=headers)
    assert second.status_code == 200
    assert second.json()["data"]["id"] == generated["id"]
    assert second.json()["data"]["status"] == "pending"
    assert second.json()["data"]["reviewed_by"] is None
    assert second.json()["data"]["reviewed_at"] is None
    assert db_session.query(AuthorTranslation).count() == 1
    assert calls == [("Autora QA", "Autora portuguesa.", "en", "pt")] * 2
    assert db_session.get(Author, author.id).bio_pt == "Autora portuguesa."
    assert client.get(f"/api/v1/authors/{author.id}?lang=en").json()["data"]["bio"] == (
        "Autora portuguesa."
    )


@pytest.mark.parametrize(
    "result", ["", "  ", None, ValueError("private-provider-body"), TimeoutError()]
)
def test_generation_failure_preserves_reviewed_translation(client, db_session, monkeypatch, result):
    headers = auth_header(client, db_session)
    author = Author(name="QA", bio_pt="Português")
    author.translations.append(
        AuthorTranslation(lang="en", bio="Reviewed", status=TranslationStatus.APPROVED)
    )
    db_session.add(author)
    db_session.commit()

    def translate(*_):
        if isinstance(result, Exception):
            raise result
        return result

    monkeypatch.setattr(
        admin_entity_translations.translation_service, "translate_author", translate
    )
    response = client.post(
        f"/api/v1/admin/authors/{author.id}/translations/en/generate", headers=headers
    )
    assert response.status_code == 502
    assert "private-provider-body" not in response.text
    db_session.expire_all()
    version = db_session.query(AuthorTranslation).one()
    assert version.bio == "Reviewed"
    assert version.status == TranslationStatus.APPROVED


@pytest.mark.parametrize("bio", [None, "", "  "])
def test_generation_requires_saved_source_before_provider(client, db_session, monkeypatch, bio):
    headers = auth_header(client, db_session)
    author = Author(name="QA", bio_pt=bio)
    db_session.add(author)
    db_session.commit()

    def forbidden(*_):
        pytest.fail("An empty source must never reach the provider")

    monkeypatch.setattr(
        admin_entity_translations.translation_service, "translate_author", forbidden
    )
    assert (
        client.post(
            f"/api/v1/admin/authors/{author.id}/translations/en/generate", headers=headers
        ).status_code
        == 400
    )
    assert db_session.query(AuthorTranslation).count() == 0


def test_generation_enforces_auth_author_and_target_language(client, db_session, monkeypatch):
    headers = auth_header(client, db_session)
    author = Author(name="QA", bio_pt="Biografia")
    db_session.add(author)
    db_session.get(Language, "es").is_active = False
    db_session.commit()

    def forbidden(*_):
        pytest.fail("Invalid requests must never reach the provider")

    monkeypatch.setattr(
        admin_entity_translations.translation_service, "translate_author", forbidden
    )
    path = f"/api/v1/admin/authors/{author.id}/translations"
    assert client.post(f"{path}/en/generate").status_code == 401
    for language in ["pt", "es", "unknown"]:
        assert client.post(f"{path}/{language}/generate", headers=headers).status_code == 400
    assert (
        client.post(
            f"/api/v1/admin/authors/{uuid4()}/translations/en/generate", headers=headers
        ).status_code
        == 404
    )


def test_biography_service_uses_configured_claude_prompt(monkeypatch):
    service = LLMTranslationService(provider="anthropic", api_key="test-only")
    prompts = []

    def request(prompt):
        prompts.append(prompt)
        return "Portuguese author."

    monkeypatch.setattr(service, "_request_claude", request)
    source = Author(name="Autora QA", bio_pt="Autora portuguesa.")
    assert service.translate_author(source, "en", "pt") == "Portuguese author."
    assert "Target language: en" in prompts[0]
    assert "Source language: pt" in prompts[0]
    assert "Biography:\nAutora portuguesa." in prompts[0]
    assert "Do not add facts" in prompts[0]


def test_biography_service_fails_closed_without_key_or_supported_provider():
    source = Author(name="QA", bio_pt="Biografia")
    with pytest.raises(ValueError, match="API key is not configured"):
        LLMTranslationService(api_key="").translate_author(source, "en", "pt")
    with pytest.raises(ValueError, match="Unsupported LLM provider"):
        LLMTranslationService(provider="unsupported").translate_author(source, "en", "pt")
