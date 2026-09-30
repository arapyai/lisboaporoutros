"""Audit point coordinate corrections without fabricating historical updates."""

import sqlalchemy as sa

from alembic import op

revision = "20260930_000022"
down_revision = "20260927_000021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("points", sa.Column("location_updated_at", sa.DateTime(timezone=True)))
    op.add_column("points", sa.Column("location_update_source", sa.String(32)))
    op.create_table(
        "point_location_updates",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "point_id", sa.Uuid(), sa.ForeignKey("points.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("admin_id", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="SET NULL")),
        sa.Column("admin_email", sa.String(320), nullable=False),
        sa.Column("source", sa.String(32), nullable=False),
        sa.Column("previous_lat", sa.Float(), nullable=False),
        sa.Column("previous_lng", sa.Float(), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("accuracy_m", sa.Float()),
        sa.Column("measured_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_point_location_updates_point_id", "point_location_updates", ["point_id"])


def downgrade() -> None:
    op.drop_table("point_location_updates")
    op.drop_column("points", "location_update_source")
    op.drop_column("points", "location_updated_at")
