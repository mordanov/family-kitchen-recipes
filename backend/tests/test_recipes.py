import pytest
from fastapi import BackgroundTasks

from app.api.recipes import get_recipe, list_recipes, update_recipe
from app.models import CookingMethod, FamilyMember, Recipe


@pytest.mark.asyncio
async def test_list_recipes_returns_member_feedback(session):
    soup = Recipe(
        title="Суп",
        ingredients="вода",
        shopping_list="вода",
        cooking_method=CookingMethod.boiling,
        servings=2,
    )
    pie = Recipe(
        title="Пирог",
        ingredients="мука",
        shopping_list="мука",
        cooking_method=CookingMethod.baking,
        servings=4,
    )

    alice = FamilyMember(name="Алиса", color="#4ECDC4")
    boris = FamilyMember(name="Борис", color="#FF6B35")

    alice.preferred_recipes.append(soup)
    boris.disliked_recipes.append(soup)

    session.add_all([soup, pie, alice, boris])
    await session.commit()

    recipes = await list_recipes(db=session, _=None, search=None)
    by_title = {r.title: r for r in recipes}

    assert len(by_title["Суп"].member_feedback) == 2
    assert by_title["Пирог"].member_feedback == []

    statuses = {(item.member_name, item.status, item.member_color) for item in by_title["Суп"].member_feedback}
    assert ("Алиса", "preferred", "#4ECDC4") in statuses
    assert ("Борис", "disliked", "#FF6B35") in statuses


@pytest.mark.asyncio
async def test_get_recipe_prefers_disliked_when_member_has_both(session):
    recipe = Recipe(
        title="Котлеты",
        ingredients="мясо",
        shopping_list="мясо",
        cooking_method=CookingMethod.frying,
        servings=3,
    )
    member = FamilyMember(name="Вера", color="#AA66CC")

    member.preferred_recipes.append(recipe)
    member.disliked_recipes.append(recipe)

    session.add_all([recipe, member])
    await session.commit()

    out = await get_recipe(recipe_id=recipe.id, db=session, _=None)

    assert len(out.member_feedback) == 1
    assert out.member_feedback[0].member_name == "Вера"
    assert out.member_feedback[0].status == "disliked"


@pytest.mark.asyncio
async def test_update_recipe_accepts_recipe_text(session):
    recipe = Recipe(
        title="Котлеты",
        categories=["мясо"],
        ingredients="мясо",
        shopping_list="мясо",
        cooking_method=CookingMethod.frying,
        servings=3,
    )
    session.add(recipe)
    await session.commit()
    await session.refresh(recipe)

    out = await update_recipe(
        recipe_id=recipe.id,
        background_tasks=BackgroundTasks(),
        title="Котлеты домашние",
        categories=["мясо", "напитки"],
        ingredients="мясо\nлук",
        recipe="Смешать фарш, сформировать котлеты и обжарить",
        shopping_list="мясо\nлук",
        cooking_method=CookingMethod.frying,
        servings=4,
        cooking_time_minutes=35,
        extra_info="",
        image=None,
        db=session,
        _=None,
    )

    assert out.title == "Котлеты домашние"
    assert out.recipe == "Смешать фарш, сформировать котлеты и обжарить"
    assert out.categories == ["мясо", "напитки"]
    assert out.cooking_time_minutes == 35
