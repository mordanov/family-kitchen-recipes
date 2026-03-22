"""add optional recipe cooking time in minutes

Revision ID: 0009
Revises: 0008
Create Date: 2026-03-22 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("recipes", sa.Column("cooking_time_minutes", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("recipes", "cooking_time_minutes")

