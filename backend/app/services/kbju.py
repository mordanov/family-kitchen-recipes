import json
import re
import logging
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)

COOKING_METHOD_RU = {
    "boiling": "варка",
    "frying": "жарка",
    "stewing": "тушение",
    "air_fryer": "аэрогриль",
    "baking": "запекание",
    "raw": "в сыром виде",
}


async def calculate_kbju(
    title: str,
    ingredients: str,
    cooking_method: str,
    servings: int,
) -> Optional[dict]:
    """
    Calculate KBJU using OpenAI API.
    Returns dict with calories, proteins, fats, carbs per serving.
    Falls back to mock if no API key configured.
    """
    if not settings.OPENAI_API_KEY:
        logger.info("No OpenAI key configured, using mock KBJU calculation")
        return _mock_kbju(ingredients)

    method_ru = COOKING_METHOD_RU.get(cooking_method, cooking_method)

    prompt = f"""Ты опытный диетолог. Рассчитай КБЖУ (калории, белки, жиры, углеводы) строго на ОДНУ порцию готового блюда.

Название: {title}
Способ приготовления: {method_ru}
Количество порций: {servings}

Ингредиенты:
{ingredients}

Правила расчёта:
1. Учти потери при тепловой обработке ({method_ru}): вода испаряется, жиры частично вытапливаются
2. Раздели итоговые нутриенты на {servings} порций
3. Округли до 1 знака после запятой

Ответь ТОЛЬКО валидным JSON без каких-либо пояснений, markdown или кавычек вокруг JSON:
{{"calories": число, "proteins": число, "fats": число, "carbs": число}}"""

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
            temperature=0.1,
        )
        content = response.choices[0].message.content.strip()
        logger.info(f"OpenAI KBJU response for '{title}': {content}")

        # Extract JSON robustly
        json_match = re.search(r'\{[^}]+\}', content, re.DOTALL)
        if not json_match:
            logger.warning(f"No JSON found in OpenAI response: {content}")
            return None

        data = json.loads(json_match.group())
        result = {
            "calories": float(data.get("calories", 0)),
            "proteins": float(data.get("proteins", 0)),
            "fats":     float(data.get("fats", 0)),
            "carbs":    float(data.get("carbs", 0)),
        }
        # Basic sanity check
        if result["calories"] <= 0 or result["calories"] > 5000:
            logger.warning(f"Suspicious KBJU values for '{title}': {result}")
            return None

        return result

    except Exception as e:
        logger.error(f"OpenAI KBJU calculation failed for '{title}': {e}")
        return None


def _mock_kbju(ingredients: str) -> dict:
    """
    Mock KBJU when no OpenAI key is set.
    Produces plausible values based on ingredient count.
    """
    lines = [l.strip() for l in ingredients.split('\n') if l.strip()]
    base_calories = max(len(lines) * 35, 80)
    return {
        "calories": round(base_calories * 1.4, 1),
        "proteins": round(base_calories * 0.07, 1),
        "fats":     round(base_calories * 0.04, 1),
        "carbs":    round(base_calories * 0.11, 1),
    }
