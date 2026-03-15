import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.api.menus import add_menu_item, create_menu, get_shopping_list, auto_fill_menu, get_menu, list_menus
from app.models import CookingMethod, Menu, MenuItem, MenuItemMember, MenuStatus, Recipe, StockItem, PreparedDish, AppSettings, FamilyMember, DietModel, Gender
from app.schemas import MenuCreate, MenuItemCreate, AutoFillRequest


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


@pytest.mark.asyncio
async def test_auto_fill_meal_slots_reuses_recipes_to_fill_all_days(session):
    menu = Menu(title="Авто меню", weeks=1, status=MenuStatus.active)
    session.add(menu)
    session.add_all([
        Recipe(title="Рецепт 1", ingredients="a", shopping_list="a", cooking_method=CookingMethod.boiling, servings=2),
        Recipe(title="Рецепт 2", ingredients="b", shopping_list="b", cooking_method=CookingMethod.boiling, servings=2),
        Recipe(title="Рецепт 3", ingredients="c", shopping_list="c", cooking_method=CookingMethod.boiling, servings=2),
        Recipe(title="Рецепт 4", ingredients="d", shopping_list="d", cooking_method=CookingMethod.boiling, servings=2),
    ])
    await session.commit()
    await session.refresh(menu)

    result = await auto_fill_menu(
        menu_id=menu.id,
        data=AutoFillRequest(use_meal_slots=True, days=[1, 2, 3, 4, 5, 6, 7], meals=["breakfast"]),
        db=session,
        _=None,
    )

    assert result["added"] == 7
    items_result = await session.execute(select(MenuItem).where(MenuItem.menu_id == menu.id))
    filled_days = sorted(item.day_of_week for item in items_result.scalars().all())
    assert filled_days == [1, 2, 3, 4, 5, 6, 7]


@pytest.mark.asyncio
async def test_auto_fill_meal_slots_with_members_reuses_recipes_when_unique_pool_ends(session):
    menu = Menu(title="Семейное авто меню", weeks=1, status=MenuStatus.active)
    member = FamilyMember(
        name="Алиса",
        weight=55.0,
        gender=Gender.female,
        diet_model=DietModel.weight_maintain,
        color="#4ECDC4",
    )
    recipes = [
        Recipe(title="Сырники", ingredients="a", shopping_list="a", cooking_method=CookingMethod.frying, servings=2),
        Recipe(title="Каша", ingredients="b", shopping_list="b", cooking_method=CookingMethod.boiling, servings=2),
    ]
    session.add_all([menu, member, *recipes])
    await session.commit()
    await session.refresh(menu)
    await session.refresh(member)

    member.preferred_recipes.extend(recipes)
    await session.commit()

    result = await auto_fill_menu(
        menu_id=menu.id,
        data=AutoFillRequest(use_meal_slots=True, days=[1, 2, 3, 4, 5, 6, 7], meals=["breakfast"]),
        db=session,
        _=None,
    )

    assert result["added"] == 7
    items_result = await session.execute(select(MenuItem).where(MenuItem.menu_id == menu.id))
    filled_days = sorted(item.day_of_week for item in items_result.scalars().all())
    assert filled_days == [1, 2, 3, 4, 5, 6, 7]


@pytest.mark.asyncio
async def test_get_menu_includes_kbju_summary_total_and_by_day(session):
    menu = Menu(title="КБЖУ меню", weeks=1, status=MenuStatus.active)
    recipe_a = Recipe(
        title="Омлет",
        ingredients="a",
        shopping_list="a",
        cooking_method=CookingMethod.frying,
        servings=2,
        calories=200,
        proteins=10,
        fats=12,
        carbs=4,
        kbju_calculated=True,
    )
    recipe_b = Recipe(
        title="Суп",
        ingredients="b",
        shopping_list="b",
        cooking_method=CookingMethod.boiling,
        servings=2,
        calories=300,
        proteins=20,
        fats=10,
        carbs=25,
        kbju_calculated=True,
    )
    session.add_all([menu, recipe_a, recipe_b])
    await session.commit()
    await session.refresh(menu)
    await session.refresh(recipe_a)
    await session.refresh(recipe_b)

    session.add_all([
        MenuItem(menu_id=menu.id, recipe_id=recipe_a.id, position=0, week_number=1, day_of_week=1, meal_type="breakfast"),
        MenuItem(menu_id=menu.id, recipe_id=recipe_b.id, position=1, week_number=1, day_of_week=2, meal_type="lunch"),
    ])
    await session.commit()

    out = await get_menu(menu_id=menu.id, db=session, _=None)

    assert out.kbju_summary is not None
    assert out.kbju_summary.total.calories == 500
    assert out.kbju_summary.total.proteins == 30
    assert out.kbju_summary.total.fats == 22
    assert out.kbju_summary.total.carbs == 29

    by_day = {d.day_of_week: d for d in out.kbju_summary.by_day}
    assert by_day[1].calories == 200
    assert by_day[2].calories == 300


@pytest.mark.asyncio
async def test_list_menus_includes_kbju_by_member_from_assignments(session):
    menu = Menu(title="Семья КБЖУ", weeks=1, status=MenuStatus.active)
    member = FamilyMember(
        name="Алиса",
        weight=55.0,
        gender=Gender.female,
        diet_model=DietModel.weight_maintain,
        color="#4ECDC4",
    )
    recipe = Recipe(
        title="Сырники",
        ingredients="a",
        shopping_list="a",
        cooking_method=CookingMethod.frying,
        servings=2,
        calories=420,
        proteins=18,
        fats=20,
        carbs=40,
        kbju_calculated=True,
    )
    session.add_all([menu, member, recipe])
    await session.commit()
    await session.refresh(menu)
    await session.refresh(member)
    await session.refresh(recipe)

    slot = MenuItem(
        menu_id=menu.id,
        recipe_id=None,
        position=0,
        week_number=1,
        day_of_week=1,
        meal_type="breakfast",
    )
    session.add(slot)
    await session.flush()
    session.add(MenuItemMember(menu_item_id=slot.id, member_id=member.id, recipe_id=recipe.id))
    await session.commit()

    menus = await list_menus(db=session, _=None)
    out = next(m for m in menus if m.id == menu.id)

    assert out.kbju_summary is not None
    assert out.kbju_summary.total.calories == 420
    assert len(out.kbju_summary.by_member) == 1
    assert out.kbju_summary.by_member[0].member_id == member.id
    assert out.kbju_summary.by_member[0].calories == 420
