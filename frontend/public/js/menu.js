/**
 * Menu page – active menu, add/remove items, mark cooked, close menu
 */
const MenuPage = (() => {
  let activeMenu = null;
  let currentWeek = 1;
  let allRecipes = [];

  async function load() {
    const content = document.getElementById('menu-content');
    content.innerHTML = '<div class="spinner"></div>';

    try {
      activeMenu = await API.getActiveMenu();
    } catch (e) {
      activeMenu = null;
    }

    // Always load recipes for picker
    try { allRecipes = await API.listRecipes(); } catch {}

    render();
  }

  function render() {
    const content = document.getElementById('menu-content');

    if (!activeMenu) {
      content.innerHTML = `
        <div class="empty-state">
          <span class="emoji">📅</span>
          <h3>Нет активного меню</h3>
          <p>Создайте меню на 1–4 недели и добавьте блюда</p>
          <button class="btn btn-primary" onclick="MenuPage.openCreate()">+ Создать меню</button>
        </div>`;
      return;
    }

    const isClosed = activeMenu.status === 'closed';
    const totalItems = activeMenu.items.length;
    const cookedItems = activeMenu.items.filter(i => i.is_cooked).length;
    const pct = totalItems ? Math.round(cookedItems / totalItems * 100) : 0;

    // Week tabs
    const tabs = Array.from({length: activeMenu.weeks}, (_, i) => `
      <button class="week-tab ${currentWeek === i+1 ? 'active' : ''}"
        onclick="MenuPage.setWeek(${i+1})">Неделя ${i+1}</button>`).join('');

    // Items for current week
    const weekItems = activeMenu.items
      .filter(item => item.week_number === currentWeek)
      .sort((a, b) => a.position - b.position);

    const itemsHtml = weekItems.length
      ? weekItems.map(item => renderMenuItemRow(item, isClosed)).join('')
      : `<div style="text-align:center;padding:32px;color:var(--c-text-muted)">
          <div style="font-size:40px;margin-bottom:8px">🍽️</div>
          <p>Блюда для этой недели ещё не добавлены</p>
        </div>`;

    const addPanel = !isClosed ? renderAddPanel() : '';

    const closedBadge = isClosed
      ? `<span class="badge" style="background:#e8e8ef;color:#6B6B80">Закрыто ${App.formatDate(activeMenu.closed_at)}</span>`
      : '';

    content.innerHTML = `
      <div class="menu-status-banner ${isClosed ? 'closed' : ''}">
        <div>
          <h3>${activeMenu.title} ${closedBadge}</h3>
          <p>${activeMenu.weeks} ${weeksLabel(activeMenu.weeks)} · ${totalItems} блюд · Готово: ${cookedItems}/${totalItems}</p>
          <div class="progress-bar" style="width:200px;margin-top:10px">
            <div class="progress-fill" style="width:${pct}%"></div>
          </div>
        </div>
        ${!isClosed ? `<button class="btn btn-secondary" style="background:rgba(255,255,255,0.2);color:white;border-color:rgba(255,255,255,0.3)" onclick="MenuPage.confirmClose()">Закрыть меню</button>` : ''}
      </div>

      <div class="weeks-tabs">${tabs}</div>

      <div class="menu-items-list">${itemsHtml}</div>

      ${addPanel}`;
  }

  function renderMenuItemRow(item, isClosed) {
    const r = item.recipe;
    const kbju = r && r.kbju_calculated
      ? `<span class="menu-item-kbju">${r.calories?.toFixed(0)} ккал</span>`
      : '';

    const checkClass = item.is_cooked ? 'checked' : '';
    const rowClass = item.is_cooked ? 'cooked' : '';

    const removeBtn = !isClosed
      ? `<button class="btn btn-sm" style="padding:6px 10px;background:var(--c-surface2);border:none;cursor:pointer;border-radius:8px" onclick="MenuPage.removeItem(event, ${item.id})" title="Убрать">✕</button>`
      : '';

    return `
      <div class="menu-item-row ${rowClass}" id="menu-item-${item.id}">
        <div class="menu-item-check ${checkClass}" onclick="MenuPage.toggleCooked(${item.id}, ${!item.is_cooked})">${item.is_cooked ? '✓' : ''}</div>
        <div style="flex:1">
          <div class="menu-item-title">${r ? r.title : 'Удалённый рецепт'}</div>
          <div style="display:flex;gap:8px;margin-top:4px">
            ${r ? `<span class="menu-item-meta">${App.cookingMethodLabel(r.cooking_method)} · ${r.servings} порц.</span>` : ''}
            ${kbju}
          </div>
        </div>
        ${removeBtn}
      </div>`;
  }

  function renderAddPanel() {
    const filtered = allRecipes;
    const listHtml = filtered.map(r => `
      <div class="recipe-picker-item" onclick="MenuPage.addItem(${r.id})">
        <div style="font-size:24px">${getEmoji(r.cooking_method)}</div>
        <div>
          <div class="title">${r.title}</div>
          <div class="meta">${App.cookingMethodLabel(r.cooking_method)} · ${r.servings} порц.${r.kbju_calculated ? ' · ' + r.calories?.toFixed(0) + ' ккал' : ''}</div>
        </div>
        <div style="margin-left:auto;color:var(--c-primary);font-weight:800;font-size:18px">+</div>
      </div>`).join('');

    return `
      <div class="add-recipe-panel">
        <h4>➕ Добавить блюдо в меню (неделя ${currentWeek})</h4>
        <input type="text" class="search-input" placeholder="🔍 Фильтр рецептов..." oninput="MenuPage.filterPicker(this.value)" style="margin-bottom:12px"/>
        <div class="recipe-picker-list" id="recipe-picker-list">${listHtml}</div>
      </div>`;
  }

  function filterPicker(val) {
    const low = val.toLowerCase();
    const filtered = low ? allRecipes.filter(r => r.title.toLowerCase().includes(low)) : allRecipes;
    const list = document.getElementById('recipe-picker-list');
    if (list) list.innerHTML = filtered.map(r => `
      <div class="recipe-picker-item" onclick="MenuPage.addItem(${r.id})">
        <div style="font-size:24px">${getEmoji(r.cooking_method)}</div>
        <div>
          <div class="title">${r.title}</div>
          <div class="meta">${App.cookingMethodLabel(r.cooking_method)} · ${r.servings} порц.</div>
        </div>
        <div style="margin-left:auto;color:var(--c-primary);font-weight:800;font-size:18px">+</div>
      </div>`).join('');
  }

  function getEmoji(m) {
    const map = { boiling:'🍲', frying:'🍳', stewing:'♨️', air_fryer:'🌀', baking:'🥧', raw:'🥗' };
    return map[m] || '🍽️';
  }

  function setWeek(w) {
    currentWeek = w;
    render();
  }

  async function addItem(recipeId) {
    if (!activeMenu) return;
    try {
      activeMenu = await API.addMenuItem(activeMenu.id, { recipe_id: recipeId, week_number: currentWeek });
      render();
      App.toast('Блюдо добавлено в меню', 'success');
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    }
  }

  async function toggleCooked(itemId, isCooked) {
    if (!activeMenu) return;
    try {
      activeMenu = await API.updateMenuItem(activeMenu.id, itemId, { is_cooked: isCooked });
      render();
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    }
  }

  async function removeItem(e, itemId) {
    e.stopPropagation();
    if (!activeMenu) return;
    try {
      activeMenu = await API.removeMenuItem(activeMenu.id, itemId);
      render();
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    }
  }

  async function confirmClose() {
    if (!confirm('Закрыть меню досрочно? Его можно будет просмотреть в истории.')) return;
    try {
      await API.closeMenu(activeMenu.id);
      activeMenu.status = 'closed';
      App.toast('Меню закрыто', 'success');
      await load();
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    }
  }

  async function openShoppingList() {
    if (!activeMenu) { App.toast('Нет активного меню', 'error'); return; }
    try {
      const data = await API.getShoppingList(activeMenu.id);
      const body = document.getElementById('shopping-modal-body');
      if (!Object.keys(data.shopping_lists).length) {
        body.innerHTML = '<div class="empty-state"><span class="emoji">🎉</span><h3>Всё готово!</h3><p>Все блюда уже приготовлены</p></div>';
      } else {
        body.innerHTML = Object.entries(data.shopping_lists).map(([title, list]) => `
          <div class="shopping-recipe">
            <h4>${title}</h4>
            <pre>${list}</pre>
          </div>`).join('<hr class="divider"/>');
      }
      document.getElementById('modal-shopping-list').classList.add('open');
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    }
  }

  function openCreate() {
    document.getElementById('menu-title').value = '';
    document.getElementById('menu-weeks').value = '1';
    document.getElementById('modal-new-menu').classList.add('open');
  }

  function closeCreate() {
    document.getElementById('modal-new-menu').classList.remove('open');
  }

  async function createMenu() {
    const title = document.getElementById('menu-title').value.trim();
    const weeks = parseInt(document.getElementById('menu-weeks').value);
    if (!title) { App.toast('Введите название меню', 'error'); return; }
    try {
      activeMenu = await API.createMenu({ title, weeks });
      closeCreate();
      currentWeek = 1;
      await load();
      App.toast('Меню создано!', 'success');
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    }
  }

  function weeksLabel(n) {
    if (n === 1) return 'неделя';
    if (n < 5) return 'недели';
    return 'недель';
  }

  return { load, setWeek, addItem, toggleCooked, removeItem, confirmClose, openShoppingList, openCreate, closeCreate, createMenu, filterPicker };
})();
