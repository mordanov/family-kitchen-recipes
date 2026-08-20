"""add full-text search vector to recipes

Revision ID: 0019
Revises: 0018
Create Date: 2026-08-20 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_EXPR = (
    "to_tsvector('russian',"
    " coalesce(title, '') || ' ' ||"
    " coalesce(ingredients, '') || ' ' ||"
    " coalesce(recipe, ''))"
)


def upgrade() -> None:
    op.add_column(
        "recipes",
        sa.Column(
            "search_vector",
            postgresql.TSVECTOR(),
            sa.Computed(_EXPR, persisted=True),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_recipes_search_vector",
        "recipes",
        ["search_vector"],
        postgresql_using="gin",
    )


def downgrade() -> None:
    op.drop_index("ix_recipes_search_vector", table_name="recipes")
    op.drop_column("recipes", "search_vector")
