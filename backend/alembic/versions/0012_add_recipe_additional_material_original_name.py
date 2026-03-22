"""add original filename for recipe additional material

Revision ID: 0012
Revises: 0011
Create Date: 2026-03-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "recipes",
        sa.Column("additional_material_original_name", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("recipes", "additional_material_original_name")

