import base64
import json
import logging
import re

from app.config import settings

logger = logging.getLogger(__name__)


async def parse_receipt_with_vision(
    image_bytes: bytes,
    content_type: str = "image/jpeg",
) -> tuple[str, list[dict]]:
    """
    Send a receipt photo directly to the OpenAI vision API (gpt-4o-mini).

    Returns (transcript, products) where:
      - transcript: human-readable text extracted from the receipt (for display / debug)
      - products:   list of {"name": str, "quantity": str} dicts, names in Russian lowercase
    """
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OpenAI API key is not configured – cannot parse receipt.")

    mime = content_type if content_type.startswith("image/") else "image/jpeg"
    img_b64 = base64.b64encode(image_bytes).decode()

    prompt = (
        "This is a photo of a store receipt. It may be rotated or skewed — that's fine, "
        "please read it regardless of orientation.\n\n"
        "Do TWO things and return a single JSON object (no markdown, no explanation):\n\n"
        "1. Transcribe all readable text from the receipt into the \"text\" field.\n"
        "2. Extract every product line item into the \"items\" array:\n"
        "   - Translate product names to Russian, lowercase\n"
        "   - Remove prices, item codes, barcodes, discounts from the name\n"
        "   - Quantity format: «1 шт», «500 г», «1 кг», «1 л», «2 шт» etc.\n"
        "     If the receipt shows a count prefix like \"4 QUESO\", use quantity «4 шт»\n"
        "     If the receipt shows weight × price/kg, compute quantity as «X кг»\n"
        "   - If quantity not shown, use «1 шт»\n"
        "   - Ignore: totals, taxes, cashier, store name, receipt number, parking\n\n"
        "Required output format (ONLY this JSON, nothing else):\n"
        '{"text": "<full receipt transcription>", '
        '"items": [{"name": "<russian lowercase name>", "quantity": "<qty>"}, ...]}\n\n'
        "If no products are found: {\"text\": \"...\", \"items\": []}"
    )

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime};base64,{img_b64}",
                            "detail": "high",
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
        max_tokens=2000,
        temperature=0.1,
    )

    content = response.choices[0].message.content.strip()
    logger.info(f"Vision receipt response (first 400 chars): {content[:400]}")

    # Strip markdown code fences if the model added them anyway
    content = re.sub(r"```(?:json)?\s*", "", content).strip()

    start = content.find("{")
    end = content.rfind("}")
    if start == -1 or end == -1:
        logger.warning(f"No JSON object in vision response: {content}")
        return (content, [])

    try:
        data = json.loads(content[start : end + 1])
    except json.JSONDecodeError as exc:
        logger.warning(f"JSON decode error in vision response: {exc} | raw: {content}")
        return (content, [])

    transcript = str(data.get("text", "")).strip()
    items_raw = data.get("items", [])

    products: list[dict] = []
    for item in items_raw:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip().lower()
        quantity = str(item.get("quantity", "1 шт")).strip()
        if name:
            products.append({"name": name, "quantity": quantity})

    logger.info(f"Vision extracted {len(products)} products")
    return (transcript, products)
