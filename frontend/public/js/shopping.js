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

      const toBuyItems = (data.to_buy_list || data.combined_list || '')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);
      const inStockItems = (data.in_stock_list || '')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

      const byDishHtml = entries.map(([title, list]) => `
        <div class="shopping-recipe">
          <h4>📌 ${title}</h4>
          <pre>${list}</pre>
        </div>`).join('<hr class="divider"/>');

      const preparedItems = Array.isArray(data.prepared_items) ? data.prepared_items : [];

      content.innerHTML = `
        <div style="margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <p style="font-size:15px;color:var(--c-text-muted)">Непросмотренные блюда меню <strong>${data.menu_title}</strong></p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-secondary js-shopping-refresh">↻ Обновить</button>
            <button class="btn btn-secondary js-shopping-print">🖨️ Распечатать</button>
          </div>
        </div>

        <div id="shopping-printable">
          <div class="shopping-list-block" style="margin-bottom:20px">
            <h3 style="font-family:var(--font-display);margin-bottom:10px">🛒 Купить</h3>
            <ul style="list-style:none;padding:0;margin:0">
              ${toBuyItems.map(item => `
                <li class="shopping-combined-item">
                  <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px 0;border-bottom:1px solid var(--c-surface2)">
                    <input type="checkbox" style="width:18px;height:18px;accent-color:var(--c-primary);flex-shrink:0" onchange="this.closest('label').style.opacity=this.checked?'0.4':'1'">
                    <span>${item}</span>
                  </label>
                </li>`).join('') || '<li style="color:var(--c-text-muted)">Ничего покупать не нужно 🎉</li>'}
            </ul>
          </div>

          ${inStockItems.length ? `
          <div class="shopping-list-block" style="margin-bottom:20px;background:#f0fff8">
            <h3 style="font-family:var(--font-display);margin-bottom:10px">✅ Уже есть на складе</h3>
            <ul style="list-style:none;padding:0;margin:0">
              ${inStockItems.map(item => `<li style="padding:6px 0;border-bottom:1px solid #d8f3e5">${item}</li>`).join('')}
            </ul>
          </div>` : ''}

          ${preparedItems.length ? `
          <div class="shopping-list-block" style="margin-bottom:20px;background:#eef7ff">
            <h3 style="font-family:var(--font-display);margin-bottom:10px">🍱 Заготовки в наличии</h3>
            <ul style="list-style:none;padding:0;margin:0">
              ${preparedItems.map(p => `<li style="padding:6px 0;border-bottom:1px solid #d9e7f8">${p.recipe_title || 'Рецепт'} — ${p.servings} порц.${p.note ? ' · ' + p.note : ''}</li>`).join('')}
            </ul>
          </div>` : ''}

          <details style="margin-top:8px">
            <summary style="cursor:pointer;font-size:15px;color:var(--c-text-muted);user-select:none;padding:8px 0">
              📋 По блюдам
            </summary>
            <div class="shopping-list-block" style="margin-top:16px">
              ${byDishHtml}
            </div>
          </details>
        </div>`;

      const refreshBtn = content.querySelector('.js-shopping-refresh');
      refreshBtn?.addEventListener('click', () => {
        refresh();
      });

      const printBtn = content.querySelector('.js-shopping-print');
      printBtn?.addEventListener('click', () => {
        print();
      });
    } catch (e) {
      content.innerHTML = `<p style="color:var(--c-danger)">Ошибка загрузки: ${e.message}</p>`;
    }
  }

  async function refresh() {
    await load();
    if (window.App?.toast) {
      App.toast('Список покупок обновлён', 'success');
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

  return { load, refresh, print };
})();


/**
 * History page – all menus (closed and active)
 */
const HistoryPage = (() => {
  const DAY_LABELS = { 1: 'Пн', 2: 'Вт', 3: 'Ср', 4: 'Чт', 5: 'Пт', 6: 'Сб', 7: 'Вс' };

  function fmt(v) {
    return Number(v || 0).toFixed(0);
  }

  function kbjuFromRecipe(recipe) {
    return {
      calories: Number(recipe?.calories || 0),
      proteins: Number(recipe?.proteins || 0),
      fats: Number(recipe?.fats || 0),
      carbs: Number(recipe?.carbs || 0),
    };
  }

  function buildKbjuMatrix(menu) {
    const members = new Map();
    const hasAssignments = (menu.items || []).some(i => Array.isArray(i.member_assignments) && i.member_assignments.length);

    // Prefer server-computed member names from summary when available.
    for (const m of menu?.kbju_summary?.by_member || []) {
      if (!members.has(m.member_id)) {
        members.set(m.member_id, {
          member_id: m.member_id,
          member_name: m.member_name || `#${m.member_id}`,
          member_color: m.member_color || '#888',
        });
      }
    }

    for (const item of menu.items || []) {
      for (const asn of item.member_assignments || []) {
        const id = asn.member_id;
        if (!members.has(id)) {
          members.set(id, {
            member_id: id,
            member_name: asn.member_name || `#${id}`,
            member_color: asn.member_color || '#888',
          });
        }
      }
    }

    if (!members.size && !hasAssignments) {
      members.set(0, { member_id: 0, member_name: 'Семья', member_color: '#6B6B80' });
    }

    const dayRows = [];
    for (let day = 1; day <= 7; day++) {
      const row = { day, cells: {} };
      for (const m of members.values()) {
        row.cells[m.member_id] = { calories: 0, proteins: 0, fats: 0, carbs: 0 };
      }
      dayRows.push(row);
    }

    for (const item of menu.items || []) {
      const day = item.day_of_week;
      if (!day || day < 1 || day > 7) continue;
      const row = dayRows[day - 1];

      if (item.member_assignments && item.member_assignments.length) {
        for (const asn of item.member_assignments) {
          if (!row.cells[asn.member_id]) {
            row.cells[asn.member_id] = { calories: 0, proteins: 0, fats: 0, carbs: 0 };
          }
          const kbju = kbjuFromRecipe(asn.recipe);
          row.cells[asn.member_id].calories += kbju.calories;
          row.cells[asn.member_id].proteins += kbju.proteins;
          row.cells[asn.member_id].fats += kbju.fats;
          row.cells[asn.member_id].carbs += kbju.carbs;
        }
      } else if (row.cells[0] && item.recipe) {
        const kbju = kbjuFromRecipe(item.recipe);
        row.cells[0].calories += kbju.calories;
        row.cells[0].proteins += kbju.proteins;
        row.cells[0].fats += kbju.fats;
        row.cells[0].carbs += kbju.carbs;
      }
    }

    return { members: Array.from(members.values()), rows: dayRows };
  }

  function renderKbjuMatrix(menu) {
    const matrix = buildKbjuMatrix(menu);
    if (!matrix.members.length) {
      return '<p style="color:var(--c-text-muted)">Нет данных КБЖУ</p>';
    }

    const th = matrix.members
      .map(m => `<th style="padding:8px;border:1px solid var(--c-border);text-align:left;white-space:nowrap;color:${m.member_color || 'var(--c-text)'}">${m.member_name}</th>`)
      .join('');

    const rows = matrix.rows.map(r => {
      const tds = matrix.members.map(m => {
        const c = r.cells[m.member_id] || { calories: 0, proteins: 0, fats: 0, carbs: 0 };
        return `<td style="padding:8px;border:1px solid var(--c-border);vertical-align:top;font-size:12px;line-height:1.45">
          К ${fmt(c.calories)}<br/>Б ${fmt(c.proteins)} · Ж ${fmt(c.fats)} · У ${fmt(c.carbs)}
        </td>`;
      }).join('');
      return `<tr>
        <td style="padding:8px;border:1px solid var(--c-border);font-weight:700">${DAY_LABELS[r.day]}</td>
        ${tds}
      </tr>`;
    }).join('');

    return `<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;min-width:620px;background:white">
      <thead>
        <tr>
          <th style="padding:8px;border:1px solid var(--c-border);text-align:left">День</th>
          ${th}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

  function renderItemLabel(item) {
    if (item.recipe) return item.recipe.title;
    if (item.member_assignments && item.member_assignments.length) {
      const namesById = new Map((item.menu_kbju_by_member || []).map(m => [m.member_id, m.member_name]));
      return item.member_assignments
        .map(asn => {
          const memberName = asn.member_name
            || namesById.get(asn.member_id)
            || `#${asn.member_id}`;
          return `${memberName}: ${asn.recipe?.title || '—'}`;
        })
        .join(' · ');
    }
    return 'Удалённый рецепт';
  }

  function renderItemKbju(item) {
    if (item.recipe && item.recipe.kbju_calculated) {
      return `${item.recipe.calories?.toFixed(0)} ккал`;
    }
    if (item.member_assignments && item.member_assignments.length) {
      const sum = item.member_assignments.reduce((acc, asn) => acc + Number(asn.recipe?.calories || 0), 0);
      return sum > 0 ? `${sum.toFixed(0)} ккал` : '';
    }
    return '';
  }

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
          <div style="margin-top:8px;color:var(--c-text-muted);font-size:12px">КБЖУ-отчёт доступен в деталях меню</div>
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
    const kbjuMatrixHtml = renderKbjuMatrix(menu);

    const byWeek = {};
    for (let w = 1; w <= menu.weeks; w++) {
      byWeek[w] = menu.items
        .filter(i => i.week_number === w)
        .map(i => ({ ...i, menu_kbju_by_member: menu?.kbju_summary?.by_member || [] }));
    }

    const weeksHtml = Object.entries(byWeek).map(([w, items]) => {
      if (!items.length) return '';
      return `<div style="margin-bottom:20px">
        <h4 style="font-family:var(--font-display);color:var(--c-primary);margin-bottom:12px">Неделя ${w}</h4>
        ${items.map(item => {
          const label = renderItemLabel(item);
          const kbju = renderItemKbju(item);
          return `<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:${item.is_cooked ? '#F0FFF8' : 'var(--c-surface2)'};border-radius:10px;margin-bottom:6px">
            <span style="font-size:18px">${item.is_cooked ? '✅' : '⬜'}</span>
            <span style="font-weight:700;${item.is_cooked ? 'text-decoration:line-through;opacity:0.6' : ''}">${label}</span>
            ${kbju ? `<span style="margin-left:auto;font-size:12px;color:var(--c-primary);font-weight:700">${kbju}</span>` : ''}
          </div>`;
        }).join('')}
      </div>`;
    }).join('');

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal" style="max-width:980px">
        <div class="modal-header">
          <h2>${menu.title}</h2>
          <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">✕</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom:20px;color:var(--c-text-muted)">
            ${menu.weeks} нед. · Создано: ${App.formatDate(menu.created_at)} · 
            Приготовлено: ${cooked}/${total}
          </p>
          <div class="shopping-list-block" style="margin-bottom:16px">
            <h4 style="margin-bottom:8px">КБЖУ по дням и членам семьи</h4>
            ${kbjuMatrixHtml}
          </div>
          ${weeksHtml || '<p style="color:var(--c-text-muted)">В меню нет блюд</p>'}
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  return { load, openMenu };
})();
