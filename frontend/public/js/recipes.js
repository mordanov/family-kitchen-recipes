/**
 * Recipes page – list, create, edit, delete, detail view
 */
const RECIPE_CATEGORIES = [
  'суп',
  'мясо',
  'курица',
  'рыба',
  'завтрак',
  'закуска',
  'салат',
  'гарнир',
  'морепродукты',
  'субпродукты',
  'высокобелковые продукты',
  'напитки',
]

const RecipesPage = (() => {
  let recipes = [];
  let currentRecipeId = null;
  let selectedCategories = [];

  async function load(search = '') {
    const grid = document.getElementById('recipes-grid');
    grid.innerHTML = '<div class="spinner"></div>';
    try {
      recipes = await API.listRecipes(search);
      renderGrid(recipes);
      // If any recipes still need KBJU calculation, start polling
      if (recipes.some(r => !r.kbju_calculated)) startKbjuPolling();
    } catch (e) {
      grid.innerHTML = `<p style="color:var(--c-danger)">${e.message}</p>`;
    }
  }

  function renderGrid(list) {
    const grid = document.getElementById('recipes-grid');
    if (!list.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <span class="emoji">🍽️</span>
          <h3>Рецептов пока нет</h3>
          <p>Добавьте первый семейный рецепт!</p>
          <button class="btn btn-primary" onclick="RecipesPage.openCreate()">+ Добавить рецепт</button>
        </div>`;
      return;
    }
    grid.innerHTML = list.map(r => recipeCard(r)).join('');
  }

  function recipeCard(r) {
    const img = r.image_path
      ? `<img src="${r.image_path}" alt="${r.title}" loading="lazy"/>`
      : getRecipeEmoji(r.cooking_method);

    const kbju = r.kbju_calculated
      ? `<div class="kbju-strip">
          <div class="kbju-item"><div class="kv">${r.calories?.toFixed(0) ?? '–'}</div><div class="kl">ккал</div></div>
          <div class="kbju-item"><div class="kv">${r.proteins?.toFixed(1) ?? '–'}</div><div class="kl">белки</div></div>
          <div class="kbju-item"><div class="kv">${r.fats?.toFixed(1) ?? '–'}</div><div class="kl">жиры</div></div>
          <div class="kbju-item"><div class="kv">${r.carbs?.toFixed(1) ?? '–'}</div><div class="kl">углев.</div></div>
        </div>`
      : `<p class="kbju-pending">⏳ КБЖУ рассчитывается...</p>`;

    const categoryBadges = (r.categories || [])
      .slice(0, 3)
      .map(c => `<span class="badge badge-accent">${escapeHtml(c)}</span>`)
      .join('')

    const cookingTimeBadge = Number.isFinite(r.cooking_time_minutes)
      ? `<span class="badge">⏱ ${r.cooking_time_minutes} мин</span>`
      : ''

    return `
      <div class="recipe-card" onclick="RecipesPage.openDetail(${r.id})">
        <div class="recipe-card-img">${img}</div>
        <div class="recipe-card-body">
          <div class="recipe-card-title">${r.title}</div>
          <div class="recipe-card-meta">
            <span class="badge badge-primary">${App.cookingMethodLabel(r.cooking_method)}</span>
            <span class="badge">${r.servings} порц.</span>
            ${cookingTimeBadge}
            ${categoryBadges}
          </div>
          ${kbju}
          ${renderMemberFeedback(r)}
        </div>
      </div>`;
  }

  function toRgba(hex, alpha) {
    if (!hex || typeof hex !== 'string') return `rgba(255,107,53,${alpha})`;
    const clean = hex.replace('#', '').trim();
    const norm = clean.length === 3
      ? clean.split('').map(ch => ch + ch).join('')
      : clean;
    if (!/^[0-9a-fA-F]{6}$/.test(norm)) return `rgba(255,107,53,${alpha})`;
    const r = parseInt(norm.slice(0, 2), 16);
    const g = parseInt(norm.slice(2, 4), 16);
    const b = parseInt(norm.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function renderMemberFeedback(recipe, compact = true) {
    const feedback = recipe.member_feedback || [];
    if (!feedback.length) return '';

    const title = compact ? '' : '<div class="section-title" style="margin-top:10px">❤️ Предпочтения семьи</div>';
    const chips = feedback.map(f => {
      const color = f.member_color || '#FF6B35';
      const icon = f.status === 'disliked' ? '💔' : '❤️';
      const moodClass = f.status === 'disliked' ? 'is-disliked' : 'is-preferred';
      return `<span class="recipe-feedback-chip ${moodClass}" style="border-color:${color};background:${toRgba(color, 0.14)};color:${color}">${icon} ${f.member_name}</span>`;
    }).join('');

    return `${title}<div class="recipe-feedback">${chips}</div>`;
  }

  function getRecipeEmoji(method) {
    const map = { boiling: '🍲', frying: '🍳', dry_frying: '🥘', stewing: '♨️', air_fryer: '🌀', baking: '🥧', raw: '🥗', other: '🍽️' };
    return map[method] || '🍽️';
  }

  function search(val) {
    clearTimeout(search._t);
    search._t = setTimeout(() => load(val), 300);
  }

  // ── Detail ──
  async function openDetail(id) {
    currentRecipeId = id;
    const recipe = recipes.find(r => r.id === id) || await API.getRecipe(id);
    renderDetail(recipe);
    document.getElementById('modal-recipe-detail').classList.add('open');
  }

  function renderDetail(r) {
    document.getElementById('btn-edit-recipe').onclick = () => { closeDetail(); openEdit(r); };
    document.getElementById('btn-delete-recipe').onclick = () => deleteRecipe(r.id);

    const img = r.image_path
      ? `<img src="${r.image_path}" alt="${r.title}"/>`
      : getRecipeEmoji(r.cooking_method);

    let kbjuHtml = '';
    if (r.kbju_calculated) {
      kbjuHtml = `
        <div class="kbju-big">
          <div class="kbju-big-item"><span class="val">${r.calories?.toFixed(0) ?? '–'}</span><span class="lbl">ккал</span></div>
          <div class="kbju-big-item accent"><span class="val">${r.proteins?.toFixed(1) ?? '–'}</span><span class="lbl">белки г</span></div>
          <div class="kbju-big-item accent"><span class="val">${r.fats?.toFixed(1) ?? '–'}</span><span class="lbl">жиры г</span></div>
          <div class="kbju-big-item accent"><span class="val">${r.carbs?.toFixed(1) ?? '–'}</span><span class="lbl">углев. г</span></div>
        </div>
        <p style="font-size:12px;color:var(--c-text-muted)">На 1 порцию из ${r.servings}</p>`;
    } else {
      kbjuHtml = `<p style="margin-top:12px;color:var(--c-text-muted)">⏳ КБЖУ рассчитывается...
        <button class="btn btn-secondary btn-sm" style="margin-left:8px" onclick="RecipesPage.recalc(${r.id})">Пересчитать</button></p>`;
    }

    const categories = (r.categories || [])
      .map(c => `<span class="badge badge-accent">${escapeHtml(c)}</span>`)
      .join('') || '<em>Не указаны</em>'

    const cookingTimeBadge = Number.isFinite(r.cooking_time_minutes)
      ? `<span class="badge">⏱ ${r.cooking_time_minutes} мин</span>`
      : ''

    const recipeText = r.recipe
      ? `<div class="section-title">👨‍🍳 Рецепт</div>
         <div class="ingredients-text" style="border-color:var(--c-accent)">${r.recipe}</div>`
      : ''

    const shopping = r.shopping_list
      ? `<div class="section-title">🛒 Закупочный список</div>
         <div class="ingredients-text" style="border-color:var(--c-accent)">${r.shopping_list}</div>`
      : '';

    const extra = r.extra_info
      ? `<div class="section-title">📝 Доп. информация</div>
         <div class="ingredients-text" style="border-color:var(--c-secondary)">${r.extra_info}</div>`
      : '';

    document.getElementById('recipe-detail-body').innerHTML = `
      <div class="recipe-detail-header">
        <div class="recipe-detail-img">${img}</div>
        <div class="recipe-detail-info">
          <div class="recipe-detail-title">${r.title}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <span class="badge badge-primary">${App.cookingMethodLabel(r.cooking_method)}</span>
            <span class="badge">${r.servings} порций</span>
            ${cookingTimeBadge}
            <span class="badge" style="font-size:11px;color:var(--c-text-muted)">Обновлён: ${App.formatDate(r.updated_at)}</span>
          </div>
          ${renderMemberFeedback(r, false)}
          ${kbjuHtml}
        </div>
      </div>
      <div class="section-title">🏷️ Категория блюда</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${categories}</div>
      <div class="section-title">📋 Ингредиенты</div>
      <div class="ingredients-text">${r.ingredients || '<em>Не указаны</em>'}</div>
      ${recipeText}
      ${shopping}
      ${extra}`;
  }

  function closeDetail() {
    document.getElementById('modal-recipe-detail').classList.remove('open');
  }

  // ── Create / Edit ──
  function openCreate() {
    currentRecipeId = null;
    document.getElementById('modal-recipe-title').textContent = 'Новый рецепт';
    document.getElementById('save-recipe-btn-text').textContent = 'Сохранить';
    clearForm();
    document.getElementById('modal-recipe-form').classList.add('open');
  }

  function openEdit(r) {
    currentRecipeId = r.id;
    document.getElementById('modal-recipe-title').textContent = 'Редактировать рецепт';
    document.getElementById('save-recipe-btn-text').textContent = 'Обновить';
    document.getElementById('recipe-id').value = r.id;
    document.getElementById('recipe-title').value = r.title;
    document.getElementById('recipe-method').value = r.cooking_method;
    document.getElementById('recipe-servings').value = r.servings;
    document.getElementById('recipe-cooking-time').value = r.cooking_time_minutes ?? '';
    document.getElementById('recipe-ingredients').value = r.ingredients;
    document.getElementById('recipe-instructions').value = r.recipe || '';
    document.getElementById('recipe-shopping').value = r.shopping_list;
    document.getElementById('recipe-extra').value = r.extra_info || '';
    setSelectedCategories(r.categories || []);
    if (r.image_path) {
      const prev = document.getElementById('image-preview');
      prev.src = r.image_path;
      prev.style.display = 'block';
      document.getElementById('image-upload-placeholder').style.display = 'none';
    }
    document.getElementById('modal-recipe-form').classList.add('open');
  }

  function clearForm() {
    ['recipe-id', 'recipe-title', 'recipe-ingredients', 'recipe-instructions', 'recipe-shopping', 'recipe-extra', 'recipe-cooking-time'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('recipe-method').value = 'boiling';
    document.getElementById('recipe-servings').value = 4;
    setSelectedCategories(['закуска']);
    document.getElementById('recipe-image').value = '';
    document.getElementById('image-preview').style.display = 'none';
    document.getElementById('image-upload-placeholder').style.display = 'block';
  }

  function closeModal() {
    document.getElementById('modal-recipe-form').classList.remove('open');
  }

  function previewImage(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const prev = document.getElementById('image-preview');
      prev.src = e.target.result;
      prev.style.display = 'block';
      document.getElementById('image-upload-placeholder').style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  function setSelectedCategories(categories) {
    const normalized = new Set();
    selectedCategories = [];

    (categories || []).forEach(raw => {
      const category = String(raw || '').trim();
      if (!category || !RECIPE_CATEGORIES.includes(category)) return;
      if (normalized.has(category)) return;
      normalized.add(category);
      selectedCategories.push(category);
    });

    renderSelectedCategories();
  }

  function renderSelectedCategories() {
    const editor = document.getElementById('recipe-categories-editor');
    if (!editor) return;

    const chipsHtml = selectedCategories
      .map(category => (
        `<span class="category-chip">${escapeHtml(category)}<button type="button" class="category-chip-remove" data-category="${escapeHtml(category)}" aria-label="Удалить категорию">×</button></span>`
      ))
      .join('');

    editor.classList.toggle('empty', selectedCategories.length === 0);
    editor.innerHTML = `${chipsHtml}<select class="category-inline-picker" id="recipe-category-picker"><option value="">+ Добавить категорию...</option>${getCategoryOptionsHtml()}</select>`;

    const picker = document.getElementById('recipe-category-picker');
    if (picker) {
      picker.addEventListener('change', event => {
        addCategoryFromPicker(event.target.value);
      });
    }

    editor.querySelectorAll('.category-chip-remove').forEach(btn => {
      btn.addEventListener('click', () => removeCategory(btn.dataset.category));
    });
  }

  function addCategoryFromPicker(value) {
    const category = String(value || '').trim();
    if (!category) return;
    if (!RECIPE_CATEGORIES.includes(category)) return;

    if (!selectedCategories.includes(category)) {
      selectedCategories.push(category);
      renderSelectedCategories();
    }
  }

  function removeCategory(category) {
    selectedCategories = selectedCategories.filter(item => item !== category);
    renderSelectedCategories();
  }

  function getSelectedCategories() {
    return [...selectedCategories];
  }

  function getCategoryOptionsHtml() {
    const selected = new Set(selectedCategories);
    return RECIPE_CATEGORIES
      .filter(category => !selected.has(category))
      .map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
      .join('');
  }

  async function saveRecipe() {
    const title = document.getElementById('recipe-title').value.trim();
    if (!title) { App.toast('Введите название блюда', 'error'); return; }

    const ingredients = document.getElementById('recipe-ingredients').value.trim();
    if (!ingredients) { App.toast('Заполните ингредиенты для готовки', 'error'); return; }

    const categories = getSelectedCategories();
    if (!categories.length) { App.toast('Выберите минимум одну категорию блюда', 'error'); return; }

    const recipe = document.getElementById('recipe-instructions').value.trim();

    const shoppingRaw = document.getElementById('recipe-shopping').value.trim();
    const shopping_list = shoppingRaw || ingredients;

    const fd = new FormData();
    fd.append('title', title);
    categories.forEach(c => fd.append('categories', c));
    fd.append('ingredients', ingredients);
    fd.append('recipe', recipe);
    fd.append('shopping_list', shopping_list);
    fd.append('cooking_method', document.getElementById('recipe-method').value);
    fd.append('servings', document.getElementById('recipe-servings').value);
    const cookingTimeValue = document.getElementById('recipe-cooking-time').value.trim();
    if (cookingTimeValue) {
      fd.append('cooking_time_minutes', cookingTimeValue);
    }
    fd.append('extra_info', document.getElementById('recipe-extra').value);
    const imgFile = document.getElementById('recipe-image').files[0];
    if (imgFile) fd.append('image', imgFile);

    const id = document.getElementById('recipe-id').value;
    try {
      if (id) {
        await API.updateRecipe(id, fd);
        App.toast('Рецепт обновлён! КБЖУ пересчитывается...', 'success');
      } else {
        await API.createRecipe(fd);
        App.toast('Рецепт добавлен! Считаем КБЖУ...', 'success');
      }
      closeModal();
      await load();
      startKbjuPolling();
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    }
  }

  async function deleteRecipe(id) {
    if (!confirm('Удалить рецепт? Это действие нельзя отменить.')) return;
    try {
      await API.deleteRecipe(id);
      closeDetail();
      await load();
      App.toast('Рецепт удалён', 'success');
    } catch (e) {
      App.toast('Ошибка удаления: ' + e.message, 'error');
    }
  }

  async function recalc(id) {
    try {
      await API.recalcKbju(id);
      App.toast('КБЖУ пересчитывается...', 'info');
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    }
  }

  // ── KBJU Polling ──
  // After save, poll every 4s for up to 60s until all pending recipes get KBJU
  let _pollTimer = null;

  function startKbjuPolling() {
    stopKbjuPolling();
    let attempts = 0;
    _pollTimer = setInterval(async () => {
      attempts++;
      const pending = recipes.filter(r => !r.kbju_calculated);
      if (!pending.length || attempts > 15) { stopKbjuPolling(); return; }
      try {
        const updated = await API.listRecipes(document.getElementById('recipe-search').value);
        const newlyDone = updated.filter(r => r.kbju_calculated && recipes.find(o => o.id === r.id && !o.kbju_calculated));
        if (newlyDone.length) {
          recipes = updated;
          renderGrid(recipes);
          App.toast(`КБЖУ рассчитан для: ${newlyDone.map(r => r.title).join(', ')}`, 'success');
        } else {
          recipes = updated;
        }
        if (!updated.some(r => !r.kbju_calculated)) stopKbjuPolling();
      } catch {}
    }, 4000);
  }

  function stopKbjuPolling() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }

  // ── Public API for menu page ──
  function getAll() { return recipes; }

  return {
    load,
    search,
    openCreate,
    openEdit,
    openDetail,
    closeDetail,
    closeModal,
    previewImage,
    saveRecipe,
    deleteRecipe,
    recalc,
    getAll,
    startKbjuPolling,
    stopKbjuPolling,
  };
})();

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
