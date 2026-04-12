"""drop legacy cooking_method column from recipes

The cooking_method column (enum type) was superseded by cooking_method_id
(FK to cooking_methods directory table) in migration 0015.
The old column was not dropped there, causing NOT NULL violations on insert.

Revision ID: 0017
Revises: 0016
Create Date: 2026-04-13 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("recipes", "cooking_method")
    op.execute("DROP TYPE IF EXISTS cookingmethod")


def downgrade() -> None:
    op.execute(
        "CREATE TYPE cookingmethod AS ENUM ("
        "'boiling', 'frying', 'dry_frying', 'stewing', 'air_fryer', "
        "'baking', 'raw', 'other', 'sous_vide', 'sauce', 'sweet_sauce', 'grill', 'waffles'"
        ")"
    )
    op.add_column(
        "recipes",
        sa.Column(
            "cooking_method",
            sa.Enum(
                "boiling", "frying", "dry_frying", "stewing", "air_fryer",
                "baking", "raw", "other", "sous_vide", "sauce", "sweet_sauce", "grill", "waffles",
                name="cookingmethod",
            ),
            nullable=False,
            server_default="other",
        ),
    )
