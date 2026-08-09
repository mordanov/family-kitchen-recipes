import base64
import json
import logging
import re
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
You are a culinary OCR assistant. The user sends you one or more images that together contain a single recipe (possibly spread across multiple pages/slides from social media or a book scan).

Your job:
1. Extract ALL recipe content from ALL images.
2. Return a single JSON object with the fields below (no markdown, no explanation — ONLY the JSON).

Fields:
- title: string — name of the dish (in Russian, as shown)
- category_hint: string — your best guess at a category (one of: "завтрак", "суп", "основное блюдо", "салат", "выпечка", "десерт", "закуска", "напиток", "другое")
- cooking_method_hint: string — one of: "варка", "жарка", "запекание", "тушение", "приготовление на пару", "гриль", "без термообработки", "другое"
- servings: integer or null — number of portions/servings if mentioned
- active_cooking_time_minutes: integer or null — active cooking time in minutes if mentioned
- cooking_time_minutes: integer or null — total time (including passive: soaking, chilling, baking) in minutes if mentioned
- ingredients: string — full ingredients list, preserving original formatting (quantities and names), in Russian
- recipe_text: string — full step-by-step instructions in Russian
- cover_image_index: integer or null — 0-based index of the image that looks most like a hero/cover photo of the finished dish; null if none is clearly suitable
- confidence: float — your overall confidence 0.0–1.0 that you correctly extracted all key recipe fields
- low_confidence_reason: string or null — if confidence < 0.9, briefly explain why (e.g. "partial text visible", "blurry image")

Rules:
- If a field is not present in the images, set it to null (or empty string for text fields).
- Do NOT invent information not visible in the images.
- For time values: convert to minutes (e.g. "1.5 часа" → 90, "50-60 минут" → 55 as midpoint).
- Return valid JSON only, no code fences.
"""


def _image_content_block(image_bytes: bytes, content_type: str) -> dict:
    mime = content_type if content_type.startswith("image/") else "image/jpeg"
    b64 = base64.b64encode(image_bytes).decode()
    return {
        "type": "image_url",
        "image_url": {
            "url": f"data:{mime};base64,{b64}",
            "detail": "high",
        },
    }


async def parse_recipe_images(
    images: list[tuple[bytes, str]],  # list of (image_bytes, content_type)
) -> dict:
    """
    Parse a recipe from one or more images via OpenAI vision.

    Returns a dict with keys: title, category_hint, cooking_method_hint, servings,
    active_cooking_time_minutes, cooking_time_minutes, ingredients, recipe_text,
    cover_image_index, confidence, low_confidence_reason.
    """
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OpenAI API key is not configured")

    if not images:
        raise ValueError("At least one image is required")

    content: list[dict] = []
    for image_bytes, content_type in images:
        content.append(_image_content_block(image_bytes, content_type))

    content.append({
        "type": "text",
        "text": (
            f"There are {len(images)} image(s) above. "
            "Extract the recipe and return the JSON as instructed."
        ),
    })

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": content},
        ],
        max_tokens=3000,
        temperature=0.1,
    )

    raw = response.choices[0].message.content.strip()
    logger.info(f"Recipe OCR response (first 500 chars): {raw[:500]}")

    raw = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1:
        logger.warning(f"No JSON in recipe OCR response: {raw}")
        return _empty_result(confidence=0.0, reason="Не удалось получить структурированный ответ от модели")

    try:
        data = json.loads(raw[start:end + 1])
    except json.JSONDecodeError as exc:
        logger.warning(f"JSON decode error in recipe OCR: {exc} | raw: {raw}")
        return _empty_result(confidence=0.0, reason="Ошибка разбора ответа модели")

    return _normalise(data)


def _empty_result(confidence: float = 0.0, reason: Optional[str] = None) -> dict:
    return {
        "title": "",
        "category_hint": "",
        "cooking_method_hint": "",
        "servings": None,
        "active_cooking_time_minutes": None,
        "cooking_time_minutes": None,
        "ingredients": "",
        "recipe_text": "",
        "cover_image_index": None,
        "confidence": confidence,
        "low_confidence_reason": reason,
    }


def _to_int_or_none(value) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _to_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _normalise(data: dict) -> dict:
    confidence = _to_float(data.get("confidence"), 0.5)
    confidence = max(0.0, min(1.0, confidence))
    cover_idx = _to_int_or_none(data.get("cover_image_index"))

    return {
        "title": str(data.get("title") or "").strip(),
        "category_hint": str(data.get("category_hint") or "").strip().lower(),
        "cooking_method_hint": str(data.get("cooking_method_hint") or "").strip().lower(),
        "servings": _to_int_or_none(data.get("servings")),
        "active_cooking_time_minutes": _to_int_or_none(data.get("active_cooking_time_minutes")),
        "cooking_time_minutes": _to_int_or_none(data.get("cooking_time_minutes")),
        "ingredients": str(data.get("ingredients") or "").strip(),
        "recipe_text": str(data.get("recipe_text") or "").strip(),
        "cover_image_index": cover_idx,
        "confidence": confidence,
        "low_confidence_reason": str(data.get("low_confidence_reason") or "").strip() or None,
    }
