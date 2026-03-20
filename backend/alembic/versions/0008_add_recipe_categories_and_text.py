"""add recipe categories, recipe text and cooking method other

Revision ID: 0008
Revises: 0007
Create Date: 2026-03-20 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE cookingmethod ADD VALUE IF NOT EXISTS 'other'")

    op.add_column(
        "recipes",
        sa.Column(
            "categories",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[\"закуска\"]'::json"),
        ),
    )
    op.add_column("recipes", sa.Column("recipe", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("recipes", "recipe")
    op.drop_column("recipes", "categories")

    # PostgreSQL requires enum recreation to remove a value.
    op.execute("ALTER TABLE recipes ALTER COLUMN cooking_method TYPE VARCHAR(50)")
    op.execute("DROP TYPE cookingmethod")
    op.execute(
        "CREATE TYPE cookingmethod AS ENUM ('boiling', 'frying', 'dry_frying', 'stewing', 'air_fryer', 'baking', 'raw')"
    )
    op.execute("UPDATE recipes SET cooking_method = 'boiling' WHERE cooking_method = 'other'")
    op.execute(
        "ALTER TABLE recipes ALTER COLUMN cooking_method TYPE cookingmethod USING cooking_method::cookingmethod"
    )

