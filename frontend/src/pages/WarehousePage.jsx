import React, { useEffect, useMemo, useState } from 'react'

import { api } from '../api'
import { EmptyState, PageHeader, Spinner } from '../components'
import { WarehouseDraftModal, WarehouseDraftsZone } from './warehouse/WarehouseDrafts'
import { PreparedModal, StockModal } from './warehouse/WarehouseItemModals'
import { WarehouseRows, WarehouseSection } from './warehouse/WarehouseSection'

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

  function resetStockForm() {
    setStockForm({ id: '', name: '', quantity: '', added_on: todayIso() })
  }

  function resetPreparedForm() {
    setPreparedForm({ id: '', recipe_id: '', servings: 1, note: '', added_on: todayIso() })
  }

  function updateDraftItem(index, field, value) {
    setDraftForm((prev) => ({
      ...prev,
      items: prev.items.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)),
    }))
  }

  function removeDraftItem(index) {
    setDraftForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, rowIndex) => rowIndex !== index),
    }))
  }

  const empty = useMemo(() => !stock.length && !prepared.length && !drafts.length, [stock, prepared, drafts])

  return (
    <div className={`page ${active ? 'active' : ''}`}>
      <PageHeader title="Склад" accent="продуктов" />
      {loading ? <Spinner /> : null}
      {!loading && empty ? <EmptyState emoji="🏪" title="Склад пока пуст" description="Добавьте продукты, заготовки или дождитесь новых черновиков чеков" /> : null}

      {!loading ? (
        <>
          <WarehouseDraftsZone drafts={drafts} onOpenDraft={(draft) => setDraftForm({ ...draft, items: draft.items.map((item) => ({ ...item })) })} />

          <div className="warehouse-grid">
            <WarehouseSection title="🥦 В наличии" onAdd={() => { resetStockForm(); setStockModalOpen(true) }}>
              <WarehouseRows
                items={stock}
                renderRow={(item) => (
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
                )}
              />
            </WarehouseSection>

            <WarehouseSection title="🍱 Заготовки" onAdd={() => { resetPreparedForm(); setPreparedModalOpen(true) }}>
              <WarehouseRows
                items={prepared}
                renderRow={(item) => (
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
                )}
              />
            </WarehouseSection>
          </div>
        </>
      ) : null}

      <StockModal
        open={stockModalOpen}
        form={stockForm}
        onClose={() => { setStockModalOpen(false); resetStockForm() }}
        onSave={saveStock}
        onChange={(field, value) => setStockForm((prev) => ({ ...prev, [field]: value }))}
        todayIso={todayIso}
      />

      <PreparedModal
        open={preparedModalOpen}
        form={preparedForm}
        recipes={recipes}
        onClose={() => { setPreparedModalOpen(false); resetPreparedForm() }}
        onSave={savePrepared}
        onChange={(field, value) => setPreparedForm((prev) => ({ ...prev, [field]: value }))}
        todayIso={todayIso}
      />

      <WarehouseDraftModal
        draftForm={draftForm}
        onClose={() => setDraftForm(null)}
        onDelete={deleteDraft}
        onCommit={commitDraft}
        onUpdateItem={updateDraftItem}
        onRemoveItem={removeDraftItem}
        onAddRow={() => setDraftForm((prev) => ({ ...prev, items: [...prev.items, { name: '', quantity: '' }] }))}
      />
    </div>
  )
}



