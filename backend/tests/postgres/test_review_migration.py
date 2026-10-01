from uuid import uuid4

from alembic.script import ScriptDirectory
from sqlalchemy import text

from alembic import command


def test_review_default_roundtrip_preserves_history(db_session, migration_config):
    heads = ScriptDirectory.from_config(migration_config).get_heads()
    assert heads == ["20261001_000024"]
    assert db_session.scalar(text("SELECT version_num FROM alembic_version")) == heads[0]
    db_session.commit()  # Release the transaction before Alembic's separate DDL connection.
    command.downgrade(migration_config, "20260930_000023")

    def insert_batch():
        batch_id = uuid4()
        db_session.execute(
            text("INSERT INTO content_generation_batches (id) VALUES (:id)"), {"id": batch_id}
        )
        db_session.commit()
        return batch_id

    legacy = insert_batch()
    command.upgrade(migration_config, "head")
    current = insert_batch()
    values = dict(
        db_session.execute(
            text("SELECT id, auto_approve_translations FROM content_generation_batches")
        ).all()
    )
    assert values == {legacy: True, current: False}
    db_session.commit()
    command.downgrade(migration_config, "20260930_000023")
    rollback = insert_batch()
    values = dict(
        db_session.execute(
            text("SELECT id, auto_approve_translations FROM content_generation_batches")
        ).all()
    )
    assert values == {legacy: True, current: False, rollback: True}
    db_session.commit()
    command.upgrade(migration_config, "head")
