from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.database import Base


class CookingMethod(str, enum.Enum):
    boiling = "boiling"
    frying = "frying"
    dry_frying = "dry_frying"
    stewing = "stewing"
    air_fryer = "air_fryer"
    baking = "baking"
    raw = "raw"


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Recipe(Base):
    __tablename__ = "recipes"
    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    ingredients = Column(Text, nullable=False, default="")
    shopping_list = Column(Text, nullable=False, default="")
    cooking_method = Column(SAEnum(CookingMethod), nullable=False, default=CookingMethod.boiling)
    servings = Column(Integer, nullable=False, default=4)
    extra_info = Column(Text, nullable=True)
    image_path = Column(String(500), nullable=True)

    # KBJU per serving (auto-calculated)
    calories = Column(Float, nullable=True)
    proteins = Column(Float, nullable=True)
    fats = Column(Float, nullable=True)
    carbs = Column(Float, nullable=True)
    kbju_calculated = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    menu_items = relationship("MenuItem", back_populates="recipe")


class MenuStatus(str, enum.Enum):
    active = "active"
    closed = "closed"


class Menu(Base):
    __tablename__ = "menus"
    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    weeks = Column(Integer, nullable=False, default=1)
    status = Column(SAEnum(MenuStatus), nullable=False, default=MenuStatus.active)
    created_at = Column(DateTime, default=datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)

    items = relationship("MenuItem", back_populates="menu", order_by="MenuItem.position", cascade="all, delete-orphan")


class MenuItem(Base):
    __tablename__ = "menu_items"
    id = Column(Integer, primary_key=True)
    menu_id = Column(Integer, ForeignKey("menus.id", ondelete="CASCADE"), nullable=False)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False)
    position = Column(Integer, nullable=False, default=0)
    week_number = Column(Integer, nullable=False, default=1)
    day_of_week = Column(Integer, nullable=True)  # 1-7, optional
    meal_type = Column(String(50), nullable=True)  # breakfast/lunch/dinner
    is_cooked = Column(Boolean, default=False)
    note = Column(String(500), nullable=True)

    menu = relationship("Menu", back_populates="items")
    recipe = relationship("Recipe", back_populates="menu_items")


class AppSettings(Base):
    __tablename__ = "app_settings"
    id = Column(Integer, primary_key=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(Text, nullable=True)
