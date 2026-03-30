/**
 * Settings page: synonym configuration and directory management
 * (recipe categories and cooking methods).
 */
const SettingsPage = (() => {
  // ── Synonym helpers ──────────────────────────────────────────────────────────

  function mapToLines(obj) {
    return Object.entries(obj)
      .sort(([a], [b]) => a.localeCompare(b, 'ru'))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
  }

  function parseLines(text) {
    const result = {};
    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim().toLowerCase();
      if (key && value) result[key] = value;
    }
    return result;
  }

  function escHtml(text) {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  // ── Main load ────────────────────────────────────────────────────────────────

  async function load() {
    const content = document.getElementById('settings-content');
    content.innerHTML = '<div class="spinner"></div>';

    try {
      const [productRes, phraseRes, categoriesRes, methodsRes] = await Promise.all([
        API.getProductSynonyms(),
        API.getPhraseSynonyms(),
        API.getRecipeCategories(),
        API.getCookingMethods(),
      ]);

      const productText = mapToLines(productRes.aliases || {});
      const phraseText = mapToLines(phraseRes.aliases || {});
      const skipQuickConfirm = App.getSkipQuickActionConfirm();

      content.innerHTML = `
        <div class="shopping-list-block" style="max-width:900px">

          <h3 style="margin-bottom:12px">Категории блюд</h3>
          <div id="categories-list"></div>
          <div style="display:flex;gap:8px;margin-top:12px;align-items:center">
            <input class="form-control" id="new-category-name" maxlength="100" placeholder="Название категории" style="flex:1"/>
            <button class="btn btn-primary" onclick="SettingsPage.addCategory()">+ Добавить</button>
          </div>

          <h3 style="margin:32px 0 12px">Способы приготовления</h3>
          <div id="methods-list"></div>
          <div style="display:flex;gap:8px;margin-top:12px;align-items:center">
            <input class="form-control" id="new-method-emoji" maxlength="10" placeholder="Emoji" style="width:72px;flex-shrink:0"/>
            <input class="form-control" id="new-method-name" maxlength="100" placeholder="Название" style="flex:1"/>
            <button class="btn btn-primary" onclick="SettingsPage.addMethod()">+ Добавить</button>
          </div>

          <h3 style="margin:32px 0 12px">Синонимы продуктов</h3>
          <p class="text-muted" style="margin-bottom:10px">Формат: <code>алиас=канон</code>. Один алиас на строку.</p>
          <textarea id="settings-product-aliases" class="form-control" rows="8" placeholder="цуккини=кабачок&#10;томаты=помидор">${escHtml(productText)}</textarea>

          <h3 style="margin:20px 0 12px">Фразовые алиасы</h3>
          <p class="text-muted" style="margin-bottom:10px">Используйте для двух слов и выражений.</p>
          <textarea id="settings-phrase-aliases" class="form-control" rows="8" placeholder="болгарский перец=перец&#10;сладкий перец=перец">${escHtml(phraseText)}</textarea>

          <h3 style="margin:24px 0 10px">Поведение меню</h3>
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px">
            <input id="settings-skip-quick-confirm" type="checkbox" ${skipQuickConfirm ? 'checked' : ''} onchange="SettingsPage.toggleQuickConfirmSkip(this.checked)" />
            Не спрашивать подтверждение для быстрых действий в слотах меню
          </label>

          <div style="display:flex;gap:10px;margin-top:24px">
            <button class="btn btn-primary" onclick="SettingsPage.saveSynonyms()">Сохранить синонимы</button>
            <button class="btn btn-secondary" onclick="SettingsPage.load()">Перезагрузить</button>
          </div>

        </div>
      `;

      renderCategories(categoriesRes);
      renderMethods(methodsRes);

    } catch (e) {
      content.innerHTML = `<p style="color:var(--c-danger)">Ошибка загрузки настроек: ${e.message}</p>`;
    }
  }

  // ── Categories ───────────────────────────────────────────────────────────────

  function renderCategories(categories) {
    const list = document.getElementById('categories-list');
    if (!list) return;
    if (!categories.length) {
      list.innerHTML = '<p class="text-muted">Категорий пока нет</p>';
      return;
    }
    list.innerHTML = categories.map(c => categoryRowHtml(c)).join('');
    bindDirectoryRowEvents(list, 'category');
  }

  function categoryRowHtml(c) {
    return `
      <div class="directory-row" id="cat-row-${c.id}" data-id="${c.id}">
        <div class="directory-row-view">
          <span class="directory-row-name">${escHtml(c.name)}</span>
          <div class="directory-row-actions">
            <button class="btn btn-secondary btn-sm js-dir-edit" data-type="category" data-id="${c.id}" data-name="${escHtml(c.name)}">✏️</button>
            <button class="btn btn-danger btn-sm js-dir-delete" data-type="category" data-id="${c.id}" data-name="${escHtml(c.name)}">🗑️</button>
          </div>
        </div>
        <div class="directory-row-edit" style="display:none">
          <input class="form-control dir-edit-name" value="${escHtml(c.name)}" maxlength="100" style="flex:1"/>
          <button class="btn btn-primary btn-sm js-dir-save" data-type="category" data-id="${c.id}">✓</button>
          <button class="btn btn-secondary btn-sm js-dir-cancel" data-id="${c.id}">✕</button>
        </div>
      </div>`;
  }

  async function addCategory() {
    const input = document.getElementById('new-category-name');
    const name = input?.value.trim();
    if (!name) { App.toast('Введите название категории', 'error'); return; }
    try {
      await API.createRecipeCategory({ name });
      input.value = '';
      App.toast('Категория добавлена', 'success');
      await reloadDirectories();
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    }
  }

  async function saveCategory(id, name) {
    try {
      await API.updateRecipeCategory(id, { name });
      App.toast('Категория обновлена', 'success');
      await reloadDirectories();
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    }
  }

  async function deleteCategory(id, name) {
    if (!confirm(`Удалить категорию «${name}»?\nРецепты с этой категорией сохранят её до следующего редактирования.`)) return;
    try {
      await API.deleteRecipeCategory(id);
      App.toast('Категория удалена', 'success');
      await reloadDirectories();
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    }
  }

  // ── Cooking Methods ──────────────────────────────────────────────────────────

  function renderMethods(methods) {
    const list = document.getElementById('methods-list');
    if (!list) return;
    if (!methods.length) {
      list.innerHTML = '<p class="text-muted">Способов приготовления пока нет</p>';
      return;
    }
    list.innerHTML = methods.map(m => methodRowHtml(m)).join('');
    bindDirectoryRowEvents(list, 'method');
  }

  function methodRowHtml(m) {
    return `
      <div class="directory-row" id="method-row-${m.id}" data-id="${m.id}">
        <div class="directory-row-view">
          <span class="directory-row-name">${escHtml(m.emoji || '')} ${escHtml(m.name)}</span>
          <div class="directory-row-actions">
            <button class="btn btn-secondary btn-sm js-dir-edit" data-type="method" data-id="${m.id}" data-name="${escHtml(m.name)}" data-emoji="${escHtml(m.emoji || '')}">✏️</button>
            <button class="btn btn-danger btn-sm js-dir-delete" data-type="method" data-id="${m.id}" data-name="${escHtml(m.name)}">🗑️</button>
          </div>
        </div>
        <div class="directory-row-edit" style="display:none;align-items:center;gap:8px">
          <input class="form-control dir-edit-emoji" value="${escHtml(m.emoji || '')}" maxlength="10" placeholder="Emoji" style="width:72px;flex-shrink:0"/>
          <input class="form-control dir-edit-name" value="${escHtml(m.name)}" maxlength="100" style="flex:1"/>
          <button class="btn btn-primary btn-sm js-dir-save" data-type="method" data-id="${m.id}">✓</button>
          <button class="btn btn-secondary btn-sm js-dir-cancel" data-id="${m.id}">✕</button>
        </div>
      </div>`;
  }

  async function addMethod() {
    const nameInput = document.getElementById('new-method-name');
    const emojiInput = document.getElementById('new-method-emoji');
    const name = nameInput?.value.trim();
    const emoji = emojiInput?.value.trim() || null;
    if (!name) { App.toast('Введите название способа приготовления', 'error'); return; }
    try {
      await API.createCookingMethod({ name, emoji });
      nameInput.value = '';
      if (emojiInput) emojiInput.value = '';
      App.toast('Способ приготовления добавлен', 'success');
      await reloadDirectories();
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    }
  }

  async function saveMethod(id, name, emoji) {
    try {
      await API.updateCookingMethod(id, { name, emoji: emoji || null });
      App.toast('Способ приготовления обновлён', 'success');
      await reloadDirectories();
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    }
  }

  async function deleteMethod(id, name) {
    if (!confirm(`Удалить способ приготовления «${name}»?\nРецепты с этим способом сохранят его до следующего редактирования.`)) return;
    try {
      await API.deleteCookingMethod(id);
      App.toast('Способ приготовления удалён', 'success');
      await reloadDirectories();
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    }
  }

  // ── Shared row interaction ───────────────────────────────────────────────────

  function bindDirectoryRowEvents(root, _type) {
    root.querySelectorAll('.js-dir-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = document.getElementById(
          btn.dataset.type === 'category' ? `cat-row-${btn.dataset.id}` : `method-row-${btn.dataset.id}`
        );
        if (!row) return;
        row.querySelector('.directory-row-view').style.display = 'none';
        const editEl = row.querySelector('.directory-row-edit');
        editEl.style.display = 'flex';
        editEl.querySelector('.dir-edit-name')?.focus();
      });
    });

    root.querySelectorAll('.js-dir-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        // Find the closest directory-row ancestor
        const row = btn.closest('.directory-row');
        if (!row) return;
        row.querySelector('.directory-row-view').style.display = '';
        row.querySelector('.directory-row-edit').style.display = 'none';
      });
    });

    root.querySelectorAll('.js-dir-save').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.directory-row');
        const id = parseInt(btn.dataset.id);
        const name = row.querySelector('.dir-edit-name')?.value.trim();
        if (!name) { App.toast('Название не может быть пустым', 'error'); return; }
        if (btn.dataset.type === 'category') {
          saveCategory(id, name);
        } else {
          const emoji = row.querySelector('.dir-edit-emoji')?.value.trim() || null;
          saveMethod(id, name, emoji);
        }
      });
    });

    root.querySelectorAll('.js-dir-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        const name = btn.dataset.name;
        if (btn.dataset.type === 'category') deleteCategory(id, name);
        else deleteMethod(id, name);
      });
    });
  }

  async function reloadDirectories() {
    const [categoriesRes, methodsRes] = await Promise.all([
      API.getRecipeCategories(),
      API.getCookingMethods(),
    ]);
    renderCategories(categoriesRes);
    renderMethods(methodsRes);
    // Also refresh the recipe form pickers if they're loaded
    if (typeof RecipesPage !== 'undefined') {
      RecipesPage.reloadDirectories?.();
    }
  }

  // ── Synonyms ─────────────────────────────────────────────────────────────────

  async function saveSynonyms() {
    try {
      const productAliases = parseLines(document.getElementById('settings-product-aliases').value);
      const phraseAliases = parseLines(document.getElementById('settings-phrase-aliases').value);

      await Promise.all([
        API.setProductSynonyms(productAliases),
        API.setPhraseSynonyms(phraseAliases),
      ]);

      App.toast('Настройки синонимов сохранены', 'success');
    } catch (e) {
      App.toast('Ошибка сохранения: ' + e.message, 'error');
    }
  }

  function toggleQuickConfirmSkip(checked) {
    App.setSkipQuickActionConfirm(!!checked);
    App.toast(checked ? 'Подтверждение быстрых действий отключено' : 'Подтверждение быстрых действий включено', 'success');
  }

  return { load, saveSynonyms, toggleQuickConfirmSkip, addCategory, addMethod };
})();
