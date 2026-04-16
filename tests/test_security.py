from uuid import uuid4

from app.core.db import SessionLocal
from app.core.security import create_access_token, hash_password, verify_password


def test_password_hash_round_trip() -> None:
    password_hash = hash_password("secret-password")

    assert verify_password("secret-password", password_hash) is True
    assert verify_password("wrong-password", password_hash) is False


def test_access_token_is_created() -> None:
    token = create_access_token(uuid4())

    assert isinstance(token, str)
    assert token.count(".") == 2


def test_session_factory_is_configured() -> None:
    session = SessionLocal()

    try:
        assert session.bind is not None
    finally:
        session.close()
