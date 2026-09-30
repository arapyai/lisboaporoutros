import importlib.util
from pathlib import Path

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def test_location_audit_migration_preserves_existing_coordinates():
    path = Path(__file__).parents[1] / "alembic/versions/20260930_000022_point_location_audit.py"
    spec = importlib.util.spec_from_file_location("location_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(
            sa.text("CREATE TABLE points (id CHAR(32) PRIMARY KEY, lat FLOAT, lng FLOAT)")
        )
        connection.execute(sa.text("CREATE TABLE admin_users (id CHAR(32) PRIMARY KEY)"))
        connection.execute(sa.text("INSERT INTO points VALUES ('old',38.71,-9.14)"))
        module.op = Operations(MigrationContext.configure(connection))
        module.upgrade()
        row = connection.execute(sa.text("SELECT * FROM points")).mappings().one()
        assert row["lat"] == 38.71 and row["lng"] == -9.14
        assert row["location_updated_at"] is None
        assert row["location_update_source"] is None
        assert connection.scalar(sa.text("SELECT count(*) FROM point_location_updates")) == 0
        assert sa.inspect(connection).get_indexes("point_location_updates")[0]["column_names"] == [
            "point_id"
        ]
