"""Browser journeys use the same private, migrated PostgreSQL fixture."""

from tests.postgres.conftest import db_session as db_session
from tests.postgres.conftest import migration_config as migration_config
