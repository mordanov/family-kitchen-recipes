"""replace age with birth_date in family_members

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("family_members", sa.Column("birth_date", sa.Date(), nullable=True))
    op.drop_column("family_members", "age")


def downgrade() -> None:
    op.add_column("family_members", sa.Column("age", sa.Integer(), nullable=True))
    op.drop_column("family_members", "birth_date")

