import pytest
from fastapi import HTTPException

from app.api.menus import add_menu_item, create_menu, get_shopping_list
from app.models import CookingMethod, Menu, MenuItem, MenuStatus, Recipe, StockItem, PreparedDish, AppSettings
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


@pytest.mark.asyncio
async def test_get_shopping_list_splits_in_stock_and_to_buy_and_returns_prepared(session):
    menu = Menu(title="Склад-тест", weeks=1, status=MenuStatus.active)
    soup = Recipe(
        title="Суп",
        ingredients="вода",
        shopping_list="капуста 400 г\nморковь 2 шт",
        cooking_method=CookingMethod.boiling,
        servings=4,
    )
    session.add_all([menu, soup, StockItem(name="капуста", quantity="1 кг")])
    await session.commit()
    await session.refresh(menu)
    await session.refresh(soup)

    session.add(MenuItem(menu_id=menu.id, recipe_id=soup.id, position=0, week_number=1, is_cooked=False))
    session.add(PreparedDish(recipe_id=soup.id, servings=1.5, note="морозилка"))
    await session.commit()

    shopping = await get_shopping_list(menu_id=menu.id, db=session, _=None)

    assert "капуста 400 г" in shopping["in_stock_list"]
    assert "морковь 2 шт" in shopping["to_buy_list"]
    assert shopping["prepared_items"]
    assert shopping["prepared_items"][0]["recipe_title"] == "Суп"


@pytest.mark.asyncio
async def test_get_shopping_list_matches_synonyms_and_normalized_tokens(session):
    menu = Menu(title="Синонимы", weeks=1, status=MenuStatus.active)
    recipe = Recipe(
        title="Овощной гарнир",
        ingredients="овощи",
        shopping_list="картошка 1 кг\nпомидоры 2 шт\nлук 1 шт",
        cooking_method=CookingMethod.stewing,
        servings=3,
    )
    session.add_all(
        [
            menu,
            recipe,
            StockItem(name="картофель", quantity="2 кг"),
            StockItem(name="томаты", quantity="5 шт"),
        ]
    )
    await session.commit()
    await session.refresh(menu)
    await session.refresh(recipe)

    session.add(MenuItem(menu_id=menu.id, recipe_id=recipe.id, position=0, week_number=1, is_cooked=False))
    await session.commit()

    shopping = await get_shopping_list(menu_id=menu.id, db=session, _=None)

    assert "картошка 1 кг" in shopping["in_stock_list"]
    assert "помидоры 2 шт" in shopping["in_stock_list"]
    assert "лук 1 шт" in shopping["to_buy_list"]


@pytest.mark.asyncio
async def test_get_shopping_list_matches_phrase_synonyms_and_descriptors(session):
    menu = Menu(title="Фразы", weeks=1, status=MenuStatus.active)
    recipe = Recipe(
        title="Салат",
        ingredients="овощи",
        shopping_list="болгарский перец 2 шт\nсвежий чеснок 3 зубчика\nукроп 1 пучок",
        cooking_method=CookingMethod.raw,
        servings=2,
    )
    session.add_all(
        [
            menu,
            recipe,
            StockItem(name="перец", quantity="4 шт"),
            StockItem(name="чеснок", quantity="1 головка"),
        ]
    )
    await session.commit()
    await session.refresh(menu)
    await session.refresh(recipe)

    session.add(MenuItem(menu_id=menu.id, recipe_id=recipe.id, position=0, week_number=1, is_cooked=False))
    await session.commit()

    shopping = await get_shopping_list(menu_id=menu.id, db=session, _=None)

    assert "болгарский перец 2 шт" in shopping["in_stock_list"]
    assert "свежий чеснок 3 зубчика" in shopping["in_stock_list"]
    assert "укроп 1 пучок" in shopping["to_buy_list"]


@pytest.mark.asyncio
async def test_get_shopping_list_applies_custom_aliases_from_settings(session):
    menu = Menu(title="Пользовательские алиасы", weeks=1, status=MenuStatus.active)
    recipe = Recipe(
        title="Рататуй",
        ingredients="овощи",
        shopping_list="цуккини 2 шт\nчеснок 2 зубчика",
        cooking_method=CookingMethod.stewing,
        servings=2,
    )
    session.add_all(
        [
            menu,
            recipe,
            StockItem(name="кабачок", quantity="3 шт"),
            AppSettings(key="warehouse_product_synonyms", value='{"цуккини": "кабачок"}'),
        ]
    )
    await session.commit()
    await session.refresh(menu)
    await session.refresh(recipe)

    session.add(MenuItem(menu_id=menu.id, recipe_id=recipe.id, position=0, week_number=1, is_cooked=False))
    await session.commit()

    shopping = await get_shopping_list(menu_id=menu.id, db=session, _=None)

    assert "цуккини 2 шт" in shopping["in_stock_list"]
    assert "чеснок 2 зубчика" in shopping["to_buy_list"]
