"""add menu_item_members for per-member per-meal assignments

Revision ID: 0007
Revises: 0006
Create Date: 2026-03-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the per-member assignment table
    op.create_table(
        "menu_item_members",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("menu_item_id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("recipe_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["menu_item_id"], ["menu_items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["member_id"], ["family_members.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_menu_item_members_menu_item_id",
        "menu_item_members",
        ["menu_item_id"],
    )

    # Make recipe_id on menu_items nullable (slot may have only per-member assignments)
    op.alter_column("menu_items", "recipe_id", nullable=True)


def downgrade() -> None:
    op.alter_column("menu_items", "recipe_id", nullable=False)
    op.drop_index("ix_menu_item_members_menu_item_id", table_name="menu_item_members")
    op.drop_table("menu_item_members")

