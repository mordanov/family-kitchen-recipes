/**
 * Menu page – active menu, add/remove items, mark cooked, close menu
 */
const MenuPage = (() => {
  let activeMenu = null;
  let currentWeek = 1;
  let allRecipes = [];
  let allMembers = [];
  let preparedByRecipeId = {};
  let stockNames = new Set();

  // State for the manual add-item panel
  let addItemMealType = null;   // 'breakfast'|'lunch'|'dinner'|null
  let addItemDay = null;        // 1-7 or null
  // Member assignments being built: { member_id -> recipe_id }
  let pendingAssignments = {};

  const MEAL_LABELS = { breakfast: '🌅 Завтрак', lunch: '☀️ Обед', dinner: '🌙 Ужин' };
  const MEAL_ORDER  = ['breakfast', 'lunch', 'dinner'];
  const DAY_LABELS  = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const QUICK_ACTION_CONFIRM_SKIP_KEY = 'menu.quickActions.skipConfirm';

  function getSkipQuickActionConfirm() {
    try {
      return localStorage.getItem(QUICK_ACTION_CONFIRM_SKIP_KEY) === '1';
    } catch {
      return false;
    }
  }

  function setSkipQuickActionConfirm(skip) {
    try {
      if (skip) localStorage.setItem(QUICK_ACTION_CONFIRM_SKIP_KEY, '1');
      else localStorage.removeItem(QUICK_ACTION_CONFIRM_SKIP_KEY);
    } catch {
      // Ignore localStorage errors in private mode/tests
    }
  }

  async function confirmQuickAction(message) {
    if (getSkipQuickActionConfirm()) return true;

    // Fallback for non-browser/test environments
    if (!document?.body) {
      return typeof confirm === 'function' ? confirm(message) : true;
    }

    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 1200;
        background: rgba(0,0,0,0.45);
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
      `;

      const box = document.createElement('div');
      box.style.cssText = `
        width: 100%; max-width: 430px; background: white;
        border-radius: 14px; box-shadow: 0 18px 50px rgba(0,0,0,0.25);
        padding: 18px;
      `;

      box.innerHTML = `
        <div style="font-weight:800;font-size:16px;margin-bottom:10px">Подтверждение</div>
        <div style="font-size:14px;line-height:1.5;color:var(--c-text);margin-bottom:12px">${message}</div>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--c-text-muted);margin-bottom:14px;cursor:pointer">
          <input type="checkbox" id="quick-confirm-skip" />
          Не спрашивать снова
        </label>
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button id="quick-confirm-cancel" class="btn btn-secondary" style="padding:8px 12px">Отмена</button>
          <button id="quick-confirm-ok" class="btn btn-primary" style="padding:8px 12px">Подтвердить</button>
        </div>
      `;

      overlay.appendChild(box);
      document.body.appendChild(overlay);

      const skipEl = box.querySelector('#quick-confirm-skip');
      const okBtn = box.querySelector('#quick-confirm-ok');
      const cancelBtn = box.querySelector('#quick-confirm-cancel');

      const cleanup = (value) => {
        const skip = !!skipEl?.checked;
        if (value && skip) setSkipQuickActionConfirm(true);
        overlay.remove();
        resolve(value);
      };

      okBtn?.addEventListener('click', () => cleanup(true));
      cancelBtn?.addEventListener('click', () => cleanup(false));
      overlay.addEventListener('click', (evt) => {
        if (evt.target === overlay) cleanup(false);
      });
    });
  }

  async function load() {
    const content = document.getElementById('menu-content');
    content.innerHTML = '<div class="spinner"></div>';

    const [activeMenuRes, recipesRes, preparedRes, stockRes, membersRes] = await Promise.allSettled([
      API.getActiveMenu(),
      API.listRecipes(),
      API.listPrepared(),
      API.listStock(),
      API.listMembers(),
    ]);

    activeMenu = activeMenuRes.status === 'fulfilled' ? activeMenuRes.value : null;
    allRecipes = recipesRes.status === 'fulfilled' ? recipesRes.value : [];
    allMembers = membersRes.status === 'fulfilled' ? membersRes.value : [];

    preparedByRecipeId = {};
    if (preparedRes.status === 'fulfilled') {
      for (const p of preparedRes.value || []) {
        preparedByRecipeId[p.recipe_id] = (preparedByRecipeId[p.recipe_id] || 0) + Number(p.servings || 0);
      }
    }

    stockNames = new Set();
    if (stockRes.status === 'fulfilled') {
      for (const s of stockRes.value || []) {
        if (s.name) stockNames.add(String(s.name).trim().toLowerCase());
      }
    }

    render();
  }

  // ── Detect whether this menu uses structured day+meal slots ──────────────
  function isMealSlotMenu(menu) {
    if (!menu) return false;
    return menu.items.some(i => i.meal_type && i.day_of_week);
  }

  function render() {
    const content = document.getElementById('menu-content');

    if (!activeMenu) {
      content.innerHTML = `
        <div class="empty-state">
          <span class="emoji">📅</span>
          <h3>Нет активного меню</h3>
          <p>Создайте меню вручную или воспользуйтесь авто-подбором</p>
          <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
            <button class="btn btn-primary" onclick="MenuPage.openCreate()">+ Создать меню</button>
            <button class="btn btn-secondary" onclick="MenuPage.openAutoFill()">🎲 Авто-подбор</button>
          </div>
        </div>`;
      return;
    }

    const isClosed = activeMenu.status === 'closed';
    const totalItems = activeMenu.items.length;
    const cookedItems = activeMenu.items.filter(i => i.is_cooked).length;
    const pct = totalItems ? Math.round(cookedItems / totalItems * 100) : 0;

    const tabs = Array.from({length: activeMenu.weeks}, (_, i) => `
      <button class="week-tab ${currentWeek === i+1 ? 'active' : ''}"
        onclick="MenuPage.setWeek(${i+1})">Неделя ${i+1}</button>`).join('');

    const weekItems = activeMenu.items
      .filter(item => item.week_number === currentWeek)
      .sort((a, b) => a.position - b.position);

    const usesSlots = isMealSlotMenu(activeMenu);
    let itemsHtml;
    if (usesSlots) {
      itemsHtml = renderSlotGrid(weekItems, isClosed);
    } else {
      itemsHtml = weekItems.length
        ? weekItems.map(item => renderMenuItemRow(item, isClosed)).join('')
        : `<div style="text-align:center;padding:32px;color:var(--c-text-muted)">
            <div style="font-size:40px;margin-bottom:8px">🍽️</div>
            <p>Блюда для этой недели ещё не добавлены</p>
          </div>`;
    }

    const addPanel = !isClosed ? renderAddPanel(usesSlots) : '';

    const closedBadge = isClosed
      ? `<span class="badge" style="background:#e8e8ef;color:#6B6B80">Закрыто ${App.formatDate(activeMenu.closed_at)}</span>`
      : '';

    content.innerHTML = `
      <div class="menu-status-banner ${isClosed ? 'closed' : ''}">
        <div>
          <h3>${activeMenu.title} ${closedBadge}</h3>
          <p>${activeMenu.weeks} ${weeksLabel(activeMenu.weeks)} · ${totalItems} слотов · Готово: ${cookedItems}/${totalItems}</p>
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

  // ── Slot grid (day × meal) ──────────────────────────────────────────────────
  function renderSlotGrid(weekItems, isClosed) {
    // Build lookup: day -> meal -> [items]
    const grid = {};
    const days = new Set();
    const meals = new Set();
    for (const item of weekItems) {
      const d = item.day_of_week || 0;
      const m = item.meal_type || 'other';
      days.add(d);
      meals.add(m);
      if (!grid[d]) grid[d] = {};
      if (!grid[d][m]) grid[d][m] = [];
      grid[d][m].push(item);
    }

    // Also add items without day/meal as flat rows
    const flatItems = weekItems.filter(i => !i.day_of_week || !i.meal_type);
    const slottedItems = weekItems.filter(i => i.day_of_week && i.meal_type);

    if (!slottedItems.length && !flatItems.length) {
      return `<div style="text-align:center;padding:32px;color:var(--c-text-muted)">
        <div style="font-size:40px;margin-bottom:8px">🍽️</div>
        <p>Блюда для этой недели ещё не добавлены</p>
      </div>`;
    }

    const sortedDays = [...new Set(slottedItems.map(i => i.day_of_week))].sort((a,b)=>a-b);
    const sortedMeals = MEAL_ORDER.filter(m => slottedItems.some(i => i.meal_type === m));

    let html = '';

    if (slottedItems.length) {
      html += `<div class="meal-grid">`;
      // Header row
      html += `<div class="meal-grid-header">
        <div class="meal-grid-corner"></div>
        ${sortedMeals.map(m => `<div class="meal-grid-meal-label">${MEAL_LABELS[m] || m}</div>`).join('')}
      </div>`;

      for (const day of sortedDays) {
        html += `<div class="meal-grid-row">
          <div class="meal-grid-day-label">${DAY_LABELS[(day - 1) % 7]}</div>`;
        for (const meal of sortedMeals) {
          const cellItems = (grid[day] && grid[day][meal]) || [];
          html += `<div class="meal-grid-cell">`;
          if (cellItems.length) {
            html += cellItems.map(item => renderSlotCard(item, isClosed)).join('');
          } else {
            html += `<div class="meal-grid-empty">—</div>`;
          }
          html += `</div>`;
        }
        html += `</div>`;
      }
      html += `</div>`;
    }

    if (flatItems.length) {
      html += `<div style="margin-top:16px">
        <h4 style="color:var(--c-text-muted);font-size:13px;margin-bottom:8px">Без расписания</h4>
        ${flatItems.map(item => renderMenuItemRow(item, isClosed)).join('')}
      </div>`;
    }

    return html;
  }

  function renderSlotCard(item, isClosed) {
    const checkClass = item.is_cooked ? 'checked' : '';
    const cardClass = item.is_cooked ? 'cooked' : '';
    const removeBtn = !isClosed
      ? `<button class="slot-remove-btn" onclick="MenuPage.removeItem(event,${item.id})" title="Убрать">✕</button>`
      : '';

    // Build content: either shared recipe or per-member assignments
    let bodyHtml = '';
    if (item.recipe) {
      bodyHtml = `<div class="slot-recipe-title">${item.recipe.title}</div>`;
      if (item.recipe.kbju_calculated) {
        bodyHtml += `<div class="slot-meta">${item.recipe.calories?.toFixed(0)} ккал</div>`;
      }
    }

    if (item.member_assignments && item.member_assignments.length) {
      bodyHtml = item.member_assignments.map(asn => {
        const member = allMembers.find(m => m.id === asn.member_id);
        const color = member ? member.color : '#999';
        const name = member ? member.name : `#${asn.member_id}`;
        const recipeName = asn.recipe ? asn.recipe.title : '—';
        return `<div class="slot-member-row">
          <span class="slot-member-dot" style="background:${color}"></span>
          <span class="slot-member-name">${name}:</span>
          <span class="slot-recipe-title">${recipeName}</span>
        </div>`;
      }).join('');
    }

    const quickActions = (!isClosed && allMembers.length)
      ? `<div class="slot-quick-actions">
          <button class="slot-quick-btn" onclick="MenuPage.makeSameForAll(event, ${item.id})">👥 Одинаковое всем</button>
          <button class="slot-quick-btn" onclick="MenuPage.makeDifferentForAll(event, ${item.id})">🧩 Разные блюда</button>
        </div>`
      : '';

    return `
      <div class="slot-card ${cardClass}" id="menu-item-${item.id}">
        <div class="slot-card-check ${checkClass}" onclick="MenuPage.toggleCooked(${item.id}, ${!item.is_cooked})">
          ${item.is_cooked ? '✓' : ''}
        </div>
        <div class="slot-card-body">${bodyHtml || '<span style="color:var(--c-text-muted)">—</span>'}${quickActions}</div>
        ${removeBtn}
      </div>`;
  }

  // ── Flat list row (non-slot mode) ──────────────────────────────────────────
  function renderMenuItemRow(item, isClosed) {
    const r = item.recipe;
    const kbju = r && r.kbju_calculated
      ? `<span class="menu-item-kbju">${r.calories?.toFixed(0)} ккал</span>`
      : '';

    const mealLabel = item.meal_type
      ? `<span class="badge" style="background:var(--c-surface2);color:var(--c-text-muted)">${MEAL_LABELS[item.meal_type] || item.meal_type}</span>`
      : '';

    const dayLabel = item.day_of_week
      ? `<span class="badge" style="background:var(--c-surface2);color:var(--c-text-muted)">${DAY_LABELS[(item.day_of_week-1)%7]}</span>`
      : '';

    const preparedServings = r ? (preparedByRecipeId[r.id] || 0) : 0;
    const preparedBadge = preparedServings > 0
      ? `<span class="badge" style="background:#eef7ff;color:#2b5a9a">🍱 Заготовка: ${preparedServings} порц.</span>`
      : '';

    const stockHint = r && r.shopping_list
      ? (() => {
          const tokens = r.shopping_list.split('\n').map(l => l.trim().toLowerCase().split(' ')[0]).filter(Boolean);
          const matched = tokens.filter(t => stockNames.has(t));
          return matched.length ? `<span class="badge" style="background:#f0fff8;color:#1f7d4f">✅ На складе: ${matched.length} поз.</span>` : '';
        })()
      : '';

    // Per-member assignment badges
    let memberBadges = '';
    if (item.member_assignments && item.member_assignments.length) {
      memberBadges = item.member_assignments.map(asn => {
        const member = allMembers.find(m => m.id === asn.member_id);
        const color = member ? member.color : '#999';
        const name = member ? member.name : `#${asn.member_id}`;
        const recipeName = asn.recipe ? asn.recipe.title : '—';
        return `<span class="badge" style="background:${color}20;color:${color};border:1px solid ${color}40">
          ${name}: ${recipeName}</span>`;
      }).join('');
    }

    const checkClass = item.is_cooked ? 'checked' : '';
    const rowClass = item.is_cooked ? 'cooked' : '';
    const removeBtn = !isClosed
      ? `<button class="btn btn-sm" style="padding:6px 10px;background:var(--c-surface2);border:none;cursor:pointer;border-radius:8px" onclick="MenuPage.removeItem(event, ${item.id})" title="Убрать">✕</button>`
      : '';

    const title = r ? r.title : (item.member_assignments?.length ? 'Разные блюда' : 'Удалённый рецепт');

    return `
      <div class="menu-item-row ${rowClass}" id="menu-item-${item.id}">
        <div class="menu-item-check ${checkClass}" onclick="MenuPage.toggleCooked(${item.id}, ${!item.is_cooked})">${item.is_cooked ? '✓' : ''}</div>
        <div style="flex:1">
          <div class="menu-item-title">${title}</div>
          <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap">
            ${dayLabel}${mealLabel}
            ${r ? `<span class="menu-item-meta">${App.cookingMethodLabel(r.cooking_method)} · ${r.servings} порц.</span>` : ''}
            ${kbju}${preparedBadge}${stockHint}
            ${memberBadges}
          </div>
        </div>
        ${removeBtn}
      </div>`;
  }

  // ── Add-item panel ─────────────────────────────────────────────────────────
  function renderAddPanel(usesSlots) {
    const mealSelector = `
      <div class="form-row" style="gap:8px;margin-bottom:12px">
        <div class="form-group" style="flex:1">
          <label class="form-label">День</label>
          <select class="form-control" id="add-item-day" onchange="MenuPage.setAddDay(this.value)">
            <option value="">— без дня —</option>
            ${DAY_LABELS.map((d, i) => `<option value="${i+1}">${d}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">Приём пищи</label>
          <select class="form-control" id="add-item-meal" onchange="MenuPage.setAddMeal(this.value)">
            <option value="">— без приёма —</option>
            <option value="breakfast">🌅 Завтрак</option>
            <option value="lunch">☀️ Обед</option>
            <option value="dinner">🌙 Ужин</option>
          </select>
        </div>
      </div>`;

    const memberSection = allMembers.length ? `
      <div style="margin-bottom:12px">
        <div style="font-size:13px;font-weight:600;color:var(--c-text-muted);margin-bottom:6px">
          Назначение по членам семьи (необязательно)
        </div>
        <div id="member-assignment-rows">
          ${renderMemberAssignmentRows()}
        </div>
        <div style="font-size:12px;color:var(--c-text-muted);margin-top:4px">
          Если не указано — рецепт из списка ниже добавляется для всей семьи
        </div>
      </div>` : '';

    const listHtml = allRecipes.map(r => `
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
        ${mealSelector}
        ${memberSection}
        <div style="margin-bottom:8px;display:flex;gap:8px;align-items:center">
          <span style="font-size:13px;color:var(--c-text-muted)">Общее блюдо для всей семьи:</span>
          ${allMembers.length ? `<button class="btn btn-sm" onclick="MenuPage.addItemNoRecipe()" style="font-size:12px">+ Добавить только назначения выше</button>` : ''}
        </div>
        <input type="text" class="search-input" placeholder="🔍 Фильтр рецептов..." oninput="MenuPage.filterPicker(this.value)" style="margin-bottom:12px"/>
        <div class="recipe-picker-list" id="recipe-picker-list">${listHtml}</div>
      </div>`;
  }

  function renderMemberAssignmentRows() {
    return allMembers.map(m => {
      const assignedRecipeId = pendingAssignments[m.id];
      const assignedRecipe = assignedRecipeId ? allRecipes.find(r => r.id === assignedRecipeId) : null;
      return `
        <div class="member-assignment-row" style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span class="member-dot" style="background:${m.color};width:10px;height:10px;border-radius:50%;flex-shrink:0"></span>
          <span style="font-size:13px;min-width:80px">${m.name}</span>
          <select class="form-control" style="flex:1;font-size:13px" onchange="MenuPage.setMemberAssignment(${m.id}, this.value)">
            <option value="">— как у всех —</option>
            ${allRecipes.map(r => `<option value="${r.id}" ${assignedRecipeId === r.id ? 'selected' : ''}>${r.title}</option>`).join('')}
          </select>
        </div>`;
    }).join('');
  }

  function setMemberAssignment(memberId, recipeIdStr) {
    if (recipeIdStr) {
      pendingAssignments[memberId] = parseInt(recipeIdStr);
    } else {
      delete pendingAssignments[memberId];
    }
  }

  function setAddDay(val) {
    addItemDay = val ? parseInt(val) : null;
  }

  function setAddMeal(val) {
    addItemMealType = val || null;
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
    const map = { boiling:'🍲', frying:'🍳', dry_frying:'🥘', stewing:'♨️', air_fryer:'🌀', baking:'🥧', raw:'🥗' };
    return map[m] || '🍽️';
  }

  function setWeek(w) {
    currentWeek = w;
    render();
  }

  // Build member_assignments array from pendingAssignments map
  function buildAssignments() {
    return Object.entries(pendingAssignments)
      .map(([mid, rid]) => ({ member_id: parseInt(mid), recipe_id: rid }));
  }

  async function addItemNoRecipe() {
    // Add a slot with per-member assignments but no shared recipe
    const assignments = buildAssignments();
    if (!assignments.length) { App.toast('Назначьте рецепты хотя бы одному члену семьи', 'error'); return; }
    if (!activeMenu) return;
    try {
      activeMenu = await API.addMenuItem(activeMenu.id, {
        recipe_id: null,
        week_number: currentWeek,
        day_of_week: addItemDay,
        meal_type: addItemMealType,
        member_assignments: assignments,
      });
      pendingAssignments = {};
      render();
      App.toast('Блюда добавлены в меню', 'success');
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    }
  }

  async function addItem(recipeId) {
    if (!activeMenu) return;
    const assignments = buildAssignments();
    try {
      activeMenu = await API.addMenuItem(activeMenu.id, {
        recipe_id: recipeId,
        week_number: currentWeek,
        day_of_week: addItemDay,
        meal_type: addItemMealType,
        member_assignments: assignments,
      });
      pendingAssignments = {};
      render();
      App.toast('Блюдо добавлено в меню', 'success');
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    }
  }

  async function makeSameForAll(e, itemId) {
    e?.stopPropagation?.();
    if (!activeMenu || !allMembers.length) return;

    const confirmed = await confirmQuickAction('Назначить одинаковое блюдо всем членам семьи в этом слоте?');
    if (!confirmed) return;

    const item = (activeMenu.items || []).find(i => i.id === itemId);
    let recipeId = item?.recipe_id || item?.recipe?.id;
    if (!recipeId && item?.member_assignments?.length) {
      recipeId = item.member_assignments[0].recipe_id;
    }
    if (!recipeId) {
      App.toast('Нет базового блюда для копирования', 'error');
      return;
    }

    const assignments = allMembers.map(m => ({ member_id: m.id, recipe_id: recipeId }));
    try {
      activeMenu = await API.setItemAssignments(activeMenu.id, itemId, assignments);
      render();
      App.toast('Назначено одинаковое блюдо всем', 'success');
    } catch (err) {
      App.toast('Ошибка: ' + err.message, 'error');
    }
  }

  async function makeDifferentForAll(e, itemId) {
    e?.stopPropagation?.();
    if (!activeMenu || !allMembers.length) return;
    if (!allRecipes.length) {
      App.toast('Нет рецептов для назначения', 'error');
      return;
    }

    const confirmed = await confirmQuickAction('Подобрать разные блюда для каждого члена семьи в этом слоте? Текущие назначения будут перезаписаны.');
    if (!confirmed) return;

    // Pick distinct recipes: preferred first, then any available
    const used = new Set();
    const assignments = [];
    for (const member of allMembers) {
      let chosenId = null;
      const preferredIds = Array.isArray(member.preferred_recipe_ids) ? member.preferred_recipe_ids : [];

      for (const rid of preferredIds) {
        if (!used.has(rid) && allRecipes.some(r => r.id === rid)) {
          chosenId = rid;
          break;
        }
      }

      if (!chosenId) {
        const freeRecipe = allRecipes.find(r => !used.has(r.id));
        if (freeRecipe) chosenId = freeRecipe.id;
      }
      if (!chosenId) chosenId = allRecipes[0]?.id;
      if (!chosenId) continue;

      used.add(chosenId);
      assignments.push({ member_id: member.id, recipe_id: chosenId });
    }

    if (!assignments.length) {
      App.toast('Не удалось подобрать разные блюда', 'error');
      return;
    }

    try {
      activeMenu = await API.setItemAssignments(activeMenu.id, itemId, assignments);
      render();
      App.toast('Назначены разные блюда по членам семьи', 'success');
    } catch (err) {
      App.toast('Ошибка: ' + err.message, 'error');
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

  function openAutoFill() {
    const months = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
    const now = new Date();
    document.getElementById('auto-menu-title').value = `Меню на ${months[now.getMonth()]}`;
    document.getElementById('auto-menu-weeks').value = '1';
    document.getElementById('auto-recipes-per-week').value = '5';
    document.getElementById('auto-use-meal-slots').checked = false;
    document.getElementById('auto-meal-slots-options').style.display = 'none';
    const flat = document.getElementById('flat-mode-options');
    if (flat) flat.style.display = 'block';
    document.getElementById('modal-auto-fill').classList.add('open');
  }

  function closeAutoFill() {
    document.getElementById('modal-auto-fill').classList.remove('open');
  }

  function toggleMealSlotsOptions() {
    const checked = document.getElementById('auto-use-meal-slots').checked;
    document.getElementById('auto-meal-slots-options').style.display = checked ? 'block' : 'none';
    const flat = document.getElementById('flat-mode-options');
    if (flat) flat.style.display = checked ? 'none' : 'block';
  }

  async function createAutoMenu() {
    const title = document.getElementById('auto-menu-title').value.trim();
    const weeks = parseInt(document.getElementById('auto-menu-weeks').value);
    const useMealSlots = document.getElementById('auto-use-meal-slots').checked;
    const recipesPerWeek = useMealSlots ? 1 : parseInt(document.getElementById('auto-recipes-per-week').value);

    // Collect selected meals and days
    const meals = [];
    ['breakfast','lunch','dinner'].forEach(m => {
      const el = document.getElementById(`auto-meal-${m}`);
      if (!el || el.checked) meals.push(m);
    });
    const days = [];
    for (let d = 1; d <= 7; d++) {
      const el = document.getElementById(`auto-day-${d}`);
      if (!el || el.checked) days.push(d);
    }

    if (!title) { App.toast('Введите название меню', 'error'); return; }
    if (!useMealSlots && (isNaN(recipesPerWeek) || recipesPerWeek < 1 || recipesPerWeek > 21)) {
      App.toast('Укажите от 1 до 21 блюда в неделю', 'error'); return;
    }

    const btn = document.querySelector('#modal-auto-fill .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Подбираю...'; }

    try {
      const menu = await API.createMenu({ title, weeks });
      let added = 0;
      try {
        const payload = { use_meal_slots: useMealSlots, days, meals };
        if (!useMealSlots) payload.recipes_per_week = recipesPerWeek;
        const result = await API.autoFillMenu(menu.id, payload);
        added = result.added || 0;
      } catch (fillErr) {
        App.toast('Меню создано, но авто-подбор не удался: ' + fillErr.message, 'error');
      }
      closeAutoFill();
      currentWeek = 1;
      await load();
      App.toast(added > 0 ? `Готово! Добавлено ${added} блюд в меню` : 'Меню создано, блюда не добавлены', added > 0 ? 'success' : 'info');
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🎲 Подобрать меню'; }
    }
  }

  return {
    load, setWeek, addItem, addItemNoRecipe, toggleCooked, removeItem, confirmClose,
    openShoppingList, openCreate, closeCreate, createMenu,
    openAutoFill, closeAutoFill, createAutoMenu, toggleMealSlotsOptions,
    filterPicker, setAddDay, setAddMeal, setMemberAssignment,
    makeSameForAll, makeDifferentForAll,
  };
})();
