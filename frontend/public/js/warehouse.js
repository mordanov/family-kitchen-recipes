/**
 * Warehouse page: stock items, prepared dishes, and receipt drafts.
 */
const WarehousePage = (() => {
  let recipes = [];
  let drafts = [];          // cached for modal access without re-fetch
  let currentDraftId = null; // draft open in the modal right now

  async function load() {
    const content = document.getElementById('warehouse-content');
    content.innerHTML = '<div class="spinner"></div>';
    try {
      const [stock, prepared, recipeList, draftList] = await Promise.all([
        API.listStock(),
        API.listPrepared(),
        API.listRecipes(),
        API.listDrafts(),
      ]);
      recipes = recipeList;
      drafts = draftList;
      render(stock, prepared, draftList);
    } catch (e) {
      content.innerHTML = `<p style="color:var(--c-danger)">Ошибка загрузки: ${e.message}</p>`;
    }
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  function render(stock, prepared, draftList) {
    const content = document.getElementById('warehouse-content');
    content.innerHTML = `
      ${draftList.length ? renderDraftsZone(draftList) : ''}

      <div class="warehouse-grid">
        <section class="warehouse-section">
          <div class="warehouse-section-header">
            <h3>🥦 В наличии</h3>
            <button class="btn btn-primary btn-sm js-open-stock">+ Добавить</button>
          </div>
          ${renderStockList(stock)}
        </section>

        <section class="warehouse-section">
          <div class="warehouse-section-header">
            <h3>🍱 Заготовки</h3>
            <button class="btn btn-primary btn-sm js-open-prepared">+ Добавить</button>
          </div>
          ${renderPreparedList(prepared)}
        </section>
      </div>

      <div class="modal-backdrop" id="stock-modal">
        <div class="modal" style="max-width:460px">
          <div class="modal-header">
            <h2 id="stock-modal-title">Добавить продукт</h2>
            <button class="modal-close js-close-stock">✕</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="stock-id" />
            <div class="form-group">
              <label class="form-label">Продукт</label>
              <input class="form-control" id="stock-name" maxlength="200" placeholder="Капуста" />
            </div>
            <div class="form-group">
              <label class="form-label">Количество</label>
              <input class="form-control" id="stock-quantity" maxlength="100" placeholder="400 г / 2 шт / 1 кг" />
            </div>
            <div class="form-group">
              <label class="form-label">Дата</label>
              <input type="date" class="form-control" id="stock-added-on" value="${todayIso()}" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary js-close-stock">Отмена</button>
            <button class="btn btn-primary js-save-stock">Сохранить</button>
          </div>
        </div>
      </div>

      <div class="modal-backdrop" id="prepared-modal">
        <div class="modal" style="max-width:460px">
          <div class="modal-header">
            <h2 id="prepared-modal-title">Добавить заготовку</h2>
            <button class="modal-close js-close-prepared">✕</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="prepared-id" />
            <div class="form-group">
              <label class="form-label">Рецепт</label>
              <select class="form-control" id="prepared-recipe-id">
                <option value="">-- Выберите рецепт --</option>
                ${recipes.map(r => `<option value="${r.id}">${r.title}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Количество порций</label>
              <input type="number" class="form-control" id="prepared-servings" min="0.5" step="0.5" value="1" />
            </div>
            <div class="form-group">
              <label class="form-label">Заметка</label>
              <input class="form-control" id="prepared-note" maxlength="500" placeholder="Морозилка / холодильник" />
            </div>
            <div class="form-group">
              <label class="form-label">Дата</label>
              <input type="date" class="form-control" id="prepared-added-on" value="${todayIso()}" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary js-close-prepared">Отмена</button>
            <button class="btn btn-primary js-save-prepared">Сохранить</button>
          </div>
        </div>
      </div>

      <div class="modal-backdrop" id="draft-modal">
        <div class="modal" style="max-width:520px">
          <div class="modal-header">
            <h2 id="draft-modal-title">Чек</h2>
            <button class="modal-close js-close-draft">✕</button>
          </div>
          <div class="modal-body">
            <div id="draft-modal-items"></div>
            <button class="btn btn-secondary btn-sm js-add-draft-row" style="margin-top:10px">+ Добавить позицию</button>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary warehouse-delete-btn js-discard-draft-modal">Удалить черновик</button>
            <button class="btn btn-primary js-commit-draft-modal">Применить</button>
          </div>
        </div>
      </div>
    `;

    bindStaticActions(content);
    bindRowActions(content);
  }

  // ── Draft zone (compact list) ────────────────────────────────────────────────

  function renderDraftsZone(draftList) {
    return `
      <div class="draft-zone">
        <div class="draft-zone-header">📋 Черновики чеков (${draftList.length})</div>
        <div class="draft-list">
          ${draftList.map(d => renderDraftRow(d)).join('')}
        </div>
      </div>
    `;
  }

  function renderDraftRow(draft) {
    const dt = new Date(draft.created_at);
    const dateStr = dt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const n = draft.items.length;
    return `
      <div class="draft-list-row js-open-draft" data-draft-id="${draft.id}">
        <span class="draft-list-date">${dateStr} ${timeStr}</span>
        <span class="draft-list-count">${n} ${pluralItems(n)}</span>
        <span class="draft-list-arrow">›</span>
      </div>
    `;
  }

  function pluralItems(n) {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'позиция';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'позиции';
    return 'позиций';
  }

  // ── Draft modal ──────────────────────────────────────────────────────────────

  function openDraftModal(draft) {
    currentDraftId = draft.id;
    const dt = new Date(draft.created_at);
    const dateStr = dt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('draft-modal-title').textContent = `Чек от ${dateStr} ${timeStr}`;
    renderDraftModalItems(draft.items);
    document.getElementById('draft-modal').classList.add('open');
  }

  function closeDraftModal() {
    document.getElementById('draft-modal').classList.remove('open');
    currentDraftId = null;
  }

  function renderDraftModalItems(items) {
    const container = document.getElementById('draft-modal-items');
    container.innerHTML = items.map(item => `
      <div class="draft-item-row">
        <input class="form-control draft-item-name" value="${escAttr(item.name)}" placeholder="Продукт" />
        <input class="form-control draft-item-qty" value="${escAttr(item.quantity)}" placeholder="Кол-во" />
        <button class="btn btn-secondary btn-sm warehouse-delete-btn js-del-modal-item" title="Удалить строку">✕</button>
      </div>
    `).join('');
    _bindModalDeleteButtons(container);
  }

  function _bindModalDeleteButtons(container) {
    container.querySelectorAll('.js-del-modal-item').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.draft-item-row').remove());
    });
  }

  function addDraftModalRow() {
    const container = document.getElementById('draft-modal-items');
    const row = document.createElement('div');
    row.className = 'draft-item-row';
    row.innerHTML = `
      <input class="form-control draft-item-name" value="" placeholder="Продукт" />
      <input class="form-control draft-item-qty" value="" placeholder="Кол-во" />
      <button class="btn btn-secondary btn-sm warehouse-delete-btn js-del-modal-item" title="Удалить строку">✕</button>
    `;
    row.querySelector('.js-del-modal-item').addEventListener('click', () => row.remove());
    container.appendChild(row);
    row.querySelector('.draft-item-name').focus();
  }

  async function commitDraftFromModal() {
    try {
      const container = document.getElementById('draft-modal-items');
      const rows = container ? container.querySelectorAll('.draft-item-row') : [];
      const items = [];
      rows.forEach(row => {
        const name = (row.querySelector('.draft-item-name')?.value || '').trim();
        const quantity = (row.querySelector('.draft-item-qty')?.value || '').trim();
        if (name) items.push({ name, quantity });
      });
      if (!items.length) {
        App.toast('Нет позиций для добавления на склад', 'error');
        return;
      }
      const res = await API.commitDraft(currentDraftId, { items });
      App.toast(`Добавлено на склад: ${res.items_added} поз.`, 'success');
      closeDraftModal();
      await load();
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    }
  }

  async function discardDraftFromModal() {
    if (!confirm('Удалить черновик чека?')) return;
    try {
      await API.deleteDraft(currentDraftId);
      closeDraftModal();
      await load();
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    }
  }

  // ── Stock list ───────────────────────────────────────────────────────────────

  function renderStockList(items) {
    if (!items.length) return '<p class="text-muted">Список пуст</p>';
    return `<div class="warehouse-panel-list">${items.map(item => `
      <div class="warehouse-row">
        <div class="warehouse-row-info">
          <span class="warehouse-row-name">${item.name}</span>
          <span class="warehouse-row-qty">${item.quantity} · Добавлено: ${item.added_on || '—'}</span>
        </div>
        <div class="warehouse-row-actions">
          <button
            class="btn btn-secondary btn-sm warehouse-action-btn js-edit-stock"
            data-id="${item.id}"
            data-name="${escAttr(item.name)}"
            data-quantity="${escAttr(item.quantity)}"
            data-added-on="${escAttr(item.added_on || '')}"
          >✏️ Изменить</button>
          <button class="btn btn-secondary btn-sm warehouse-action-btn warehouse-delete-btn js-delete-stock" data-id="${item.id}">🗑️ Удалить</button>
        </div>
      </div>
    `).join('')}</div>`;
  }

  function renderPreparedList(items) {
    if (!items.length) return '<p class="text-muted">Список пуст</p>';
    return `<div class="warehouse-panel-list">${items.map(item => `
      <div class="warehouse-row">
        <div class="warehouse-row-info">
          <span class="warehouse-row-name">${item.recipe ? item.recipe.title : 'Рецепт удален'}</span>
          <span class="warehouse-row-qty">${item.servings} порц.${item.note ? ' · ' + item.note : ''} · Добавлено: ${item.added_on || '—'}</span>
        </div>
        <div class="warehouse-row-actions">
          <button
            class="btn btn-secondary btn-sm warehouse-action-btn js-edit-prepared"
            data-id="${item.id}"
            data-recipe-id="${item.recipe_id}"
            data-servings="${item.servings}"
            data-note="${escAttr(item.note || '')}"
            data-added-on="${escAttr(item.added_on || '')}"
          >✏️ Изменить</button>
          <button class="btn btn-secondary btn-sm warehouse-action-btn warehouse-delete-btn js-delete-prepared" data-id="${item.id}">🗑️ Удалить</button>
        </div>
      </div>
    `).join('')}</div>`;
  }

  function escAttr(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ── Event binding ────────────────────────────────────────────────────────────

  function bindRowActions(root) {
    root.querySelectorAll('.js-edit-stock').forEach(btn => {
      btn.addEventListener('click', () => {
        openStockModal(
          Number(btn.dataset.id),
          btn.dataset.name || '',
          btn.dataset.quantity || '',
          btn.dataset.addedOn || ''
        );
      });
    });

    root.querySelectorAll('.js-delete-stock').forEach(btn => {
      btn.addEventListener('click', () => deleteStock(Number(btn.dataset.id)));
    });

    root.querySelectorAll('.js-edit-prepared').forEach(btn => {
      btn.addEventListener('click', () => {
        openPreparedModal(
          Number(btn.dataset.id),
          Number(btn.dataset.recipeId),
          Number(btn.dataset.servings),
          btn.dataset.note || '',
          btn.dataset.addedOn || ''
        );
      });
    });

    root.querySelectorAll('.js-delete-prepared').forEach(btn => {
      btn.addEventListener('click', () => deletePrepared(Number(btn.dataset.id)));
    });

    root.querySelectorAll('.js-open-draft').forEach(row => {
      row.addEventListener('click', () => {
        const id = Number(row.dataset.draftId);
        const draft = drafts.find(d => d.id === id);
        if (draft) openDraftModal(draft);
      });
    });
  }

  function bindStaticActions(root) {
    const openStock = root.querySelector('.js-open-stock');
    if (openStock) openStock.addEventListener('click', () => openStockModal());

    const openPrepared = root.querySelector('.js-open-prepared');
    if (openPrepared) openPrepared.addEventListener('click', () => openPreparedModal());

    root.querySelectorAll('.js-close-stock').forEach(btn => btn.addEventListener('click', closeStockModal));
    root.querySelectorAll('.js-close-prepared').forEach(btn => btn.addEventListener('click', closePreparedModal));

    const saveStockBtn = root.querySelector('.js-save-stock');
    if (saveStockBtn) saveStockBtn.addEventListener('click', saveStock);

    const savePreparedBtn = root.querySelector('.js-save-prepared');
    if (savePreparedBtn) savePreparedBtn.addEventListener('click', savePrepared);

    // Draft modal
    const closeDraftBtn = root.querySelector('.js-close-draft');
    if (closeDraftBtn) closeDraftBtn.addEventListener('click', closeDraftModal);

    const addRowBtn = root.querySelector('.js-add-draft-row');
    if (addRowBtn) addRowBtn.addEventListener('click', addDraftModalRow);

    const commitBtn = root.querySelector('.js-commit-draft-modal');
    if (commitBtn) commitBtn.addEventListener('click', commitDraftFromModal);

    const discardBtn = root.querySelector('.js-discard-draft-modal');
    if (discardBtn) discardBtn.addEventListener('click', discardDraftFromModal);
  }

  // ── Stock modal ──────────────────────────────────────────────────────────────

  function openStockModal(id = null, name = '', quantity = '', addedOn = '') {
    document.getElementById('stock-modal-title').textContent = id ? 'Редактировать продукт' : 'Добавить продукт';
    document.getElementById('stock-id').value = id || '';
    document.getElementById('stock-name').value = name;
    document.getElementById('stock-quantity').value = quantity;
    document.getElementById('stock-added-on').value = addedOn || todayIso();
    document.getElementById('stock-modal').classList.add('open');
  }

  function closeStockModal() {
    document.getElementById('stock-modal').classList.remove('open');
  }

  async function saveStock() {
    const id = document.getElementById('stock-id').value;
    const name = document.getElementById('stock-name').value.trim();
    const quantity = document.getElementById('stock-quantity').value.trim();
    const addedOn = document.getElementById('stock-added-on').value || todayIso();
    if (!name || !quantity) {
      App.toast('Заполните продукт и количество', 'error');
      return;
    }
    const payload = { name, quantity, added_on: addedOn };
    try {
      if (id) await API.updateStock(id, payload);
      else await API.createStock(payload);
      closeStockModal();
      await load();
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    }
  }

  async function deleteStock(id) {
    if (!confirm('Удалить продукт из наличия?')) return;
    try {
      await API.deleteStock(id);
      await load();
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    }
  }

  // ── Prepared modal ───────────────────────────────────────────────────────────

  function openPreparedModal(id = null, recipeId = '', servings = 1, note = '', addedOn = '') {
    document.getElementById('prepared-modal-title').textContent = id ? 'Редактировать заготовку' : 'Добавить заготовку';
    document.getElementById('prepared-id').value = id || '';
    document.getElementById('prepared-recipe-id').value = recipeId || '';
    document.getElementById('prepared-servings').value = servings;
    document.getElementById('prepared-note').value = note || '';
    document.getElementById('prepared-added-on').value = addedOn || todayIso();
    document.getElementById('prepared-modal').classList.add('open');
  }

  function closePreparedModal() {
    document.getElementById('prepared-modal').classList.remove('open');
  }

  async function savePrepared() {
    const id = document.getElementById('prepared-id').value;
    const recipeId = parseInt(document.getElementById('prepared-recipe-id').value, 10);
    const servings = parseFloat(document.getElementById('prepared-servings').value);
    const note = document.getElementById('prepared-note').value.trim();
    const addedOn = document.getElementById('prepared-added-on').value || todayIso();
    if (!recipeId || !servings || servings <= 0) {
      App.toast('Выберите рецепт и укажите порции', 'error');
      return;
    }
    try {
      if (id) {
        await API.updatePrepared(id, { recipe_id: recipeId, servings, note: note || null, added_on: addedOn });
      } else {
        await API.createPrepared({ recipe_id: recipeId, servings, note: note || null, added_on: addedOn });
      }
      closePreparedModal();
      await load();
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    }
  }

  async function deletePrepared(id) {
    if (!confirm('Удалить заготовку?')) return;
    try {
      await API.deletePrepared(id);
      await load();
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    }
  }

  return {
    load,
    openStockModal, closeStockModal, saveStock, deleteStock,
    openPreparedModal, closePreparedModal, savePrepared, deletePrepared,
    openDraftModal, closeDraftModal,
  };
})();
