import React, { useEffect, useMemo, useState } from 'react'

import { api } from '../api'
import { EmptyState, Modal, PageHeader, Spinner } from '../components'
import { pluralItems } from '../utils'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function WarehousePage({ active, toast }) {
  const [loading, setLoading] = useState(false)
  const [stock, setStock] = useState([])
  const [prepared, setPrepared] = useState([])
  const [recipes, setRecipes] = useState([])
  const [drafts, setDrafts] = useState([])
  const [stockModalOpen, setStockModalOpen] = useState(false)
  const [preparedModalOpen, setPreparedModalOpen] = useState(false)
  const [stockForm, setStockForm] = useState({ id: '', name: '', quantity: '', added_on: todayIso() })
  const [preparedForm, setPreparedForm] = useState({ id: '', recipe_id: '', servings: 1, note: '', added_on: todayIso() })
  const [draftForm, setDraftForm] = useState(null)

  useEffect(() => {
    if (!active) return
    load()
  }, [active])

  async function load() {
    setLoading(true)
    try {
      const [stockItems, preparedItems, recipeList, draftList] = await Promise.all([
        api.listStock(),
        api.listPrepared(),
        api.listRecipes(),
        api.listDrafts(),
      ])
      setStock(stockItems)
      setPrepared(preparedItems)
      setRecipes(recipeList)
      setDrafts(draftList)
    } catch (error) {
      toast(`Ошибка загрузки: ${error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function saveStock() {
    if (!stockForm.name.trim() || !stockForm.quantity.trim()) {
      toast('Заполните продукт и количество', 'error')
      return
    }
    try {
      const payload = { name: stockForm.name.trim(), quantity: stockForm.quantity.trim(), added_on: stockForm.added_on || todayIso() }
      if (stockForm.id) await api.updateStock(stockForm.id, payload)
      else await api.createStock(payload)
      setStockModalOpen(false)
      setStockForm({ id: '', name: '', quantity: '', added_on: todayIso() })
      await load()
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function deleteStock(id) {
    if (!window.confirm('Удалить продукт из наличия?')) return
    try {
      await api.deleteStock(id)
      await load()
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function savePrepared() {
    if (!preparedForm.recipe_id || !preparedForm.servings || Number(preparedForm.servings) <= 0) {
      toast('Выберите рецепт и укажите порции', 'error')
      return
    }
    try {
      const payload = {
        recipe_id: Number(preparedForm.recipe_id),
        servings: Number(preparedForm.servings),
        note: preparedForm.note.trim() || null,
        added_on: preparedForm.added_on || todayIso(),
      }
      if (preparedForm.id) await api.updatePrepared(preparedForm.id, payload)
      else await api.createPrepared(payload)
      setPreparedModalOpen(false)
      setPreparedForm({ id: '', recipe_id: '', servings: 1, note: '', added_on: todayIso() })
      await load()
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function deletePrepared(id) {
    if (!window.confirm('Удалить заготовку?')) return
    try {
      await api.deletePrepared(id)
      await load()
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function commitDraft() {
    const items = (draftForm?.items || []).map((item) => ({ name: item.name.trim(), quantity: item.quantity.trim() })).filter((item) => item.name)
    if (!items.length) {
      toast('Нет позиций для добавления на склад', 'error')
      return
    }
    try {
      const result = await api.commitDraft(draftForm.id, { items })
      toast(`Добавлено на склад: ${result.items_added} поз.`, 'success')
      setDraftForm(null)
      await load()
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function deleteDraft() {
    if (!draftForm) return
    if (!window.confirm('Удалить черновик чека?')) return
    try {
      await api.deleteDraft(draftForm.id)
      setDraftForm(null)
      await load()
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  const empty = useMemo(() => !stock.length && !prepared.length && !drafts.length, [stock, prepared, drafts])

  return (
    <div className={`page ${active ? 'active' : ''}`}>
      <PageHeader title="Склад" accent="продуктов" />
      {loading ? <Spinner /> : null}
      {!loading && empty ? <EmptyState emoji="🏪" title="Склад пока пуст" description="Добавьте продукты, заготовки или дождитесь новых черновиков чеков" /> : null}

      {!loading ? (
        <>
          {drafts.length ? (
            <div className="draft-zone">
              <div className="draft-zone-header">📋 Черновики чеков ({drafts.length})</div>
              <div className="draft-list">
                {drafts.map((draft) => {
                  const date = new Date(draft.created_at)
                  return (
                    <div key={draft.id} className="draft-list-row" onClick={() => setDraftForm({ ...draft, items: draft.items.map((item) => ({ ...item })) })}>
                      <span className="draft-list-date">{date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })} {date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="draft-list-count">{draft.items.length} {pluralItems(draft.items.length)}</span>
                      <span className="draft-list-arrow">›</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div className="warehouse-grid">
            <section className="warehouse-section">
              <div className="warehouse-section-header">
                <h3>🥦 В наличии</h3>
                <button className="btn btn-primary btn-sm" onClick={() => { setStockForm({ id: '', name: '', quantity: '', added_on: todayIso() }); setStockModalOpen(true) }}>+ Добавить</button>
              </div>
              {stock.length ? (
                <div className="warehouse-panel-list">
                  {stock.map((item) => (
                    <div key={item.id} className="warehouse-row">
                      <div className="warehouse-row-info">
                        <span className="warehouse-row-name">{item.name}</span>
                        <span className="warehouse-row-qty">{item.quantity} · Добавлено: {item.added_on || '—'}</span>
                      </div>
                      <div className="warehouse-row-actions">
                        <button className="btn btn-secondary btn-sm warehouse-action-btn" onClick={() => { setStockForm({ id: item.id, name: item.name, quantity: item.quantity, added_on: item.added_on || todayIso() }); setStockModalOpen(true) }}>✏️ Изменить</button>
                        <button className="btn btn-secondary btn-sm warehouse-action-btn warehouse-delete-btn" onClick={() => deleteStock(item.id)}>🗑️ Удалить</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-muted">Список пуст</p>}
            </section>

            <section className="warehouse-section">
              <div className="warehouse-section-header">
                <h3>🍱 Заготовки</h3>
                <button className="btn btn-primary btn-sm" onClick={() => { setPreparedForm({ id: '', recipe_id: '', servings: 1, note: '', added_on: todayIso() }); setPreparedModalOpen(true) }}>+ Добавить</button>
              </div>
              {prepared.length ? (
                <div className="warehouse-panel-list">
                  {prepared.map((item) => (
                    <div key={item.id} className="warehouse-row">
                      <div className="warehouse-row-info">
                        <span className="warehouse-row-name">{item.recipe ? item.recipe.title : 'Рецепт удален'}</span>
                        <span className="warehouse-row-qty">{item.servings} порц.{item.note ? ` · ${item.note}` : ''} · Добавлено: {item.added_on || '—'}</span>
                      </div>
                      <div className="warehouse-row-actions">
                        <button className="btn btn-secondary btn-sm warehouse-action-btn" onClick={() => { setPreparedForm({ id: item.id, recipe_id: item.recipe_id, servings: item.servings, note: item.note || '', added_on: item.added_on || todayIso() }); setPreparedModalOpen(true) }}>✏️ Изменить</button>
                        <button className="btn btn-secondary btn-sm warehouse-action-btn warehouse-delete-btn" onClick={() => deletePrepared(item.id)}>🗑️ Удалить</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-muted">Список пуст</p>}
            </section>
          </div>
        </>
      ) : null}

      <Modal
        open={stockModalOpen}
        title={stockForm.id ? 'Редактировать продукт' : 'Добавить продукт'}
        onClose={() => { setStockModalOpen(false); setStockForm({ id: '', name: '', quantity: '', added_on: todayIso() }) }}
        maxWidth="460px"
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => { setStockModalOpen(false); setStockForm({ id: '', name: '', quantity: '', added_on: todayIso() }) }}>Отмена</button>
            <button className="btn btn-primary" onClick={saveStock}>Сохранить</button>
          </>
        )}
      >
        <div className="form-group">
          <label className="form-label">Продукт</label>
          <input className="form-control" value={stockForm.name} onChange={(event) => setStockForm((prev) => ({ ...prev, name: event.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Количество</label>
          <input className="form-control" value={stockForm.quantity} onChange={(event) => setStockForm((prev) => ({ ...prev, quantity: event.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Дата</label>
          <input type="date" className="form-control" value={stockForm.added_on} onChange={(event) => setStockForm((prev) => ({ ...prev, added_on: event.target.value }))} />
        </div>
      </Modal>

      <Modal
        open={preparedModalOpen}
        title={preparedForm.id ? 'Редактировать заготовку' : 'Добавить заготовку'}
        onClose={() => { setPreparedModalOpen(false); setPreparedForm({ id: '', recipe_id: '', servings: 1, note: '', added_on: todayIso() }) }}
        maxWidth="460px"
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => { setPreparedModalOpen(false); setPreparedForm({ id: '', recipe_id: '', servings: 1, note: '', added_on: todayIso() }) }}>Отмена</button>
            <button className="btn btn-primary" onClick={savePrepared}>Сохранить</button>
          </>
        )}
      >
        <div className="form-group">
          <label className="form-label">Рецепт</label>
          <select className="form-control" value={preparedForm.recipe_id} onChange={(event) => setPreparedForm((prev) => ({ ...prev, recipe_id: event.target.value }))}>
            <option value="">-- Выберите рецепт --</option>
            {recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.title}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Количество порций</label>
          <input type="number" min="0.5" step="0.5" className="form-control" value={preparedForm.servings} onChange={(event) => setPreparedForm((prev) => ({ ...prev, servings: event.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Заметка</label>
          <input className="form-control" value={preparedForm.note} onChange={(event) => setPreparedForm((prev) => ({ ...prev, note: event.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Дата</label>
          <input type="date" className="form-control" value={preparedForm.added_on} onChange={(event) => setPreparedForm((prev) => ({ ...prev, added_on: event.target.value }))} />
        </div>
      </Modal>

      <Modal
        open={Boolean(draftForm)}
        title={draftForm ? `Чек от ${new Date(draftForm.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${new Date(draftForm.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : 'Чек'}
        onClose={() => setDraftForm(null)}
        maxWidth="520px"
        footer={(
          <>
            <button className="btn btn-secondary warehouse-delete-btn" onClick={deleteDraft}>Удалить черновик</button>
            <button className="btn btn-primary" onClick={commitDraft}>Применить</button>
          </>
        )}
      >
        {draftForm ? (
          <>
            <div>
              {draftForm.items.map((item, index) => (
                <div key={index} className="draft-item-row">
                  <input className="form-control draft-item-name" value={item.name} placeholder="Продукт" onChange={(event) => setDraftForm((prev) => ({ ...prev, items: prev.items.map((row, rowIndex) => rowIndex === index ? { ...row, name: event.target.value } : row) }))} />
                  <input className="form-control draft-item-qty" value={item.quantity} placeholder="Кол-во" onChange={(event) => setDraftForm((prev) => ({ ...prev, items: prev.items.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row) }))} />
                  <button className="btn btn-secondary btn-sm warehouse-delete-btn" onClick={() => setDraftForm((prev) => ({ ...prev, items: prev.items.filter((_, rowIndex) => rowIndex !== index) }))}>✕</button>
                </div>
              ))}
            </div>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={() => setDraftForm((prev) => ({ ...prev, items: [...prev.items, { name: '', quantity: '' }] }))}>+ Добавить позицию</button>
            {draftForm.ocr_text ? (
              <details className="draft-ocr-details">
                <summary className="draft-ocr-summary">Текст с чека (OCR)</summary>
                <pre className="draft-ocr-text">{draftForm.ocr_text}</pre>
              </details>
            ) : null}
          </>
        ) : null}
      </Modal>
    </div>
  )
}


