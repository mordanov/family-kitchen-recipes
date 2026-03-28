"""add cooking methods sous_vide, sauce, sweet_sauce, grill, waffles to enum

Revision ID: 0013
Revises: 0012
Create Date: 2026-03-28 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("ALTER TYPE cookingmethod ADD VALUE IF NOT EXISTS 'sous_vide'")
    op.execute("ALTER TYPE cookingmethod ADD VALUE IF NOT EXISTS 'sauce'")
    op.execute("ALTER TYPE cookingmethod ADD VALUE IF NOT EXISTS 'sweet_sauce'")
    op.execute("ALTER TYPE cookingmethod ADD VALUE IF NOT EXISTS 'grill'")
    op.execute("ALTER TYPE cookingmethod ADD VALUE IF NOT EXISTS 'waffles'")

def downgrade() -> None:
    # Перевести все новые значения в 'boiling' (или другой дефолт)
    op.execute("UPDATE recipes SET cooking_method = 'other' WHERE cooking_method IN ('sous_vide', 'sauce', 'sweet_sauce', 'grill', 'waffles')")
    # Временно привести колонку к строке
    op.execute("ALTER TABLE recipes ALTER COLUMN cooking_method TYPE VARCHAR(50)")
    # Удалить старый enum
    op.execute("DROP TYPE cookingmethod")
    # Воссоздать enum без новых значений
    op.execute("CREATE TYPE cookingmethod AS ENUM ('boiling', 'frying', 'dry_frying', 'stewing', 'air_fryer', 'baking', 'raw', 'other')")
    # Привести колонку обратно к enum
    op.execute("ALTER TABLE recipes ALTER COLUMN cooking_method TYPE cookingmethod USING cooking_method::cookingmethod")
