import pytest
from fastapi import HTTPException

from app.api.menus import add_menu_item, create_menu, get_shopping_list
from app.models import CookingMethod, Menu, MenuItem, MenuStatus, Recipe
from app.schemas import MenuCreate, MenuItemCreate


@pytest.mark.asyncio
async def test_create_menu_rejects_when_an_active_menu_already_exists(session):
    session.add(Menu(title="Текущее меню", weeks=1, status=MenuStatus.active))
    await session.commit()

    with pytest.raises(HTTPException) as exc_info:
        await create_menu(MenuCreate(title="Новое меню", weeks=2), db=session, _=None)

    assert exc_info.value.status_code == 400
    assert "активное меню" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_add_menu_item_clamps_week_number_and_uses_next_position(session, sample_recipe):
    menu = Menu(title="Меню на 2 недели", weeks=2, status=MenuStatus.active)
    session.add(menu)
    await session.commit()
    await session.refresh(menu)

    session.add(
        MenuItem(
            menu_id=menu.id,
            recipe_id=sample_recipe.id,
            position=3,
            week_number=1,
        )
    )
    await session.commit()

    updated_menu = await add_menu_item(
        menu_id=menu.id,
        data=MenuItemCreate(recipe_id=sample_recipe.id, week_number=99),
        db=session,
        _=None,
    )

    created_item = max(updated_menu.items, key=lambda item: item.position)

    assert created_item.position == 4
    assert created_item.week_number == 2
    assert created_item.recipe_id == sample_recipe.id


@pytest.mark.asyncio
async def test_get_shopping_list_skips_cooked_items_and_deduplicates_recipe_titles(session):
    menu = Menu(title="Семейное меню", weeks=1, status=MenuStatus.active)
    soup = Recipe(
        title="Суп",
        ingredients="вода",
        shopping_list="картофель\nморковь",
        cooking_method=CookingMethod.boiling,
        servings=4,
    )
    pie = Recipe(
        title="Пирог",
        ingredients="тесто",
        shopping_list="мука\nмасло",
        cooking_method=CookingMethod.baking,
        servings=6,
    )
    session.add_all([menu, soup, pie])
    await session.commit()
    await session.refresh(menu)
    await session.refresh(soup)
    await session.refresh(pie)

    session.add_all(
        [
            MenuItem(menu_id=menu.id, recipe_id=soup.id, position=0, week_number=1, is_cooked=False),
            MenuItem(menu_id=menu.id, recipe_id=soup.id, position=1, week_number=1, is_cooked=False),
            MenuItem(menu_id=menu.id, recipe_id=pie.id, position=2, week_number=1, is_cooked=True),
        ]
    )
    await session.commit()

    shopping = await get_shopping_list(menu_id=menu.id, db=session, _=None)

    assert shopping["menu_title"] == "Семейное меню"
    assert shopping["shopping_lists"] == {
        "Суп": "картофель\nморковь",
    }
    assert "combined_list" in shopping
    assert "картофель" in shopping["combined_list"]
    assert "мука" not in shopping["combined_list"]  # пирог помечен как приготовленный
