"""Drop the unused attempts table

Per-attempt rows were never written by any client; a climb's attempt_count
already carries what the logbook, stats, and coach use.

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("ix_attempts_user_id", table_name="attempts")
    op.drop_index("ix_attempts_climb_id", table_name="attempts")
    op.drop_table("attempts")


def downgrade() -> None:
    op.create_table(
        "attempts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "climb_id",
            sa.Integer(),
            sa.ForeignKey("climbs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("attempt_date", sa.Date(), nullable=False),
        sa.Column("outcome", sa.String(10), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
    )
    op.create_index("ix_attempts_climb_id", "attempts", ["climb_id"])
    op.create_index("ix_attempts_user_id", "attempts", ["user_id"])
