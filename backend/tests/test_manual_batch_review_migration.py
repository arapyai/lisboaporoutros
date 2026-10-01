import importlib.util
from io import StringIO
from pathlib import Path

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def load_migration():
    path = Path(__file__).parents[1] / "alembic/versions/20261001_000024_manual_batch_review.py"
    spec = importlib.util.spec_from_file_location("manual_review_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_manual_review_default_preserves_legacy_batch_history():
    module = load_migration()
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(
            sa.text(
                "CREATE TABLE content_generation_batches "
                "(id TEXT PRIMARY KEY, auto_approve_translations BOOLEAN NOT NULL DEFAULT 1)"
            )
        )
        connection.execute(sa.text("INSERT INTO content_generation_batches (id) VALUES ('legacy')"))
        module.op = Operations(MigrationContext.configure(connection))
        module.upgrade()
        connection.execute(sa.text("INSERT INTO content_generation_batches (id) VALUES ('new')"))
        assert dict(
            connection.execute(
                sa.text("SELECT id, auto_approve_translations FROM content_generation_batches")
            ).all()
        ) == {"legacy": 1, "new": 0}
        module.downgrade()
        connection.execute(
            sa.text("INSERT INTO content_generation_batches (id) VALUES ('rollback')")
        )
        assert (
            connection.scalar(
                sa.text(
                    "SELECT auto_approve_translations FROM content_generation_batches "
                    "WHERE id='rollback'"
                )
            )
            == 1
        )
        assert (
            connection.scalar(
                sa.text(
                    "SELECT auto_approve_translations FROM content_generation_batches "
                    "WHERE id='new'"
                )
            )
            == 0
        )


def test_postgres_upgrade_only_changes_default_not_historical_rows():
    module = load_migration()
    output = StringIO()
    module.op = Operations(
        MigrationContext.configure(
            dialect_name="postgresql", opts={"as_sql": True, "output_buffer": output}
        )
    )
    module.upgrade()
    sql = output.getvalue().strip()
    assert sql == (
        "ALTER TABLE content_generation_batches ALTER COLUMN auto_approve_translations "
        "SET DEFAULT false;"
    )
