# Feature: Internet Image Search for Recipe Photos

## Summary

A button in the recipe edit form opens a modal that searches the internet for food photos
matching the recipe name, shows 4 results in a grid, and lets the user pick one (or cancel).
The chosen image is downloaded by the backend and stored as the recipe photo.

---

## API Provider Decision

**Recommended: Google Custom Search API (image search)**

- Endpoint: `https://www.googleapis.com/customsearch/v1`
- Requires: `GOOGLE_API_KEY` + `GOOGLE_CSE_ID` (Custom Search Engine configured for image search)
- Free tier: 100 queries/day, then ~$5/1000 queries
- Returns direct image URLs with metadata (title, thumbnail, full size)
- Setup: create a Programmable Search Engine at https://programmablesearchengine.google.com/, enable "Image search"

**Alternative: Unsplash API**
- Food photos are high quality but the selection may be limited for specific Russian dish names
- Free up to 50 requests/hour

**Use Google CSE** — it works with any language query including Russian names.

---

## Backend Changes

### New environment variables (`backend/.env` or config)
```
GOOGLE_API_KEY=...
GOOGLE_CSE_ID=...
```

### New endpoint: `GET /recipes/image-search?q=<recipe_name>`

File: `backend/app/api/recipes.py`

Logic:
1. Call Google Custom Search API with `q=<recipe_name>`, `searchType=image`, `num=4`
2. Return array of image result objects: `[{ url, thumbnail, title }]`
3. Handle API errors gracefully (return 503 if Google is unavailable)

Example response:
```json
[
  { "url": "https://...", "thumbnail": "https://...", "title": "..." },
  ...
]
```

Backend must proxy the request (not expose API keys to the frontend).

### New endpoint: `POST /recipes/{id}/image-from-url`

Body: `{ "url": "<image_url>" }`

Logic:
1. Download the image from the given URL (with a timeout of ~10s)
2. Validate it is a real image (check Content-Type header)
3. Resize/crop to a reasonable size (max 1200px wide, same as uploaded images)
4. Save to the same storage path as regular recipe images
5. Update `recipe.image_path` in the database
6. Return the updated recipe object

Security: only allow HTTPS URLs, reject private IP ranges (127.x, 10.x, 192.168.x, etc.) to prevent SSRF.

---

## Frontend Changes

### New file: `frontend/src/pages/recipes/RecipeImageSearchModal.jsx`

Props: `{ open, recipeTitle, onClose, onSelect }`

UI:
- Modal with title "Найти фото в интернете"
- On open: immediately call `GET /api/recipes/image-search?q=<recipeTitle>` and show a spinner
- Show 4 images in a 2×2 grid (or row of 4 on wider screens)
- Each image is clickable — clicking one calls `onSelect(url)` and closes
- "Отмена" button closes without selecting
- If search fails: show error message + retry button
- Image thumbnails use `object-fit: cover`, square aspect ratio

### Changes to `RecipeFormModal.jsx`

Add a "🔍 Найти в интернете" button next to the photo upload area (only visible when no photo is set, or as an alternative to manual upload).

When clicked: open `RecipeImageSearchModal` with `recipeTitle={form.title}`.

`onSelect` callback:
- Call `POST /api/recipes/{form.id}/image-from-url` with the chosen URL
- On success: update `form.imagePreview` with the returned `image_path`
- On error: show toast

Note: image-from-url only works for an existing recipe (needs an ID). If the recipe is new (no `form.id`), download and store the image as a blob, set it as `form.imageFile` (same as a manual upload).

### API additions in `frontend/src/api.js`

```js
searchRecipeImages: (q) => request('GET', `/recipes/image-search?q=${encodeURIComponent(q)}`),
setImageFromUrl: (id, url) => request('POST', `/recipes/${id}/image-from-url`, { url }),
```

---

## CSS additions (`styles.css`)

```css
.image-search-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px;
}
.image-search-thumb {
  aspect-ratio: 1; overflow: hidden; border-radius: var(--radius-sm);
  border: 2px solid var(--c-border); cursor: pointer; transition: all 0.2s;
}
.image-search-thumb:hover { border-color: var(--c-primary); transform: scale(1.02); }
.image-search-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
```

---

## Implementation notes

- Always proxy image search through the backend — never expose `GOOGLE_API_KEY` to the browser.
- For the SSRF guard on `image-from-url`, use Python's `ipaddress` module to check resolved IP of the URL's hostname before downloading.
- The same image resize pipeline as regular uploads should be reused (if one exists).
- If `form.id` is empty (new recipe not yet saved), the "find online" button should first trigger a save, then fetch the image. Alternatively, download the image to a local blob URL and treat it as a manual upload — this is simpler and avoids a premature save.
- Show attribution note: "Фото из интернета" badge on the recipe card if the image came from a URL search (optional).
