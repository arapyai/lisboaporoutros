import httpx

from app.core.config import get_settings
from app.services import integration_health
from tests.test_route_routing import auth_header

ADMIN_HEALTH = "/api/v1/admin/health"


def test_public_health_does_not_check_providers_and_admin_reports_missing_key(
    client, db_session, monkeypatch
):
    monkeypatch.setenv("ROUTING_PROVIDER", "openrouteservice")
    monkeypatch.setenv("OPENROUTESERVICE_API_KEY", "")
    monkeypatch.setenv("TRANSLATION_LLM_API_KEY", "")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    monkeypatch.setenv("ELEVENLABS_API_KEY", "")
    get_settings.cache_clear()
    assert client.get("/health").json()["data"] == {"status": "ok"}
    assert client.get(ADMIN_HEALTH).status_code == 401
    response = client.get(ADMIN_HEALTH, headers=auth_header(client, db_session))
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    checks = {item["service"]: item for item in response.json()["data"]["checks"]}
    assert checks["routing"]["status"] == "missing_config"
    assert "OPENROUTESERVICE_API_KEY" in checks["routing"]["message"]
    assert checks["database"]["status"] == "ok"


def test_admin_health_reports_failed_provider_without_exposing_secret_and_caches(
    client, db_session, monkeypatch
):
    monkeypatch.setenv("ROUTING_PROVIDER", "openrouteservice")
    monkeypatch.setenv("OPENROUTESERVICE_API_KEY", "test-routing-secret")
    monkeypatch.setenv("TRANSLATION_LLM_API_KEY", "test-translation-secret")
    monkeypatch.setenv("TRANSLATION_LLM_PROVIDER", "claude")
    monkeypatch.setenv("ELEVENLABS_API_KEY", "test-voice-secret")
    monkeypatch.setenv("RESEND_API_KEY", "test-email-secret")
    monkeypatch.setenv("RESEND_FROM_EMAIL", "no-reply@example.test")
    get_settings.cache_clear()
    requests = []
    client_type = httpx.AsyncClient

    def handler(request):
        requests.append((request.method, request.url.path))
        if request.method == "POST":
            assert request.url.path.endswith("/v2/directions/foot-walking/geojson")
            assert request.headers["Authorization"] == "test-routing-secret"
            return httpx.Response(403, text="provider returned test-routing-secret")
        return httpx.Response(200)

    def probe_client(**kwargs):
        return client_type(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(integration_health.httpx, "AsyncClient", probe_client)
    headers = auth_header(client, db_session)
    response = client.get(ADMIN_HEALTH, headers=headers)
    assert response.status_code == 200
    assert "test-" not in response.text
    checks = {item["service"]: item for item in response.json()["data"]["checks"]}
    assert checks["routing"]["status"] == "error"
    assert checks["voice"]["status"] == "ok"
    assert checks["translation"]["status"] == "ok"
    assert checks["email"]["status"] == "configuration_only"
    assert client.get(ADMIN_HEALTH, headers=headers).json() == response.json()
    assert sorted(method for method, _ in requests) == ["GET", "GET", "POST"]
