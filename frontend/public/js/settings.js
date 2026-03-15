/**
 * Settings page for warehouse matching aliases.
 */
const SettingsPage = (() => {
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
      // ignore localStorage errors
    }
  }

  async function load() {
    const content = document.getElementById('settings-content');
    content.innerHTML = '<div class="spinner"></div>';

    try {
      const [productRes, phraseRes] = await Promise.all([
        API.getProductSynonyms(),
        API.getPhraseSynonyms(),
      ]);

      const productText = mapToLines(productRes.aliases || {});
      const phraseText = mapToLines(phraseRes.aliases || {});
      const skipQuickConfirm = getSkipQuickActionConfirm();

      content.innerHTML = `
        <div class="shopping-list-block" style="max-width:900px">
          <h3 style="margin-bottom:12px">Синонимы продуктов</h3>
          <p class="text-muted" style="margin-bottom:10px">Формат: <code>алиас=канон</code>. Один алиас на строку.</p>
          <textarea id="settings-product-aliases" class="form-control" rows="8" placeholder="цуккини=кабачок\nтоматы=помидор">${escapeHtml(productText)}</textarea>

          <h3 style="margin:20px 0 12px">Фразовые алиасы</h3>
          <p class="text-muted" style="margin-bottom:10px">Используйте для двух слов и выражений.</p>
          <textarea id="settings-phrase-aliases" class="form-control" rows="8" placeholder="болгарский перец=перец\nсладкий перец=перец">${escapeHtml(phraseText)}</textarea>

          <h3 style="margin:24px 0 10px">Поведение меню</h3>
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px">
            <input id="settings-skip-quick-confirm" type="checkbox" ${skipQuickConfirm ? 'checked' : ''} onchange="SettingsPage.toggleQuickConfirmSkip(this.checked)" />
            Не спрашивать подтверждение для быстрых действий в слотах меню
          </label>

          <div style="display:flex;gap:10px;margin-top:16px">
            <button class="btn btn-primary" onclick="SettingsPage.save()">Сохранить</button>
            <button class="btn btn-secondary" onclick="SettingsPage.load()">Перезагрузить</button>
          </div>
        </div>
      `;
    } catch (e) {
      content.innerHTML = `<p style="color:var(--c-danger)">Ошибка загрузки настроек: ${e.message}</p>`;
    }
  }

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

  function escapeHtml(text) {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  async function save() {
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
    setSkipQuickActionConfirm(!!checked);
    App.toast(checked ? 'Подтверждение быстрых действий отключено' : 'Подтверждение быстрых действий включено', 'success');
  }

  return { load, save, toggleQuickConfirmSkip };
})();
