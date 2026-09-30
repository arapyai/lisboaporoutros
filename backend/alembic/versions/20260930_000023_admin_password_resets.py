"""Single-use password recovery and shared request throttling."""

import sqlalchemy as sa

from alembic import op

revision = "20260930_000023"
down_revision = "20260930_000022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin_password_resets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("email_hash", sa.String(64), nullable=False),
        sa.Column("client_hash", sa.String(64), nullable=False),
        sa.Column("admin_id", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="CASCADE")),
        sa.Column("auth_version", sa.Integer()),
        sa.Column("token_hash", sa.String(64), unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_admin_password_resets_email_hash", "admin_password_resets", ["email_hash"])
    op.create_index(
        "ix_admin_password_resets_client_hash", "admin_password_resets", ["client_hash"]
    )


def downgrade() -> None:
    op.drop_table("admin_password_resets")
