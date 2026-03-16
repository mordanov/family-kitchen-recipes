import pytest
from sqlalchemy import select

from app.api.members import (
    list_members,
    create_member,
    update_member,
    delete_member,
    add_preferred,
    remove_preferred,
    add_disliked,
    remove_disliked,
)
from app.models import FamilyMember, Recipe, CookingMethod, Gender, DietModel


@pytest.mark.asyncio
async def test_create_member(session):
    member = await create_member(
        name="Борис",
        weight=80.0,
        age=40,
        gender=Gender.male,
        diet_model=DietModel.weight_loss,
        color="#FF6B35",
        photo=None,
        db=session,
        _=None,
    )
    assert member.id is not None
    assert member.name == "Борис"
    assert member.weight == 80.0
    assert member.age == 40
    assert member.gender == Gender.male
    assert member.diet_model == DietModel.weight_loss
    assert member.preferred_recipe_ids == []
    assert member.disliked_recipe_ids == []


@pytest.mark.asyncio
async def test_list_members(session, sample_member):
    result = await list_members(db=session, _=None)
    assert any(m.id == sample_member.id for m in result)


@pytest.mark.asyncio
async def test_update_member(session, sample_member):
    updated = await update_member(
        member_id=sample_member.id,
        name="Алиса Обновлённая",
        weight=52.0,
        birth_date=None,
        gender=None,
        diet_model=DietModel.weight_loss,
        color="#FF6B35",
        remove_photo=None,
        photo=None,
        db=session,
        _=None,
    )
    assert updated.name == "Алиса Обновлённая"
    assert updated.weight == 52.0
    assert updated.diet_model == DietModel.weight_loss


@pytest.mark.asyncio
async def test_delete_member(session, sample_member):
    result = await delete_member(member_id=sample_member.id, db=session, _=None)
    assert result == {"ok": True}

    check = await session.execute(
        select(FamilyMember).where(FamilyMember.id == sample_member.id)
    )
    assert check.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_add_remove_preferred_recipe(session, sample_member, sample_recipe):
    updated = await add_preferred(
        member_id=sample_member.id,
        recipe_id=sample_recipe.id,
        db=session,
        _=None,
    )
    assert sample_recipe.id in updated.preferred_recipe_ids

    updated2 = await remove_preferred(
        member_id=sample_member.id,
        recipe_id=sample_recipe.id,
        db=session,
        _=None,
    )
    assert sample_recipe.id not in updated2.preferred_recipe_ids


@pytest.mark.asyncio
async def test_add_remove_disliked_recipe(session, sample_member, sample_recipe):
    updated = await add_disliked(
        member_id=sample_member.id,
        recipe_id=sample_recipe.id,
        db=session,
        _=None,
    )
    assert sample_recipe.id in updated.disliked_recipe_ids

    updated2 = await remove_disliked(
        member_id=sample_member.id,
        recipe_id=sample_recipe.id,
        db=session,
        _=None,
    )
    assert sample_recipe.id not in updated2.disliked_recipe_ids

