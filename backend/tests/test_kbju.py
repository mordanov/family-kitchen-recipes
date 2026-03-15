import sys
import types

import pytest

from app.services import kbju as kbju_service


def install_fake_openai(monkeypatch, response_text):
    class FakeResponse:
        choices = [
            types.SimpleNamespace(
                message=types.SimpleNamespace(content=response_text)
            )
        ]

    class FakeAsyncOpenAI:
        def __init__(self, api_key):
            self.api_key = api_key
            self.chat = types.SimpleNamespace(
                completions=types.SimpleNamespace(create=self._create)
            )

        async def _create(self, **_kwargs):
            return FakeResponse()

    monkeypatch.setitem(sys.modules, "openai", types.SimpleNamespace(AsyncOpenAI=FakeAsyncOpenAI))


@pytest.mark.asyncio
async def test_calculate_kbju_uses_mock_when_openai_key_is_missing(monkeypatch):
    monkeypatch.setattr(kbju_service.settings, "OPENAI_API_KEY", "")

    result = await kbju_service.calculate_kbju(
        title="Овощной суп",
        ingredients="картофель\nморковь\nлук",
        cooking_method="boiling",
        servings=4,
    )

    assert result == {
        "calories": 147.0,
        "proteins": 7.4,
        "fats": 4.2,
        "carbs": 11.6,
    }


@pytest.mark.asyncio
async def test_calculate_kbju_extracts_json_from_openai_response(monkeypatch):
    monkeypatch.setattr(kbju_service.settings, "OPENAI_API_KEY", "test-key")
    install_fake_openai(
        monkeypatch,
        'Результат: {"calories": "320.5", "proteins": 18, "fats": 12.4, "carbs": 20}',
    )

    result = await kbju_service.calculate_kbju(
        title="Курица",
        ingredients="курица\nспеции",
        cooking_method="baking",
        servings=2,
    )

    assert result == {
        "calories": 320.5,
        "proteins": 18.0,
        "fats": 12.4,
        "carbs": 20.0,
    }


@pytest.mark.asyncio
async def test_calculate_kbju_returns_none_for_suspicious_values(monkeypatch):
    monkeypatch.setattr(kbju_service.settings, "OPENAI_API_KEY", "test-key")
    install_fake_openai(
        monkeypatch,
        '{"calories": 8000, "proteins": 25, "fats": 10, "carbs": 5}',
    )

    result = await kbju_service.calculate_kbju(
        title="Очень калорийное блюдо",
        ingredients="масло",
        cooking_method="frying",
        servings=1,
    )

    assert result is None

