from datetime import UTC, datetime, timedelta
from pathlib import Path
from runpy import run_path
from uuid import uuid4

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    MetaData,
    String,
    Table,
    Uuid,
    create_engine,
    select,
)


def test_backfill_preserves_codes_and_advances_counter(tmp_path) -> None:
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'review-code-backfill.db'}")
    metadata = MetaData()
    points = Table(
        "points",
        metadata,
        Column("id", Uuid, primary_key=True),
        Column("created_at", DateTime(timezone=True), nullable=False),
        Column("review_code", String(16), unique=True, nullable=True),
    )
    counters = Table(
        "point_review_code_counters",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("next_value", Integer, nullable=False),
    )
    metadata.create_all(engine)

    existing_id = uuid4()
    first_missing_id = uuid4()
    second_missing_id = uuid4()
    now = datetime.now(UTC)
    with engine.begin() as connection:
        connection.execute(
            points.insert(),
            [
                {"id": existing_id, "created_at": now, "review_code": "P0005"},
                {
                    "id": first_missing_id,
                    "created_at": now + timedelta(seconds=1),
                    "review_code": None,
                },
                {
                    "id": second_missing_id,
                    "created_at": now + timedelta(seconds=2),
                    "review_code": None,
                },
            ],
        )
        connection.execute(counters.insert().values(id=1, next_value=3))

    migration = run_path(
        Path("alembic/versions/20260923_000021_backfill_missing_point_review_codes.py")
    )
    with engine.begin() as connection:
        operations = Operations(MigrationContext.configure(connection))
        migration["upgrade"].__globals__["op"] = operations
        migration["upgrade"]()

    with engine.connect() as connection:
        codes = dict(connection.execute(select(points.c.id, points.c.review_code)).all())
        assert codes == {
            existing_id: "P0005",
            first_missing_id: "P0006",
            second_missing_id: "P0007",
        }
        assert connection.scalar(select(counters.c.next_value)) == 8
