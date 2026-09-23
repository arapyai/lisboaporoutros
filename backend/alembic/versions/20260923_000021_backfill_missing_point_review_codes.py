"""backfill point review codes created after the initial migration

Revision ID: 20260923_000021
Revises: 20260920_000020
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision = "20260923_000021"
down_revision = "20260920_000020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    connection = op.get_bind()
    rows = connection.execute(
        sa.text("SELECT id, review_code FROM points ORDER BY created_at, id")
    ).mappings()

    missing_ids = []
    used_values = set()
    for row in rows:
        code = row["review_code"]
        if code is None:
            missing_ids.append(row["id"])
        elif code.startswith("P") and code[1:].isdigit():
            used_values.add(int(code[1:]))

    stored_next_value = connection.scalar(
        sa.text("SELECT next_value FROM point_review_code_counters WHERE id = 1")
    )
    next_value = max(used_values, default=0) + 1
    if stored_next_value is not None:
        next_value = max(next_value, stored_next_value)

    for point_id in missing_ids:
        while next_value in used_values:
            next_value += 1
        connection.execute(
            sa.text("UPDATE points SET review_code = :code WHERE id = :point_id"),
            {"code": f"P{next_value:04d}", "point_id": point_id},
        )
        used_values.add(next_value)
        next_value += 1

    connection.execute(
        sa.text(
            "UPDATE point_review_code_counters SET next_value = :next_value WHERE id = 1"
        ),
        {"next_value": next_value},
    )


def downgrade() -> None:
    # Permanent review codes must not be removed or reused on downgrade.
    pass
