"""add editable directories for recipe categories and cooking methods

Revision ID: 0015
Revises: 0014
Create Date: 2026-03-29 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column
from sqlalchemy import String, Integer, Boolean, DateTime
import datetime

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Create recipe_categories table
    op.create_table(
        "recipe_categories",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("is_deleted", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime, default=datetime.datetime.utcnow, nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    # Create cooking_methods table
    op.create_table(
        "cooking_methods",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("emoji", sa.String(10), nullable=True),
        sa.Column("is_deleted", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime, default=datetime.datetime.utcnow, nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    # Create association table for many-to-many
    op.create_table(
        "recipe_categories_association",
        sa.Column("recipe_id", sa.Integer, sa.ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("category_id", sa.Integer, sa.ForeignKey("recipe_categories.id", ondelete="CASCADE"), primary_key=True),
    )
    # Add cooking_method_id to recipes
    op.add_column("recipes", sa.Column("cooking_method_id", sa.Integer, sa.ForeignKey("cooking_methods.id"), nullable=True))

    # Data migration: fill directories from existing data
    connection = op.get_bind()
    # 1. Migrate categories
    recipes = connection.execute(sa.text("SELECT id, categories FROM recipes")).fetchall()
    category_map = {}  # name -> id
    for recipe in recipes:
        if not recipe.categories:
            continue
        for cat in recipe.categories:
            if cat not in category_map:
                res = connection.execute(
                    sa.text("INSERT INTO recipe_categories (name, is_deleted, created_at) VALUES (:name, false, CURRENT_TIMESTAMP) RETURNING id"),
                    {"name": cat}
                )
                category_id = res.fetchone()[0]
                category_map[cat] = category_id
            else:
                category_id = category_map[cat]
            connection.execute(
                sa.text("INSERT INTO recipe_categories_association (recipe_id, category_id) VALUES (:rid, :cid) ON CONFLICT DO NOTHING"),
                {"rid": recipe.id, "cid": category_id}
            )
    # 2. Migrate cooking methods
    # Get all unique methods
    methods = connection.execute(sa.text("SELECT DISTINCT cooking_method FROM recipes")).fetchall()
    method_map = {}  # name -> id
    for m in methods:
        name = m[0]
        if name is None:
            continue
        res = connection.execute(
            sa.text("INSERT INTO cooking_methods (name, is_deleted, created_at) VALUES (:name, false, CURRENT_TIMESTAMP) RETURNING id"),
            {"name": name}
        )
        method_id = res.fetchone()[0]
        method_map[name] = method_id
    # Update recipes with new FK
    for recipe in recipes:
        method = connection.execute(sa.text("SELECT cooking_method FROM recipes WHERE id=:id"), {"id": recipe.id}).scalar()
        if method and method in method_map:
            connection.execute(
                sa.text("UPDATE recipes SET cooking_method_id=:mid WHERE id=:id"),
                {"mid": method_map[method], "id": recipe.id}
            )


def downgrade() -> None:
    op.drop_column("recipes", "cooking_method_id")
    op.drop_table("recipe_categories_association")
    op.drop_table("cooking_methods")
    op.drop_table("recipe_categories")

