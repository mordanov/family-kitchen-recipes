"""add family members

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "family_members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("weight", sa.Float(), nullable=True),
        sa.Column("age", sa.Integer(), nullable=True),
        sa.Column(
            "gender",
            sa.Enum("male", "female", "other", name="gender"),
            nullable=True,
        ),
        sa.Column(
            "diet_model",
            sa.Enum("weight_gain", "weight_loss", "weight_maintain", name="dietmodel"),
            nullable=True,
        ),
        sa.Column("photo_path", sa.String(500), nullable=True),
        sa.Column("color", sa.String(20), nullable=False, server_default="#FF6B35"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "member_preferred_recipes",
        sa.Column("member_id", sa.Integer(), sa.ForeignKey("family_members.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("recipe_id", sa.Integer(), sa.ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True),
    )

    op.create_table(
        "member_disliked_recipes",
        sa.Column("member_id", sa.Integer(), sa.ForeignKey("family_members.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("recipe_id", sa.Integer(), sa.ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True),
    )


def downgrade() -> None:
    op.drop_table("member_disliked_recipes")
    op.drop_table("member_preferred_recipes")
    op.drop_table("family_members")
    op.execute("DROP TYPE IF EXISTS gender")
    op.execute("DROP TYPE IF EXISTS dietmodel")

