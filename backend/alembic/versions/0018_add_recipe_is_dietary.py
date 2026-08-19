"""add is_dietary flag to recipes

Revision ID: 0018
Revises: 0017
Create Date: 2026-08-19 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("recipes", sa.Column("is_dietary", sa.Boolean(), nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("recipes", "is_dietary")
