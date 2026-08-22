#!/usr/bin/env python3
"""
import_recipes.py — Bulk-import recipes from a PDF cookbook into the app.

Requirements (all already installed in the backend Docker container):
    PyMuPDF, openai, httpx

Usage:
    python import_recipes.py \
        --pdf 250_recipes.pdf \
        --api-url https://your-vps.example.com \
        --username admin \
        --password secret \
        --openai-key sk-...

Options:
    --start N          Resume from recipe index N (0-based, default 0)
    --end N            Stop before recipe index N (default: all)
    --delay SECS       Seconds between recipes (default 1.0)
    --progress FILE    Progress log file (default: import_progress.json)
    --dry-run          Parse only, don't POST to the API
    --no-images        Skip cover image rendering (faster)
"""

import argparse
import io
import json
import logging
import re
import time
from pathlib import Path

import fitz            # PyMuPDF
import httpx
from openai import OpenAI

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# Section page boundaries (0-indexed PDF pages → category name in the app)
_SECTIONS = [
    (2,   131, "завтрак"),
    (132, 246, "суп"),
    (247, 439, "основное блюдо"),
    (440, 536, "салат"),
    (537, 597, "закуска"),
    (598, 683, "выпечка"),
    (684, 736, "десерт"),
    (737, 781, "напиток"),
]

_SYSTEM_PROMPT = """\
You are a recipe parser. Extract structured data from Russian recipe text taken from a PDF cookbook.

Return ONLY a valid JSON object with these exact fields (no markdown, no explanation):
- title: string — dish name in Russian, clean and complete
- cooking_method_hint: string — one of: варка, жарка, запекание, тушение, приготовление на пару, гриль, без термообработки, другое
- servings: integer or null — look for "рассчитан на N порций" or similar
- active_cooking_time_minutes: integer or null — active cooking time in minutes
- cooking_time_minutes: integer or null — total time (including passive: chilling, marinating, baking) in minutes
- ingredients: string — full ingredients section, preserve original formatting
- recipe_text: string — full step-by-step instructions, preserve all steps

Rules:
- Keep Russian text exactly as written; fix only obvious line-break hyphenation (e.g. "нра-\\nвится" → "нравится")
- For time values convert to minutes ("1.5 часа" → 90, "50-60 минут" → 55)
- If a field is absent, return null (or empty string for text fields)
- Return valid JSON only
"""


# ── PDF helpers ────────────────────────────────────────────────────────────────

def _is_cover(page, text: str) -> bool:
    """True if this page is a recipe cover (title + photo, not a content page)."""
    imgs = page.get_images()
    if len(imgs) < 2:
        return False
    # Normal attribution in Cyrillic
    if "Жить вкусно" in text:
        return True
    # Some pages use Latin lookalike chars: Жuть bkycнo
    if re.search(r"Ж[иu]т[ьb]\s+[вb][kк][уy][сc]н[оo]", text):
        return True
    # Very short pages with images and no numbered steps are also covers
    if len(text) < 80 and not re.search(r"^\d+\.", text, re.MULTILINE):
        return True
    return False


def _clean_title(cover_text: str) -> str:
    """Remove the 'Жить вкусно' stamp (Cyrillic or Latin-substituted) and normalise whitespace."""
    # Both opening and closing quote are U+201D in this PDF; also handle plain ASCII quotes
    t = re.sub(r'[“”„"\']\s*Ж[иu]т[ьb]\s+[вb][kк][уy][сc][ноn][оo][“”„"\'‟]?',
               "", cover_text, flags=re.I)
    return " ".join(t.split())


def _get_section(page_idx: int) -> str:
    for start, end, name in _SECTIONS:
        if start <= page_idx <= end:
            return name
    return "другое"


def find_recipes(doc) -> list[dict]:
    """Return a list of recipe metadata dicts, one per recipe."""
    covers = []
    for i in range(5, len(doc)):
        text = doc[i].get_text().strip()
        if "ПОШАГОВЫЕ" in text:
            continue
        if _is_cover(doc[i], text):
            covers.append({"cover_idx": i, "title": _clean_title(text)})

    recipes = []
    for k, info in enumerate(covers):
        cover_idx = info["cover_idx"]
        next_cover = covers[k + 1]["cover_idx"] if k + 1 < len(covers) else len(doc)
        recipes.append({
            "index": k,
            "cover_idx": cover_idx,
            "last_content_idx": next_cover - 1,
            "title": info["title"],
            "section": _get_section(cover_idx),
        })
    return recipes


def render_cover_jpeg(page, scale: float = 2.0) -> bytes:
    """Render the cover page to JPEG bytes at 144 DPI."""
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale))
    return pix.tobytes("jpeg")


def extract_content_text(doc, cover_idx: int, last_idx: int) -> str:
    """Concatenate text from content pages (everything after the cover)."""
    parts = []
    for i in range(cover_idx + 1, last_idx + 1):
        text = doc[i].get_text().strip()
        if "ПОШАГОВЫЕ" in text:   # section divider — stop here
            break
        if text:
            parts.append(text)
    return "\n\n".join(parts)


# ── OpenAI parsing ─────────────────────────────────────────────────────────────

def parse_recipe(client: OpenAI, title: str, content: str, section: str) -> dict:
    """Send recipe text to GPT-4o-mini and return the structured dict."""
    user_msg = (
        f"Book section (category): {section}\n"
        f"Recipe title from cover page: {title}\n\n"
        f"--- Recipe text ---\n{content}"
    )
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        max_tokens=2000,
        temperature=0.1,
        response_format={"type": "json_object"},
    )
    return json.loads(resp.choices[0].message.content)


# ── API helpers ────────────────────────────────────────────────────────────────

def api_login(base: str, username: str, password: str) -> str:
    r = httpx.post(f"{base}/api/auth/login",
                   json={"username": username, "password": password}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


def api_categories(base: str, token: str) -> dict[str, int]:
    r = httpx.get(f"{base}/api/directories/recipe-categories",
                  headers={"Authorization": f"Bearer {token}"}, timeout=15)
    r.raise_for_status()
    return {c["name"].lower(): c["id"] for c in r.json() if not c.get("is_deleted")}


def api_methods(base: str, token: str) -> dict[str, int]:
    r = httpx.get(f"{base}/api/directories/cooking-methods",
                  headers={"Authorization": f"Bearer {token}"}, timeout=15)
    r.raise_for_status()
    return {m["name"].lower(): m["id"] for m in r.json() if not m.get("is_deleted")}


def _best_match(hint: str, mapping: dict[str, int]) -> int | None:
    if not hint or not mapping:
        return None
    h = hint.lower().strip()
    if h in mapping:
        return mapping[h]
    for name, id_ in mapping.items():
        if h in name or name in h:
            return id_
    return None


def api_create_recipe(
    base: str,
    token: str,
    parsed: dict,
    category_id: int,
    method_id: int | None,
    image_bytes: bytes | None,
) -> int:
    """POST /api/recipes/ and return the new recipe id."""
    form = [
        ("title",           parsed.get("title") or "Без названия"),
        ("ingredients",     parsed.get("ingredients") or ""),
        ("recipe",          parsed.get("recipe_text") or ""),
        ("shopping_list",   parsed.get("ingredients") or ""),
        ("extra_info",      ""),
        ("servings",        str(parsed.get("servings") or 4)),
        ("freezer_friendly","false"),
        ("is_dietary",      "false"),
        ("categories",      str(category_id)),
    ]
    if parsed.get("cooking_time_minutes"):
        form.append(("cooking_time_minutes", str(parsed["cooking_time_minutes"])))
    if parsed.get("active_cooking_time_minutes"):
        form.append(("active_cooking_time_minutes", str(parsed["active_cooking_time_minutes"])))
    if method_id:
        form.append(("cooking_method", str(method_id)))

    files = {}
    if image_bytes:
        files["image"] = ("cover.jpg", image_bytes, "image/jpeg")

    r = httpx.post(
        f"{base}/api/recipes/",
        headers={"Authorization": f"Bearer {token}"},
        data=form,
        files=files or None,
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["id"]


# ── Progress tracking ──────────────────────────────────────────────────────────

def load_progress(path: Path) -> dict:
    return json.loads(path.read_text()) if path.exists() else {}


def save_progress(path: Path, progress: dict) -> None:
    path.write_text(json.dumps(progress, ensure_ascii=False, indent=2))


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(description="Bulk-import recipes from a PDF cookbook")
    ap.add_argument("--pdf",        required=True,  help="Path to the PDF file")
    ap.add_argument("--api-url",    required=True,  help="App base URL, e.g. https://myapp.example.com")
    ap.add_argument("--username",   required=True,  help="App login username")
    ap.add_argument("--password",   required=True,  help="App login password")
    ap.add_argument("--openai-key", required=True,  help="OpenAI API key")
    ap.add_argument("--start",      type=int, default=0,    help="Resume from this recipe index (0-based)")
    ap.add_argument("--end",        type=int, default=None, help="Stop before this recipe index")
    ap.add_argument("--delay",      type=float, default=1.0, help="Seconds between recipes (default 1.0)")
    ap.add_argument("--progress",   default="import_progress.json", help="Progress log file")
    ap.add_argument("--dry-run",    action="store_true", help="Parse only, don't POST to the API")
    ap.add_argument("--no-images",  action="store_true", help="Skip cover image rendering")
    args = ap.parse_args()

    progress_path = Path(args.progress)
    progress = load_progress(progress_path)

    log.info(f"Opening PDF: {args.pdf}")
    doc = fitz.open(args.pdf)
    recipes = find_recipes(doc)
    log.info(f"Found {len(recipes)} recipes in PDF")

    oai = OpenAI(api_key=args.openai_key)

    token = None
    cats: dict[str, int] = {}
    methods: dict[str, int] = {}

    if not args.dry_run:
        log.info("Authenticating with app...")
        token = api_login(args.api_url, args.username, args.password)
        cats = api_categories(args.api_url, token)
        methods = api_methods(args.api_url, token)
        log.info(f"Categories: {list(cats.keys())}")
        log.info(f"Methods:    {list(methods.keys())}")

    end = args.end if args.end is not None else len(recipes)
    batch = recipes[args.start:end]

    ok = err = skip = 0

    for recipe in batch:
        idx = recipe["index"]
        key = str(idx)

        if key in progress and progress[key].get("done"):
            log.info(f"[{idx+1:3d}/{len(recipes)}] SKIP (already done): {recipe['title']}")
            skip += 1
            continue

        log.info(
            f"[{idx+1:3d}/{len(recipes)}] {recipe['title']!r}  "
            f"p{recipe['cover_idx']+1}  section={recipe['section']}"
        )

        try:
            # 1. Extract text from content pages
            content = extract_content_text(doc, recipe["cover_idx"], recipe["last_content_idx"])
            if not content.strip():
                raise ValueError("No text extracted from content pages")

            # 2. Parse with GPT-4o-mini
            parsed = parse_recipe(oai, recipe["title"], content, recipe["section"])
            log.info(
                f"       title={parsed.get('title')!r}  "
                f"servings={parsed.get('servings')}  "
                f"time={parsed.get('cooking_time_minutes')} min"
            )

            if args.dry_run:
                progress[key] = {"done": True, "dry_run": True, "title": parsed.get("title")}
                ok += 1
                continue

            # 3. Render cover image
            image_bytes = None
            if not args.no_images:
                image_bytes = render_cover_jpeg(doc[recipe["cover_idx"]])

            # 4. Resolve category and cooking method
            cat_id = _best_match(recipe["section"], cats)
            if not cat_id:
                cat_id = next(iter(cats.values()))
                log.warning(f"       No category match for '{recipe['section']}', using id={cat_id}")

            method_id = _best_match(parsed.get("cooking_method_hint", ""), methods)

            # 5. Create recipe via API
            recipe_id = api_create_recipe(args.api_url, token, parsed, cat_id, method_id, image_bytes)
            log.info(f"       → created id={recipe_id}")

            progress[key] = {"done": True, "recipe_id": recipe_id, "title": parsed.get("title")}
            save_progress(progress_path, progress)
            ok += 1

        except Exception as exc:
            log.error(f"       ERROR: {exc}")
            progress[key] = {"done": False, "error": str(exc)}
            save_progress(progress_path, progress)
            err += 1

        time.sleep(args.delay)

    doc.close()

    print()
    log.info(f"Finished. created={ok}  errors={err}  skipped={skip}")
    if err:
        log.info("Re-run the same command to retry failed recipes (successes are skipped automatically).")


if __name__ == "__main__":
    main()
