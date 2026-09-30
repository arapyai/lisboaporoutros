from datetime import UTC, datetime, timedelta
from unittest.mock import patch
from urllib.error import URLError

from sqlalchemy import select

from app.api.routes import admin_auth
from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models.entities import AdminPasswordReset, AdminUser
from app.services.password_recovery import private_digest, reset_link, send_password_recovery


def setup_recovery(db_session, monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "test-key-not-real")
    monkeypatch.setenv("RESEND_FROM_EMAIL", "Lisboa <no-reply@example.com>")
    get_settings.cache_clear()
    admin = AdminUser(email="owner@example.com", password_hash=hash_password("previous-password"))
    db_session.add(admin)
    db_session.commit()
    return admin


def test_recovery_is_single_use_and_revokes_all_previous_sessions(client, db_session, monkeypatch):
    admin = setup_recovery(db_session, monkeypatch)
    old_session = create_access_token(admin.id)
    sent = []
    monkeypatch.setattr(
        admin_auth,
        "send_password_recovery",
        lambda email, token, request_id: sent.append((email, token)),
    )
    response = client.post(
        "/api/v1/admin/auth/forgot-password", json={"email": "OWNER@EXAMPLE.COM"}
    )
    assert response.status_code == 202
    assert len(sent) == 1
    token = sent[0][1]
    record = db_session.scalar(select(AdminPasswordReset))
    assert record.token_hash == private_digest("token:" + token)
    assert token not in response.text
    assert record.token_hash != token
    payload = {"token": token, "password": "replacement-password"}
    assert client.post("/api/v1/admin/auth/reset-password", json=payload).status_code == 200
    assert client.post("/api/v1/admin/auth/reset-password", json=payload).status_code == 400
    db_session.refresh(admin)
    assert verify_password(payload["password"], admin.password_hash)
    assert admin.auth_version == 1
    assert (
        client.get(
            "/api/v1/admin/auth/me", headers={"Authorization": f"Bearer {old_session}"}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/v1/admin/auth/login", json={"email": admin.email, "password": payload["password"]}
        ).status_code
        == 200
    )


def test_unknown_inactive_and_throttled_requests_share_response(client, db_session, monkeypatch):
    admin = setup_recovery(db_session, monkeypatch)
    sent = []
    monkeypatch.setattr(admin_auth, "send_password_recovery", lambda *args: sent.append(args))
    known = client.post("/api/v1/admin/auth/forgot-password", json={"email": admin.email})
    unknown = client.post(
        "/api/v1/admin/auth/forgot-password", json={"email": "unknown@example.com"}
    )
    assert known.json() == unknown.json()
    for _ in range(5):
        response = client.post("/api/v1/admin/auth/forgot-password", json={"email": admin.email})
        assert response.status_code == 202
        assert response.json() == known.json()
    assert len(sent) == 3
    admin.is_active = False
    db_session.commit()
    response = client.post("/api/v1/admin/auth/forgot-password", json={"email": admin.email})
    assert response.json() == known.json()


def test_expired_link_and_admin_password_change_invalidate_recovery(
    client, db_session, monkeypatch
):
    admin = setup_recovery(db_session, monkeypatch)
    token = "a" * 43
    reset = AdminPasswordReset(
        email_hash="email",
        client_hash="client",
        admin_id=admin.id,
        auth_version=0,
        token_hash=private_digest("token:" + token),
        expires_at=datetime.now(UTC) - timedelta(seconds=1),
    )
    db_session.add(reset)
    db_session.commit()
    payload = {"token": token, "password": "replacement-password"}
    assert client.post("/api/v1/admin/auth/reset-password", json=payload).status_code == 400
    reset.expires_at = datetime.now(UTC) + timedelta(minutes=30)
    admin.auth_version = 1
    db_session.commit()
    assert client.post("/api/v1/admin/auth/reset-password", json=payload).status_code == 400
    assert (
        client.post(
            "/api/v1/admin/auth/reset-password", json={**payload, "password": "short"}
        ).status_code
        == 422
    )


def test_inactive_admin_cannot_receive_or_use_recovery(client, db_session, monkeypatch):
    admin = setup_recovery(db_session, monkeypatch)
    sent = []
    monkeypatch.setattr(admin_auth, "send_password_recovery", lambda *args: sent.append(args))
    admin.is_active = False
    token = "b" * 43
    db_session.add(
        AdminPasswordReset(
            email_hash="email",
            client_hash="client",
            admin_id=admin.id,
            auth_version=0,
            token_hash=private_digest("token:" + token),
            expires_at=datetime.now(UTC) + timedelta(minutes=30),
        )
    )
    db_session.commit()
    assert (
        client.post("/api/v1/admin/auth/forgot-password", json={"email": admin.email}).status_code
        == 202
    )
    assert not sent
    assert (
        client.post(
            "/api/v1/admin/auth/reset-password",
            json={"token": token, "password": "replacement-password"},
        ).status_code
        == 400
    )


def test_missing_configuration_and_untrusted_url_fail_closed(client, db_session, monkeypatch):
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    assert (
        client.post(
            "/api/v1/admin/auth/forgot-password", json={"email": "owner@example.com"}
        ).status_code
        == 503
    )
    setup_recovery(db_session, monkeypatch)
    monkeypatch.setenv("ADMIN_PASSWORD_RESET_URL", "http://untrusted.example")
    get_settings.cache_clear()
    assert (
        client.post(
            "/api/v1/admin/auth/forgot-password", json={"email": "owner@example.com"}
        ).status_code
        == 503
    )


def test_resend_payload_and_fragment_link(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "test-key")
    monkeypatch.setenv("RESEND_FROM_EMAIL", "Lisboa <no-reply@example.com>")
    assert reset_link("safe-token").endswith("/#reset-password=safe-token")
    with patch("app.services.password_recovery.urlopen") as mocked:
        mocked.return_value.__enter__.return_value.status = 200
        assert send_password_recovery("owner@example.com", "safe-token", "request-id")
        request = mocked.call_args.args[0]
        assert request.full_url == "https://api.resend.com/emails"
        assert request.get_header("Idempotency-key") == "password-reset/request-id"
        assert b"safe-token" in request.data
        mocked.side_effect = URLError("unavailable")
        assert not send_password_recovery("owner@example.com", "safe-token", "request-id")
