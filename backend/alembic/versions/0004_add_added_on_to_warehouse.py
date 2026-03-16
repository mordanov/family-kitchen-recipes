"""add added_on date to stock and prepared

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("stock_items", sa.Column("added_on", sa.Date(), nullable=True))
    op.add_column("prepared_dishes", sa.Column("added_on", sa.Date(), nullable=True))

    op.execute("UPDATE stock_items SET added_on = DATE(created_at) WHERE added_on IS NULL")
    op.execute("UPDATE prepared_dishes SET added_on = DATE(created_at) WHERE added_on IS NULL")

    op.alter_column("stock_items", "added_on", nullable=False)
    op.alter_column("prepared_dishes", "added_on", nullable=False)


def downgrade() -> None:
    op.drop_column("prepared_dishes", "added_on")
    op.drop_column("stock_items", "added_on")

