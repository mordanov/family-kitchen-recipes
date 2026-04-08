import io
import json
import logging
import re

from PIL import Image, ImageEnhance

from app.config import settings

logger = logging.getLogger(__name__)


def _auto_rotate(img: Image.Image, pytesseract) -> Image.Image:
    """
    Use Tesseract OSD to detect the image orientation and rotate it upright.
    Receipts are often photographed sideways (90° or 270°).
    """
    try:
        osd = pytesseract.image_to_osd(img, config="--psm 0 --dpi 150", nice=0)
        match = re.search(r"Rotate:\s*(\d+)", osd)
        if match:
            angle = int(match.group(1))
            if angle:
                img = img.rotate(-angle, expand=True)
                logger.info(f"OCR: auto-rotated image by {angle}°")
    except Exception as exc:
        # OSD can fail on low-quality images or when there is not enough text;
        # continue without rotation rather than aborting the whole pipeline.
        logger.debug(f"OSD rotation detection skipped: {exc}")
    return img


def _preprocess(img: Image.Image, pytesseract) -> Image.Image:
    """Convert to grayscale, auto-rotate, and boost contrast."""
    gray = img.convert("L")
    gray = _auto_rotate(gray, pytesseract)
    # Boost contrast so faint thermal-paper text becomes crisper
    gray = ImageEnhance.Contrast(gray).enhance(2.0)
    return gray


def ocr_image(image_bytes: bytes) -> str:
    """
    Extract raw text from a receipt image using pytesseract (Tesseract OCR).

    Pre-processing steps applied before OCR:
      1. Grayscale conversion
      2. Auto-rotation via Tesseract OSD (fixes sideways/upside-down photos)
      3. Contrast enhancement (helps with faint thermal-paper receipts)

    OCR options:
      --psm 4  – single column of variable-size text (better for receipt columns
                 than psm 6 which assumes a uniform block)
      --oem 3  – LSTM neural-network engine (most accurate)
      --dpi 150 – explicit DPI so Tesseract doesn't underestimate character size
    """
    try:
        import pytesseract
    except ImportError:
        raise RuntimeError(
            "pytesseract is not installed. Add it to requirements.txt and rebuild the Docker image."
        )

    img = Image.open(io.BytesIO(image_bytes))
    img = _preprocess(img, pytesseract)

    ocr_config = "--psm 4 --oem 3 --dpi 150"
    try:
        text = pytesseract.image_to_string(img, lang="rus+eng", config=ocr_config)
    except pytesseract.TesseractError:
        logger.warning("rus+eng lang pack unavailable, falling back to default OCR")
        text = pytesseract.image_to_string(img, config=ocr_config)

    result = text.strip()
    if not result:
        raise ValueError("OCR returned empty text – the image may be unreadable or blank.")
    logger.info(f"OCR result (first 400 chars): {result[:400]}")
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
        "Важно: OCR-текст может быть неидеальным — могут быть лишние символы или опечатки. "
        "Постарайся интерпретировать максимально разумно.\n\n"
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
