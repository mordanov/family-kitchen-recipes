import logging

import fitz  # PyMuPDF

from app.services.recipe_ocr import _empty_result, parse_recipe_images

logger = logging.getLogger(__name__)

_MAX_PAGES = 10
_RENDER_SCALE = 2.0  # 144 DPI (72 * 2)


async def parse_recipe_pdf(pdf_bytes: bytes) -> dict:
    """Render each PDF page to a PNG image and run vision OCR on them."""
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        logger.warning(f"Failed to open PDF: {exc}")
        return _empty_result(confidence=0.0, reason="Не удалось открыть PDF")

    images: list[tuple[bytes, str]] = []
    page_count = min(len(doc), _MAX_PAGES)

    mat = fitz.Matrix(_RENDER_SCALE, _RENDER_SCALE)
    for i in range(page_count):
        try:
            pix = doc[i].get_pixmap(matrix=mat)
            images.append((pix.tobytes("png"), "image/png"))
        except Exception as exc:
            logger.warning(f"Failed to render PDF page {i}: {exc}")

    doc.close()

    if not images:
        return _empty_result(confidence=0.0, reason="PDF не содержит страниц")

    logger.info(f"Rendered {len(images)} PDF page(s), sending to OCR")
    return await parse_recipe_images(images)
