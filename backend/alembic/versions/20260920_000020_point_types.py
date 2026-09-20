"""add expandable point types and point translations

Revision ID: 20260920_000020
Revises: 20260831_000019
"""

from collections.abc import Sequence
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260920_000020"
down_revision = "20260831_000019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LITERARY_ID = UUID("11111111-1111-4111-8111-111111111111")
READING_ID = UUID("22222222-2222-4222-8222-222222222222")

translation_status_enum = postgresql.ENUM(
    "pending", "approved", "rejected", name="translation_status", create_type=False
)


def upgrade() -> None:
    point_types = op.create_table(
        "point_types",
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("name_pt", sa.String(length=120), nullable=False),
        sa.Column("icon_key", sa.String(length=32), nullable=False),
        sa.Column("color", sa.String(length=7), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.bulk_insert(
        point_types,
        [
            {
                "id": LITERARY_ID,
                "slug": "literary",
                "name_pt": "Ponto literário",
                "icon_key": "book-open",
                "color": "#C45732",
                "sort_order": 10,
                "is_active": True,
            },
            {
                "id": READING_ID,
                "slug": "reading",
                "name_pt": "Ponto de leitura",
                "icon_key": "library",
                "color": "#2F6F68",
                "sort_order": 20,
                "is_active": True,
            },
        ],
    )

    with op.batch_alter_table("points") as batch:
        batch.add_column(sa.Column("point_type_id", sa.Uuid(), nullable=True))
        batch.add_column(sa.Column("description_pt", sa.Text(), nullable=True))
        batch.create_foreign_key(
            "fk_points_point_type_id_point_types",
            "point_types",
            ["point_type_id"],
            ["id"],
            ondelete="RESTRICT",
        )
        batch.create_index("ix_points_point_type_id", ["point_type_id"])
    op.execute(
        sa.text("UPDATE points SET point_type_id = :literary_id").bindparams(
            literary_id=LITERARY_ID
        )
    )
    with op.batch_alter_table("points") as batch:
        batch.alter_column("point_type_id", existing_type=sa.Uuid(), nullable=False)

    op.create_table(
        "point_translations",
        sa.Column("point_id", sa.Uuid(), nullable=False),
        sa.Column("lang", sa.String(length=16), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", translation_status_enum, nullable=False, server_default="pending"),
        sa.Column("auto_translated", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("origin", sa.String(length=16), nullable=False, server_default="manual"),
        sa.Column("reviewed_by", sa.String(length=320), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["lang"], ["languages.code"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["point_id"], ["points.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("point_id", "lang", name="uq_point_translations_point_lang"),
    )
    op.create_index("ix_point_translations_point_id", "point_translations", ["point_id"])

    with op.batch_alter_table("translation_generation_job_items") as batch:
        batch.alter_column("text_id", existing_type=sa.Uuid(), nullable=True)
        batch.add_column(sa.Column("point_id", sa.Uuid(), nullable=True))
        batch.create_foreign_key(
            "fk_translation_generation_job_items_point_id_points",
            "points",
            ["point_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch.create_check_constraint(
            "translation_target",
            "(text_id IS NOT NULL AND point_id IS NULL) OR "
            "(text_id IS NULL AND point_id IS NOT NULL)",
        )
        batch.create_unique_constraint(
            "uq_translation_job_item_job_point_lang", ["job_id", "point_id", "lang"]
        )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM translation_generation_job_items WHERE point_id IS NOT NULL"))
    with op.batch_alter_table("translation_generation_job_items") as batch:
        batch.drop_constraint("uq_translation_job_item_job_point_lang", type_="unique")
        batch.drop_constraint("translation_target", type_="check")
        batch.drop_constraint(
            "fk_translation_generation_job_items_point_id_points", type_="foreignkey"
        )
        batch.drop_column("point_id")
        batch.alter_column("text_id", existing_type=sa.Uuid(), nullable=False)
    op.drop_index("ix_point_translations_point_id", table_name="point_translations")
    op.drop_table("point_translations")
    with op.batch_alter_table("points") as batch:
        batch.drop_index("ix_points_point_type_id")
        batch.drop_constraint("fk_points_point_type_id_point_types", type_="foreignkey")
        batch.drop_column("description_pt")
        batch.drop_column("point_type_id")
    op.drop_table("point_types")
