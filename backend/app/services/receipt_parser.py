import io
import json
import logging
import re

from PIL import Image

from app.config import settings

logger = logging.getLogger(__name__)


def ocr_image(image_bytes: bytes) -> str:
    """
    Extract raw text from a receipt image using pytesseract (Tesseract OCR).
    Tries Russian+English recognition first; falls back to auto-detect.
    """
    try:
        import pytesseract
    except ImportError:
        raise RuntimeError("pytesseract is not installed. Add it to requirements.txt and rebuild the Docker image.")

    img = Image.open(io.BytesIO(image_bytes))

    # Convert to RGB if needed (e.g. RGBA PNG)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    # PSM 6 = Assume a single uniform block of text (good for receipts)
    try:
        text = pytesseract.image_to_string(img, lang="rus+eng", config="--psm 6")
    except pytesseract.TesseractError:
        # Language pack not available – fall back to default
        logger.warning("rus+eng lang pack unavailable, falling back to default OCR")
        text = pytesseract.image_to_string(img, config="--psm 6")

    result = text.strip()
    if not result:
        raise ValueError("OCR returned empty text – the image may be unreadable or blank.")
    return result


async def parse_products_with_openai(ocr_text: str) -> list[dict]:
    """
    Send OCR text to OpenAI gpt-4o-mini to:
      - identify product line items
      - translate names to Russian
      - normalize names (drop codes/prices/noise)
      - extract quantities

    Returns a list of {"name": str, "quantity": str} dicts.
    """
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OpenAI API key is not configured – cannot parse receipt.")

    prompt = (
        "Ты помощник по распознаванию кассовых чеков.\n\n"
        "Тебе дан текст, полученный с помощью OCR из фотографии чека из магазина.\n"
        "Твоя задача:\n"
        "1. Извлечь все товарные позиции (продукты питания и бытовые товары).\n"
        "2. Перевести названия на русский язык, если они не на русском.\n"
        "3. Нормализовать: убрать артикулы, штрих-коды, цены, скидки — оставить\n"
        "   только понятное человеку название продукта в нижнем регистре.\n"
        "4. Указать количество/объём в удобочитаемом виде: «1 кг», «500 г», «2 шт», «1 л» и т.п.\n"
        "   Если явно не указано — написать «1 шт».\n\n"
        "Игнорируй: суммы, налоги, скидки на чек, название магазина, дату, кассира, номер чека.\n\n"
        f"OCR текст:\n{ocr_text}\n\n"
        "Ответь ТОЛЬКО валидным JSON-массивом без пояснений и без markdown:\n"
        '[{"name": "название продукта", "quantity": "количество"}, ...]\n'
        "Если товаров не найдено — верни пустой массив: []"
    )

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1500,
        temperature=0.1,
    )
    content = response.choices[0].message.content.strip()
    logger.info(f"OpenAI receipt parse (first 300 chars): {content[:300]}")

    # Strip markdown code fences if present
    content = re.sub(r"```(?:json)?\s*", "", content).strip()

    start = content.find("[")
    end = content.rfind("]")
    if start == -1 or end == -1 or end <= start:
        logger.warning(f"No JSON array found in OpenAI response: {content}")
        return []

    try:
        data = json.loads(content[start : end + 1])
    except json.JSONDecodeError as exc:
        logger.warning(f"JSON decode error in OpenAI response: {exc} | content: {content}")
        return []
    products: list[dict] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip().lower()
        quantity = str(item.get("quantity", "1 шт")).strip()
        if name:
            products.append({"name": name, "quantity": quantity})

    return products
