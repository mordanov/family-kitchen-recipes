import React, { useEffect, useMemo, useState } from 'react'

import { api } from '../api'
import { EmptyState, PageHeader, Spinner } from '../components'

export function ShoppingPage({ active, toast, navigate }) {
  const [loading, setLoading] = useState(false)
  const [menu, setMenu] = useState(null)
  const [shopping, setShopping] = useState(null)
  const [checked, setChecked] = useState({})

  useEffect(() => {
    if (!active) return
    load()
  }, [active])

  async function load() {
    setLoading(true)
    try {
      const activeMenu = await api.getActiveMenu().catch(() => null)
      setMenu(activeMenu)
      if (!activeMenu) {
        setShopping(null)
        return
      }
      const data = await api.getShoppingList(activeMenu.id)
      setShopping(data)
    } catch (error) {
      toast(`Ошибка загрузки: ${error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  function print() {
    const content = document.getElementById('shopping-printable')?.innerHTML
    if (!content) return
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Список покупок</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h3{font-size:18px;margin-bottom:16px}h4{font-size:16px;margin-bottom:8px;margin-top:20px;border-bottom:1px solid #ddd;padding-bottom:4px}pre{white-space:pre-wrap;font-size:14px;line-height:1.8}hr{border:none;border-top:1px solid #eee;margin:16px 0}ul{list-style:none;padding:0;margin:0}li label{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #eee;font-size:14px}input[type=checkbox]{width:16px;height:16px;flex-shrink:0}details summary{display:none}</style></head><body>${content}</body></html>`)
    win.document.close()
    win.print()
  }

  const toBuyItems = useMemo(() => (shopping?.to_buy_list || shopping?.combined_list || '').split('\n').map((line) => line.trim()).filter(Boolean), [shopping])
  const inStockItems = useMemo(() => (shopping?.in_stock_list || '').split('\n').map((line) => line.trim()).filter(Boolean), [shopping])
  const preparedItems = Array.isArray(shopping?.prepared_items) ? shopping.prepared_items : []
  const shoppingEntries = Object.entries(shopping?.shopping_lists || {})

  return (
    <div className={`page ${active ? 'active' : ''}`}>
      <PageHeader title="Список" accent="покупок" />

      {loading ? <Spinner /> : null}
      {!loading && !menu ? (
        <EmptyState
          emoji="🛒"
          title="Нет активного меню"
          description="Создайте меню и добавьте блюда — здесь появится список покупок"
          actions={<button className="btn btn-primary" onClick={() => navigate('menu')}>Перейти к меню</button>}
        />
      ) : null}
      {!loading && menu && !shoppingEntries.length ? (
        <EmptyState
          emoji="🎉"
          title="Всё готово!"
          description="Все блюда уже отмечены как приготовленные, или нет непросмотренных блюд"
        />
      ) : null}

      {!loading && menu && shoppingEntries.length ? (
        <>
          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <p style={{ fontSize: 15, color: 'var(--c-text-muted)' }}>Непросмотренные блюда меню <strong>{shopping.menu_title}</strong></p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={async () => { await load(); toast('Список покупок обновлён', 'success') }}>↻ Обновить</button>
              <button className="btn btn-secondary" onClick={print}>🖨️ Распечатать</button>
            </div>
          </div>
          <div id="shopping-printable">
            <div className="shopping-list-block" style={{ marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 10 }}>🛒 Купить</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {toBuyItems.length ? toBuyItems.map((item) => (
                  <li key={item} className="shopping-combined-item">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid var(--c-surface2)', opacity: checked[item] ? 0.4 : 1 }}>
                      <input type="checkbox" checked={Boolean(checked[item])} onChange={(event) => setChecked((prev) => ({ ...prev, [item]: event.target.checked }))} style={{ width: 18, height: 18, accentColor: 'var(--c-primary)', flexShrink: 0 }} />
                      <span>{item}</span>
                    </label>
                  </li>
                )) : <li style={{ color: 'var(--c-text-muted)' }}>Ничего покупать не нужно 🎉</li>}
              </ul>
            </div>

            {inStockItems.length ? (
              <div className="shopping-list-block" style={{ marginBottom: 20, background: '#f0fff8' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 10 }}>✅ Уже есть на складе</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {inStockItems.map((item) => <li key={item} style={{ padding: '6px 0', borderBottom: '1px solid #d8f3e5' }}>{item}</li>)}
                </ul>
              </div>
            ) : null}

            {preparedItems.length ? (
              <div className="shopping-list-block" style={{ marginBottom: 20, background: '#eef7ff' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 10 }}>🍱 Заготовки в наличии</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {preparedItems.map((item, index) => <li key={`${item.recipe_title}-${index}`} style={{ padding: '6px 0', borderBottom: '1px solid #d9e7f8' }}>{item.recipe_title || 'Рецепт'} — {item.servings} порц.{item.note ? ` · ${item.note}` : ''}</li>)}
                </ul>
              </div>
            ) : null}

            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer', fontSize: 15, color: 'var(--c-text-muted)', userSelect: 'none', padding: '8px 0' }}>📋 По блюдам</summary>
              <div className="shopping-list-block" style={{ marginTop: 16 }}>
                {shoppingEntries.map(([title, list]) => (
                  <div key={title} className="shopping-recipe">
                    <h4>📌 {title}</h4>
                    <pre>{list}</pre>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </>
      ) : null}
    </div>
  )
}

