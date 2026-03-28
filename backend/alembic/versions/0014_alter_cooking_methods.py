"""add cooking methods sous_vide, sauce, sweet_sauce, grill, waffles to enum

Revision ID: 0013
Revises: 0012
Create Date: 2026-03-28 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("UPDATE recipes SET cooking_method = 'other' WHERE cooking_method IN ('sous_vide', 'sauce', 'sweet_sauce', 'grill', 'waffles')")
    op.execute("ALTER TABLE recipes ALTER COLUMN cooking_method TYPE VARCHAR(50)")
    op.execute("DROP TYPE cookingmethod")
    op.execute("CREATE TYPE cookingmethod AS ENUM ('boiling', 'frying', 'dry_frying', 'stewing', 'air_fryer', 'baking', 'raw', 'other', 'sous_vide', 'grill')")
    op.execute("ALTER TABLE recipes ALTER COLUMN cooking_method TYPE cookingmethod USING cooking_method::cookingmethod")

def downgrade() -> None:
    op.execute("UPDATE recipes SET cooking_method = 'other' WHERE cooking_method = 'waffles'")
    op.execute("ALTER TABLE recipes ALTER COLUMN cooking_method TYPE VARCHAR(50)")
    op.execute("DROP TYPE cookingmethod")
    op.execute("CREATE TYPE cookingmethod AS ENUM ('boiling', 'frying', 'dry_frying', 'stewing', 'air_fryer', 'baking', 'raw', 'other', 'sous_vide', 'sauce', 'sweet_sauce', 'grill', 'waffles')")
    op.execute("ALTER TABLE recipes ALTER COLUMN cooking_method TYPE cookingmethod USING cooking_method::cookingmethod")
