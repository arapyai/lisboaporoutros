import importlib.util
from pathlib import Path

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def test_password_recovery_migration_preserves_admin_credentials():
    path = Path(__file__).parents[1] / "alembic/versions/20260930_000023_admin_password_resets.py"
    spec = importlib.util.spec_from_file_location("recovery_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(
            sa.text("CREATE TABLE admin_users (id CHAR(32) PRIMARY KEY, password_hash TEXT)")
        )
        connection.execute(sa.text("INSERT INTO admin_users VALUES ('old','unchanged')"))
        module.op = Operations(MigrationContext.configure(connection))
        module.upgrade()
        assert connection.scalar(sa.text("SELECT password_hash FROM admin_users")) == "unchanged"
        assert connection.scalar(sa.text("SELECT count(*) FROM admin_password_resets")) == 0
        assert len(sa.inspect(connection).get_indexes("admin_password_resets")) == 2
        module.downgrade()
        assert "admin_password_resets" not in sa.inspect(connection).get_table_names()
