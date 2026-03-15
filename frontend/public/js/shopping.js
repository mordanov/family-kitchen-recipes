/**
 * Shopping page – shows shopping list for active menu
 */
const ShoppingPage = (() => {
  async function load() {
    const content = document.getElementById('shopping-content');
    content.innerHTML = '<div class="spinner"></div>';

    let activeMenu = null;
    try {
      activeMenu = await API.getActiveMenu();
    } catch {}

    if (!activeMenu) {
      content.innerHTML = `
        <div class="empty-state">
          <span class="emoji">🛒</span>
          <h3>Нет активного меню</h3>
          <p>Создайте меню и добавьте блюда — здесь появится список покупок</p>
          <button class="btn btn-primary" onclick="App.navigate('menu')">Перейти к меню</button>
        </div>`;
      return;
    }

    try {
      const data = await API.getShoppingList(activeMenu.id);
      const entries = Object.entries(data.shopping_lists);

      if (!entries.length) {
        content.innerHTML = `
          <div class="empty-state">
            <span class="emoji">🎉</span>
            <h3>Всё готово!</h3>
            <p>Все блюда уже отмечены как приготовленные, или нет непросмотренных блюд</p>
          </div>`;
        return;
      }

      const combinedItems = (data.combined_list || '')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

      const byDishHtml = entries.map(([title, list]) => `
        <div class="shopping-recipe">
          <h4>📌 ${title}</h4>
          <pre>${list}</pre>
        </div>`).join('<hr class="divider"/>');

      content.innerHTML = `
        <div style="margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <p style="font-size:15px;color:var(--c-text-muted)">Непросмотренные блюда меню <strong>${data.menu_title}</strong></p>
          <button class="btn btn-secondary" onclick="ShoppingPage.print()">🖨️ Распечатать</button>
        </div>

        <div id="shopping-printable">
          <div class="shopping-list-block" style="margin-bottom:24px">
            <h3 style="font-family:var(--font-display);margin-bottom:16px">🛒 Всё для покупки</h3>
            <ul style="list-style:none;padding:0;margin:0">
              ${combinedItems.map(item => `
                <li class="shopping-combined-item">
                  <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px 0;border-bottom:1px solid var(--c-surface2)">
                    <input type="checkbox" style="width:18px;height:18px;accent-color:var(--c-primary);flex-shrink:0" onchange="this.closest('label').style.opacity=this.checked?'0.4':'1'">
                    <span>${item}</span>
                  </label>
                </li>`).join('')}
            </ul>
          </div>

          <details style="margin-top:8px">
            <summary style="cursor:pointer;font-size:15px;color:var(--c-text-muted);user-select:none;padding:8px 0">
              📋 По блюдам
            </summary>
            <div class="shopping-list-block" style="margin-top:16px">
              ${byDishHtml}
            </div>
          </details>
        </div>`;
    } catch (e) {
      content.innerHTML = `<p style="color:var(--c-danger)">Ошибка загрузки: ${e.message}</p>`;
    }
  }

  function print() {
    const content = document.getElementById('shopping-printable')?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8"><title>Список покупок</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111}
        h3{font-size:18px;margin-bottom:16px}
        h4{font-size:16px;margin-bottom:8px;margin-top:20px;border-bottom:1px solid #ddd;padding-bottom:4px}
        pre{white-space:pre-wrap;font-size:14px;line-height:1.8}
        hr{border:none;border-top:1px solid #eee;margin:16px 0}
        ul{list-style:none;padding:0;margin:0}
        li label{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #eee;font-size:14px}
        input[type=checkbox]{width:16px;height:16px;flex-shrink:0}
        details summary{display:none}
      </style></head><body>${content}</body></html>`);
    win.document.close();
    win.print();
  }

  return { load, print };
})();


/**
 * History page – all menus (closed and active)
 */
const HistoryPage = (() => {
  async function load() {
    const content = document.getElementById('history-content');
    content.innerHTML = '<div class="spinner"></div>';

    try {
      const menus = await API.listMenus();
      if (!menus.length) {
        content.innerHTML = `
          <div class="empty-state">
            <span class="emoji">📚</span>
            <h3>История меню пуста</h3>
            <p>Здесь будут отображаться все созданные меню</p>
          </div>`;
        return;
      }
      content.innerHTML = `<div class="history-list">${menus.map(m => renderCard(m)).join('')}</div>`;
    } catch (e) {
      content.innerHTML = `<p style="color:var(--c-danger)">Ошибка: ${e.message}</p>`;
    }
  }

  function renderCard(m) {
    const total = m.items.length;
    const cooked = m.items.filter(i => i.is_cooked).length;
    const pct = total ? Math.round(cooked / total * 100) : 0;
    const isClosed = m.status === 'closed';

    const statusBadge = isClosed
      ? `<span class="badge" style="background:#e8e8ef;color:#6B6B80">Закрыто</span>`
      : `<span class="badge" style="background:#E8FFF2;color:#2ECC71">● Активное</span>`;

    return `
      <div class="history-card ${isClosed ? 'closed' : ''}" onclick="HistoryPage.openMenu(${m.id})">
        <div style="font-size:36px">${isClosed ? '📕' : '📖'}</div>
        <div class="history-card-info">
          <div class="history-card-title">${m.title} ${statusBadge}</div>
          <div class="history-card-meta">
            ${m.weeks} нед. · ${total} блюд · Приготовлено: ${cooked}/${total} (${pct}%)
            · Создано: ${App.formatDate(m.created_at)}
            ${m.closed_at ? ' · Закрыто: ' + App.formatDate(m.closed_at) : ''}
          </div>
          <div class="progress-bar" style="margin-top:8px">
            <div class="progress-fill" style="width:${pct}%"></div>
          </div>
        </div>
      </div>`;
  }

  async function openMenu(id) {
    try {
      const menu = await API.getMenu(id);
      showMenuDetail(menu);
    } catch (e) {
      App.toast('Ошибка: ' + e.message, 'error');
    }
  }

  function showMenuDetail(menu) {
    const total = menu.items.length;
    const cooked = menu.items.filter(i => i.is_cooked).length;

    const byWeek = {};
    for (let w = 1; w <= menu.weeks; w++) byWeek[w] = menu.items.filter(i => i.week_number === w);

    const weeksHtml = Object.entries(byWeek).map(([w, items]) => {
      if (!items.length) return '';
      return `<div style="margin-bottom:20px">
        <h4 style="font-family:var(--font-display);color:var(--c-primary);margin-bottom:12px">Неделя ${w}</h4>
        ${items.map(item => {
          const r = item.recipe;
          return `<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:${item.is_cooked ? '#F0FFF8' : 'var(--c-surface2)'};border-radius:10px;margin-bottom:6px">
            <span style="font-size:18px">${item.is_cooked ? '✅' : '⬜'}</span>
            <span style="font-weight:700;${item.is_cooked ? 'text-decoration:line-through;opacity:0.6' : ''}">${r ? r.title : 'Удалённый рецепт'}</span>
            ${r && r.kbju_calculated ? `<span style="margin-left:auto;font-size:12px;color:var(--c-primary);font-weight:700">${r.calories?.toFixed(0)} ккал</span>` : ''}
          </div>`;
        }).join('')}
      </div>`;
    }).join('');

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal" style="max-width:680px">
        <div class="modal-header">
          <h2>${menu.title}</h2>
          <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">✕</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom:20px;color:var(--c-text-muted)">
            ${menu.weeks} нед. · Создано: ${App.formatDate(menu.created_at)} · 
            Приготовлено: ${cooked}/${total}
          </p>
          ${weeksHtml || '<p style="color:var(--c-text-muted)">В меню нет блюд</p>'}
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  return { load, openMenu };
})();
