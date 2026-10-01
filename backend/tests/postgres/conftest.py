"""Private PostgreSQL fixture: schema comes exclusively from real Alembic migrations."""

import os
from collections.abc import Iterator
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.config import Config
from sqlalchemy import URL, create_engine, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

from alembic import command
from app.core.config import get_settings


@pytest.fixture
def migration_config() -> Config:
    backend = Path(__file__).resolve().parents[2]
    config = Config(str(backend / "alembic.ini"))
    config.set_main_option("script_location", str(backend / "alembic"))
    return config


@pytest.fixture
def db_session(monkeypatch, migration_config) -> Iterator[Session]:
    socket = os.environ.get("LISBOA_TEST_POSTGRES_SOCKET")
    if not socket:
        pytest.skip("Use scripts/test-postgres-ux.sh for isolated PostgreSQL/PostGIS tests")
    directory = Path(socket).resolve()
    assert directory.parent == Path("/tmp")
    assert directory.name.startswith("lisboa-ux-postgres.")
    assert directory.stat().st_uid == os.getuid()
    assert directory.stat().st_mode & 0o777 == 0o700
    assert (directory / "data/PG_VERSION").read_text().strip() == "16"
    url = URL.create(
        "postgresql+psycopg", database="postgres", query={"host": str(directory), "port": "55435"}
    )
    admin = create_engine(url, poolclass=NullPool, isolation_level="AUTOCOMMIT")
    database = f"lisboa_ux_{uuid4().hex}_preview"
    created = False
    engine = None
    try:
        with admin.connect() as connection:
            connection.execute(text(f'CREATE DATABASE "{database}"'))
        created = True
        child_url = url.set(database=database)
        # Socket path has no reserved characters; avoid ConfigParser %-interpolation.
        monkeypatch.setenv(
            "DATABASE_URL", child_url.render_as_string(hide_password=False).replace("%2F", "/")
        )
        get_settings.cache_clear()
        command.upgrade(migration_config, "head")
        engine = create_engine(child_url, poolclass=NullPool)
        with Session(engine, autoflush=False) as session:
            assert int(session.scalar(text("SHOW server_version_num"))) // 10000 == 16
            assert session.scalar(text("SELECT postgis_version()"))
            session.commit()
            yield session
    finally:
        if engine is not None:
            engine.dispose()
        if created:
            with admin.connect() as connection:
                connection.execute(text(f'DROP DATABASE "{database}"'))
        admin.dispose()
        get_settings.cache_clear()
