"""add active cooking time and freezer-friendly flag to recipes

Revision ID: 0010
Revises: 0009
Create Date: 2026-03-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("recipes", sa.Column("active_cooking_time_minutes", sa.Integer(), nullable=True))
    op.add_column(
        "recipes",
        sa.Column("freezer_friendly", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("recipes", "freezer_friendly")
    op.drop_column("recipes", "active_cooking_time_minutes")

