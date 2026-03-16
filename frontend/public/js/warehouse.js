/**
 * Warehouse page: stock items and prepared dishes.
 */
const WarehousePage = (() => {
  let recipes = [];

  async function load() {
    const content = document.getElementById('warehouse-content');
    content.innerHTML = '<div class="spinner"></div>';
    try {
      const [stock, prepared, recipeList] = await Promise.all([
        API.listStock(),
        API.listPrepared(),
        API.listRecipes(),
      ]);
      recipes = recipeList;
      render(stock, prepared);
    } catch (e) {
      content.innerHTML = `<p style="color:var(--c-danger)">Ошибка загрузки: ${e.message}</p>`;
    }
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function render(stock, prepared) {
    const content = document.getElementById('warehouse-content');
    content.innerHTML = `
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
    `;

    // Bind after DOM render to avoid inline onclick parsing issues.
    bindStaticActions(content);
    bindRowActions(content);
  }

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
  }

  function bindStaticActions(root) {
    const openStock = root.querySelector('.js-open-stock');
    if (openStock) openStock.addEventListener('click', () => openStockModal());

    const openPrepared = root.querySelector('.js-open-prepared');
    if (openPrepared) openPrepared.addEventListener('click', () => openPreparedModal());

    root.querySelectorAll('.js-close-stock').forEach(btn => {
      btn.addEventListener('click', closeStockModal);
    });

    root.querySelectorAll('.js-close-prepared').forEach(btn => {
      btn.addEventListener('click', closePreparedModal);
    });

    const saveStockBtn = root.querySelector('.js-save-stock');
    if (saveStockBtn) saveStockBtn.addEventListener('click', saveStock);

    const savePreparedBtn = root.querySelector('.js-save-prepared');
    if (savePreparedBtn) savePreparedBtn.addEventListener('click', savePrepared);
  }

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
    openStockModal,
    closeStockModal,
    saveStock,
    deleteStock,
    openPreparedModal,
    closePreparedModal,
    savePrepared,
    deletePrepared,
  };
})();
