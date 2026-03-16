from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, Date, ForeignKey, Enum as SAEnum, Table
from sqlalchemy.orm import relationship
from datetime import datetime, date
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
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=True)  # None = per-member only
    position = Column(Integer, nullable=False, default=0)
    week_number = Column(Integer, nullable=False, default=1)
    day_of_week = Column(Integer, nullable=True)  # 1-7, optional
    meal_type = Column(String(50), nullable=True)  # breakfast/lunch/dinner
    is_cooked = Column(Boolean, default=False)
    note = Column(String(500), nullable=True)

    menu = relationship("Menu", back_populates="items")
    recipe = relationship("Recipe", back_populates="menu_items", foreign_keys=[recipe_id])
    member_assignments = relationship(
        "MenuItemMember", back_populates="menu_item", cascade="all, delete-orphan"
    )


class MenuItemMember(Base):
    """Per-member recipe assignment within a menu slot (day + meal_type)."""
    __tablename__ = "menu_item_members"
    id = Column(Integer, primary_key=True)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id", ondelete="CASCADE"), nullable=False)
    member_id = Column(Integer, ForeignKey("family_members.id", ondelete="CASCADE"), nullable=False)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False)

    menu_item = relationship("MenuItem", back_populates="member_assignments")
    member = relationship("FamilyMember")
    recipe = relationship("Recipe")


class StockItem(Base):
    """В наличии — продукты в холодильнике/кладовой"""
    __tablename__ = "stock_items"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    quantity = Column(String(100), nullable=False, default="")  # "400 г", "5 шт", "3 кг"
    added_on = Column(Date, nullable=False, default=date.today)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PreparedDish(Base):
    """Заготовки — приготовленные блюда в холодильнике/морозильнике"""
    __tablename__ = "prepared_dishes"
    id = Column(Integer, primary_key=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False)
    servings = Column(Float, nullable=False, default=1.0)  # количество порций в наличии
    note = Column(String(500), nullable=True)
    added_on = Column(Date, nullable=False, default=date.today)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    recipe = relationship("Recipe")


class AppSettings(Base):
    __tablename__ = "app_settings"
    id = Column(Integer, primary_key=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(Text, nullable=True)


# ─── Family Members ───

class Gender(str, enum.Enum):
    male = "male"
    female = "female"
    other = "other"


class DietModel(str, enum.Enum):
    weight_gain = "weight_gain"
    weight_loss = "weight_loss"
    weight_maintain = "weight_maintain"


member_preferred_recipes = Table(
    "member_preferred_recipes",
    Base.metadata,
    Column("member_id", Integer, ForeignKey("family_members.id", ondelete="CASCADE"), primary_key=True),
    Column("recipe_id", Integer, ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True),
)

member_disliked_recipes = Table(
    "member_disliked_recipes",
    Base.metadata,
    Column("member_id", Integer, ForeignKey("family_members.id", ondelete="CASCADE"), primary_key=True),
    Column("recipe_id", Integer, ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True),
)


class FamilyMember(Base):
    __tablename__ = "family_members"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    weight = Column(Float, nullable=True)       # кг
    birth_date = Column(Date, nullable=True)
    gender = Column(SAEnum(Gender), nullable=True)
    diet_model = Column(SAEnum(DietModel), nullable=True, default=DietModel.weight_maintain)
    photo_path = Column(String(500), nullable=True)
    color = Column(String(20), nullable=False, default="#FF6B35")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    preferred_recipes = relationship("Recipe", secondary=member_preferred_recipes, lazy="selectin")
    disliked_recipes = relationship("Recipe", secondary=member_disliked_recipes, lazy="selectin")

