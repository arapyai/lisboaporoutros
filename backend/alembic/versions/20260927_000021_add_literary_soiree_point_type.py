"""add literary soiree point type

Revision ID: 20260927_000021
Revises: 20260923_000021
Create Date: 2026-09-27
"""

from collections.abc import Sequence
from uuid import UUID

import sqlalchemy as sa

from alembic import op

revision: str = "20260927_000021"
down_revision: str | None = "20260923_000021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SOIREE_ID = UUID("33333333-3333-4333-8333-333333333333")
LITERARY_ID = UUID("11111111-1111-4111-8111-111111111111")


def upgrade() -> None:
    point_types = sa.table(
        "point_types",
        sa.column("id", sa.Uuid()),
        sa.column("slug", sa.String()),
        sa.column("name_pt", sa.String()),
        sa.column("icon_key", sa.String()),
        sa.column("color", sa.String()),
        sa.column("sort_order", sa.Integer()),
        sa.column("is_active", sa.Boolean()),
    )
    op.bulk_insert(
        point_types,
        [
            {
                "id": SOIREE_ID,
                "slug": "literary-soiree",
                "name_pt": "Sarau literário",
                "icon_key": "coffee",
                "color": "#76507A",
                "sort_order": 30,
                "is_active": True,
            }
        ],
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE points SET point_type_id = :literary_id WHERE point_type_id = :soiree_id"
        ).bindparams(literary_id=LITERARY_ID, soiree_id=SOIREE_ID)
    )
    op.execute(
        sa.text("DELETE FROM point_types WHERE id = :point_type_id").bindparams(
            point_type_id=SOIREE_ID
        )
    )
