"""add dry_frying cooking method

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-15 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0002'
down_revision: Union[str, None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PostgreSQL requires ALTER TYPE to add enum values
    op.execute("ALTER TYPE cookingmethod ADD VALUE IF NOT EXISTS 'dry_frying' AFTER 'frying'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values natively.
    # To roll back, recreate the type without dry_frying and migrate the column.
    op.execute("""
        ALTER TABLE recipes
            ALTER COLUMN cooking_method TYPE VARCHAR(50);
    """)
    op.execute("DROP TYPE cookingmethod")
    op.execute("""
        CREATE TYPE cookingmethod AS ENUM ('boiling', 'frying', 'stewing', 'air_fryer', 'baking', 'raw')
    """)
    op.execute("""
        UPDATE recipes SET cooking_method = 'frying' WHERE cooking_method = 'dry_frying'
    """)
    op.execute("""
        ALTER TABLE recipes
            ALTER COLUMN cooking_method TYPE cookingmethod USING cooking_method::cookingmethod;
    """)

