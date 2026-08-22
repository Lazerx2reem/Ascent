"""Add optional image columns to climbs

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("climbs", sa.Column("image_key", sa.String(255), nullable=True))
    op.add_column(
        "climbs", sa.Column("image_content_type", sa.String(60), nullable=True)
    )
    op.add_column("climbs", sa.Column("image_size_bytes", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("climbs", "image_size_bytes")
    op.drop_column("climbs", "image_content_type")
    op.drop_column("climbs", "image_key")
