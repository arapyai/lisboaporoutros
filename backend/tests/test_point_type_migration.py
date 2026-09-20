from pathlib import Path
from runpy import run_path
from uuid import uuid4

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import (
    Column,
    ForeignKey,
    MetaData,
    String,
    Table,
    Uuid,
    create_engine,
    inspect,
    select,
)


def test_point_type_migration_seeds_and_backfills_existing_points(tmp_path) -> None:
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'point-types.db'}")
    metadata = MetaData()
    languages = Table("languages", metadata, Column("code", String(16), primary_key=True))
    texts = Table("texts", metadata, Column("id", Uuid, primary_key=True))
    jobs = Table("translation_generation_jobs", metadata, Column("id", Uuid, primary_key=True))
    points = Table(
        "points",
        metadata,
        Column("id", Uuid, primary_key=True),
        Column("title_pt", String, nullable=False),
    )
    Table(
        "translation_generation_job_items",
        metadata,
        Column("id", Uuid, primary_key=True),
        Column("job_id", ForeignKey(jobs.c.id), nullable=False),
        Column("text_id", ForeignKey(texts.c.id), nullable=False),
        Column("lang", ForeignKey(languages.c.code), nullable=False),
    )
    metadata.create_all(engine)
    point_id = uuid4()
    with engine.begin() as connection:
        connection.execute(languages.insert().values(code="en"))
        connection.execute(points.insert().values(id=point_id, title_pt="Existing point"))

    migration = run_path(Path("alembic/versions/20260920_000020_point_types.py"))
    with engine.begin() as connection:
        operations = Operations(MigrationContext.configure(connection))
        migration["upgrade"].__globals__["op"] = operations
        migration["upgrade"]()

    inspector = inspect(engine)
    assert {"point_types", "point_translations"}.issubset(inspector.get_table_names())
    point_type_column = next(
        item for item in inspector.get_columns("points") if item["name"] == "point_type_id"
    )
    assert point_type_column["nullable"] is False
    migrated = Table("points", MetaData(), autoload_with=engine)
    point_types = Table("point_types", MetaData(), autoload_with=engine)
    with engine.connect() as connection:
        assert (
            connection.scalar(select(migrated.c.point_type_id).where(migrated.c.id == point_id))
            is not None
        )
        slugs = (
            connection.execute(select(point_types.c.slug).order_by(point_types.c.slug))
            .scalars()
            .all()
        )
        assert slugs == [
            "literary",
            "reading",
        ]

    with engine.begin() as connection:
        operations = Operations(MigrationContext.configure(connection))
        migration["downgrade"].__globals__["op"] = operations
        migration["downgrade"]()
    assert "point_types" not in inspect(engine).get_table_names()
    assert "point_type_id" not in {item["name"] for item in inspect(engine).get_columns("points")}
