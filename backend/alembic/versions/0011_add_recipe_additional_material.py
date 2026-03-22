"""add recipe additional material PDF path

Revision ID: 0011
Revises: 0010
Create Date: 2026-03-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("recipes", sa.Column("additional_material_path", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("recipes", "additional_material_path")

