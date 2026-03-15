from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime, date
from app.models import CookingMethod, MenuStatus


# Auth
class Token(BaseModel):
    access_token: str
    token_type: str
    username: str


class LoginRequest(BaseModel):
    username: str
    password: str


# Recipe
class RecipeBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    ingredients: str = Field(..., min_length=1)
    shopping_list: str = ""
    cooking_method: CookingMethod = CookingMethod.boiling
    servings: int = Field(default=4, ge=1, le=50)
    extra_info: Optional[str] = None


class RecipeCreate(RecipeBase):
    pass


class RecipeUpdate(RecipeBase):
    pass


class RecipeOut(RecipeBase):
    id: int
    image_path: Optional[str] = None
    calories: Optional[float] = None
    proteins: Optional[float] = None
    fats: Optional[float] = None
    carbs: Optional[float] = None
    kbju_calculated: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Menu
class MenuItemCreate(BaseModel):
    recipe_id: int
    week_number: int = 1
    day_of_week: Optional[int] = None
    meal_type: Optional[str] = None
    note: Optional[str] = None


class MenuItemUpdate(BaseModel):
    is_cooked: Optional[bool] = None
    note: Optional[str] = None
    position: Optional[int] = None


class MenuItemOut(BaseModel):
    id: int
    recipe_id: int
    position: int
    week_number: int
    day_of_week: Optional[int] = None
    meal_type: Optional[str] = None
    is_cooked: bool
    note: Optional[str] = None
    recipe: Optional[RecipeOut] = None

    class Config:
        from_attributes = True


class MenuCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    weeks: int = Field(default=1, ge=1, le=4)


class MenuOut(BaseModel):
    id: int
    title: str
    weeks: int
    status: MenuStatus
    created_at: datetime
    closed_at: Optional[datetime] = None
    items: List[MenuItemOut] = []

    class Config:
        from_attributes = True


# Settings
class SettingOut(BaseModel):
    key: str
    value: Optional[str]

    class Config:
        from_attributes = True


class SynonymsUpdate(BaseModel):
    aliases: Dict[str, str] = Field(default_factory=dict)


class SynonymsOut(BaseModel):
    aliases: Dict[str, str] = Field(default_factory=dict)


# Stock
class StockItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    quantity: str = Field(..., min_length=1, max_length=100)
    added_on: date = Field(default_factory=date.today)


class StockItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    quantity: Optional[str] = Field(None, min_length=1, max_length=100)
    added_on: Optional[date] = None


class StockItemOut(BaseModel):
    id: int
    name: str
    quantity: str
    added_on: date
    updated_at: datetime

    class Config:
        from_attributes = True


class PreparedDishCreate(BaseModel):
    recipe_id: int
    servings: float = Field(..., gt=0)
    note: Optional[str] = None
    added_on: date = Field(default_factory=date.today)


class PreparedDishUpdate(BaseModel):
    recipe_id: Optional[int] = None
    servings: Optional[float] = Field(None, gt=0)
    note: Optional[str] = None
    added_on: Optional[date] = None


class PreparedDishOut(BaseModel):
    id: int
    recipe_id: int
    servings: float
    note: Optional[str] = None
    added_on: date
    updated_at: datetime
    recipe: Optional[RecipeOut] = None

    class Config:
        from_attributes = True

