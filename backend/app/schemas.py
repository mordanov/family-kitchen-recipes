from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Literal
from datetime import datetime, date
from app.models import CookingMethod, MenuStatus, Gender, DietModel


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


class RecipeMemberFeedbackOut(BaseModel):
    member_id: int
    member_name: str
    member_color: str
    status: Literal["preferred", "disliked"]


class RecipeOut(RecipeBase):
    id: int
    image_path: Optional[str] = None
    calories: Optional[float] = None
    proteins: Optional[float] = None
    fats: Optional[float] = None
    carbs: Optional[float] = None
    kbju_calculated: bool = False
    member_feedback: List[RecipeMemberFeedbackOut] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Menu
class MemberAssignmentCreate(BaseModel):
    member_id: int
    recipe_id: int


class MemberAssignmentOut(BaseModel):
    id: int
    member_id: int
    recipe_id: int
    member_name: Optional[str] = None
    member_color: Optional[str] = None
    recipe: Optional["RecipeOut"] = None

    class Config:
        from_attributes = True


class MenuItemCreate(BaseModel):
    recipe_id: Optional[int] = None          # shared recipe for all; None = per-member only
    week_number: int = 1
    day_of_week: Optional[int] = None        # 1=Mon … 7=Sun
    meal_type: Optional[str] = None          # breakfast / lunch / dinner
    note: Optional[str] = None
    member_assignments: List[MemberAssignmentCreate] = []


class MenuItemUpdate(BaseModel):
    is_cooked: Optional[bool] = None
    note: Optional[str] = None
    position: Optional[int] = None
    meal_type: Optional[str] = None
    day_of_week: Optional[int] = None


class MenuItemOut(BaseModel):
    id: int
    recipe_id: Optional[int] = None
    position: int
    week_number: int
    day_of_week: Optional[int] = None
    meal_type: Optional[str] = None
    is_cooked: bool
    note: Optional[str] = None
    recipe: Optional["RecipeOut"] = None
    member_assignments: List[MemberAssignmentOut] = []

    class Config:
        from_attributes = True


class MenuKbjuTotals(BaseModel):
    calories: float = 0.0
    proteins: float = 0.0
    fats: float = 0.0
    carbs: float = 0.0


class MenuKbjuByDay(BaseModel):
    day_of_week: Optional[int] = None
    calories: float = 0.0
    proteins: float = 0.0
    fats: float = 0.0
    carbs: float = 0.0


class MenuKbjuByMember(BaseModel):
    member_id: int
    member_name: str
    member_color: Optional[str] = None
    calories: float = 0.0
    proteins: float = 0.0
    fats: float = 0.0
    carbs: float = 0.0


class MenuKbjuSummary(BaseModel):
    total: MenuKbjuTotals = MenuKbjuTotals()
    by_day: List[MenuKbjuByDay] = []
    by_member: List[MenuKbjuByMember] = []


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
    kbju_summary: Optional[MenuKbjuSummary] = None

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


class AutoFillRequest(BaseModel):
    recipes_per_week: int = Field(default=5, ge=1, le=21)
    use_meal_slots: bool = False
    days: List[int] = Field(default_factory=list)   # 1=Mon…7=Sun; empty = all 7
    meals: List[str] = Field(default_factory=list)  # breakfast/lunch/dinner; empty = all 3


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


# ─── Family Members ───

class FamilyMemberCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    weight: Optional[float] = Field(None, gt=0, lt=500)
    birth_date: Optional[date] = None
    gender: Optional[Gender] = None
    diet_model: Optional[DietModel] = DietModel.weight_maintain
    color: str = Field(default="#FF6B35", max_length=20)


class FamilyMemberUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    weight: Optional[float] = Field(None, gt=0, lt=500)
    birth_date: Optional[date] = None
    gender: Optional[Gender] = None
    diet_model: Optional[DietModel] = None
    color: Optional[str] = Field(None, max_length=20)


class FamilyMemberOut(BaseModel):
    id: int
    name: str
    weight: Optional[float] = None
    birth_date: Optional[date] = None
    gender: Optional[Gender] = None
    diet_model: Optional[DietModel] = None
    photo_path: Optional[str] = None
    color: str
    preferred_recipe_ids: List[int] = []
    disliked_recipe_ids: List[int] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

