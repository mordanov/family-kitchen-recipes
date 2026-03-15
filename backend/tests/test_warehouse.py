import pytest

from app.api.warehouse import create_prepared, update_prepared
from app.models import CookingMethod, PreparedDish, Recipe
from app.schemas import PreparedDishCreate, PreparedDishUpdate


@pytest.mark.asyncio
async def test_update_prepared_allows_changing_recipe_and_date(session):
    r1 = Recipe(
        title="Суп",
        ingredients="вода",
        shopping_list="картофель",
        cooking_method=CookingMethod.boiling,
        servings=2,
    )
    r2 = Recipe(
        title="Рагу",
        ingredients="овощи",
        shopping_list="кабачок",
        cooking_method=CookingMethod.stewing,
        servings=3,
    )
    session.add_all([r1, r2])
    await session.commit()
    await session.refresh(r1)
    await session.refresh(r2)

    created = await create_prepared(
        PreparedDishCreate(recipe_id=r1.id, servings=1.0, note="морозилка"),
        db=session,
        _=None,
    )

    updated = await update_prepared(
        created.id,
        PreparedDishUpdate(recipe_id=r2.id, servings=2.5, added_on="2026-03-10"),
        db=session,
        _=None,
    )

    assert updated.recipe_id == r2.id
    assert updated.servings == 2.5
    assert str(updated.added_on) == "2026-03-10"

