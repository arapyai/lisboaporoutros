"""Default new content batches to explicit editorial review; preserve history."""

import sqlalchemy as sa

from alembic import op

revision = "20261001_000024"
down_revision = "20260930_000023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("content_generation_batches") as batch:
        batch.alter_column(
            "auto_approve_translations", existing_type=sa.Boolean(), server_default=sa.false()
        )


def downgrade() -> None:
    with op.batch_alter_table("content_generation_batches") as batch:
        batch.alter_column(
            "auto_approve_translations", existing_type=sa.Boolean(), server_default=sa.true()
        )
