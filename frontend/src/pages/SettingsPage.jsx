import React, { useEffect, useState } from 'react'

import { api } from '../api'
import { Modal, PageHeader, Spinner } from '../components'
import { mapToLines, parseLines } from '../utils'

function DirectoryRow({ item, type, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [emoji, setEmoji] = useState(item.emoji || '')

  return (
    <div className="directory-row">
      {!editing ? (
        <div className="directory-row-view">
          <span className="directory-row-name">{type === 'method' ? `${item.emoji || ''} ${item.name}` : item.name}</span>
          <div className="directory-row-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>✏️</button>
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(item)}>🗑️</button>
          </div>
        </div>
      ) : (
        <div className="directory-row-edit" style={{ display: 'flex', alignItems: 'center' }}>
          {type === 'method' ? <input className="form-control" style={{ width: 72, flexShrink: 0 }} value={emoji} onChange={(event) => setEmoji(event.target.value)} /> : null}
          <input className="form-control dir-edit-name" style={{ flex: 1 }} value={name} onChange={(event) => setName(event.target.value)} />
          <button className="btn btn-primary btn-sm" onClick={() => onSave(item.id, name.trim(), emoji.trim())}>✓</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>✕</button>
        </div>
      )}
    </div>
  )
}

export function SettingsPage({ active, toast, quickConfirmDisabled, setQuickConfirmDisabled }) {
  const [loading, setLoading] = useState(false)
  const [productAliases, setProductAliases] = useState('')
  const [phraseAliases, setPhraseAliases] = useState('')
  const [categories, setCategories] = useState([])
  const [methods, setMethods] = useState([])
  const [directoryModal, setDirectoryModal] = useState(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newMethod, setNewMethod] = useState({ name: '', emoji: '' })

  useEffect(() => {
    if (!active) return
    load()
  }, [active])

  async function load() {
    setLoading(true)
    try {
      const [productRes, phraseRes, categoriesRes, methodsRes] = await Promise.all([
        api.getProductSynonyms(),
        api.getPhraseSynonyms(),
        api.getRecipeCategories(),
        api.getCookingMethods(),
      ])
      setProductAliases(mapToLines(productRes.aliases || {}))
      setPhraseAliases(mapToLines(phraseRes.aliases || {}))
      setCategories(categoriesRes)
      setMethods(methodsRes)
    } catch (error) {
      toast(`Ошибка загрузки настроек: ${error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function saveSynonyms() {
    try {
      await Promise.all([
        api.setProductSynonyms(parseLines(productAliases)),
        api.setPhraseSynonyms(parseLines(phraseAliases)),
      ])
      toast('Настройки синонимов сохранены', 'success')
    } catch (error) {
      toast(`Ошибка сохранения: ${error.message}`, 'error')
    }
  }

  async function addCategory() {
    if (!newCategoryName.trim()) {
      toast('Введите название категории', 'error')
      return
    }
    try {
      await api.createRecipeCategory({ name: newCategoryName.trim() })
      setNewCategoryName('')
      toast('Категория добавлена', 'success')
      await load()
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function saveCategory(id, name) {
    if (!name) {
      toast('Название не может быть пустым', 'error')
      return
    }
    try {
      await api.updateRecipeCategory(id, { name })
      toast('Категория обновлена', 'success')
      await load()
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function deleteCategory(item) {
    if (!window.confirm(`Удалить категорию «${item.name}»?\nРецепты с этой категорией сохранят её до следующего редактирования.`)) return
    try {
      await api.deleteRecipeCategory(item.id)
      toast('Категория удалена', 'success')
      await load()
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function addMethod() {
    if (!newMethod.name.trim()) {
      toast('Введите название способа приготовления', 'error')
      return
    }
    try {
      await api.createCookingMethod({ name: newMethod.name.trim(), emoji: newMethod.emoji.trim() || null })
      setNewMethod({ name: '', emoji: '' })
      toast('Способ приготовления добавлен', 'success')
      await load()
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function saveMethod(id, name, emoji) {
    if (!name) {
      toast('Название не может быть пустым', 'error')
      return
    }
    try {
      await api.updateCookingMethod(id, { name, emoji: emoji || null })
      toast('Способ приготовления обновлён', 'success')
      await load()
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function deleteMethod(item) {
    if (!window.confirm(`Удалить способ приготовления «${item.name}»?\nРецепты с этим способом сохранят его до следующего редактирования.`)) return
    try {
      await api.deleteCookingMethod(item.id)
      toast('Способ приготовления удалён', 'success')
      await load()
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  return (
    <div className={`page ${active ? 'active' : ''}`}>
      <PageHeader title="Настройки" accent="сопоставления" />
      {loading ? <Spinner /> : null}
      {!loading ? (
        <div className="shopping-list-block" style={{ maxWidth: 900 }}>
          <h3 style={{ marginBottom: 12 }}>Категории блюд</h3>
          <button className="btn btn-secondary" onClick={() => setDirectoryModal('categories')}>✏️ Редактировать категории</button>

          <h3 style={{ margin: '32px 0 12px' }}>Способы приготовления</h3>
          <button className="btn btn-secondary" onClick={() => setDirectoryModal('methods')}>✏️ Редактировать способы приготовления</button>

          <h3 style={{ margin: '32px 0 12px' }}>Синонимы продуктов</h3>
          <p className="text-muted" style={{ marginBottom: 10 }}>Формат: <code>алиас=канон</code>. Один алиас на строку.</p>
          <textarea className="form-control" rows="8" value={productAliases} onChange={(event) => setProductAliases(event.target.value)} />

          <h3 style={{ margin: '20px 0 12px' }}>Фразовые алиасы</h3>
          <p className="text-muted" style={{ marginBottom: 10 }}>Используйте для двух слов и выражений.</p>
          <textarea className="form-control" rows="8" value={phraseAliases} onChange={(event) => setPhraseAliases(event.target.value)} />

          <h3 style={{ margin: '24px 0 10px' }}>Поведение меню</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
            <input type="checkbox" checked={quickConfirmDisabled} onChange={(event) => {
              const value = event.target.checked
              setQuickConfirmDisabled(value)
              if (value) localStorage.setItem('menu.quickActions.skipConfirm', '1')
              else localStorage.removeItem('menu.quickActions.skipConfirm')
              toast(value ? 'Подтверждение быстрых действий отключено' : 'Подтверждение быстрых действий включено', 'success')
            }} />
            Не спрашивать подтверждение для быстрых действий в слотах меню
          </label>

          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button className="btn btn-primary" onClick={saveSynonyms}>Сохранить синонимы</button>
            <button className="btn btn-secondary" onClick={load}>Перезагрузить</button>
          </div>
        </div>
      ) : null}

      <Modal open={directoryModal === 'categories'} title="Категории блюд" onClose={() => setDirectoryModal(null)}>
        <div>
          {categories.length ? categories.map((category) => <DirectoryRow key={category.id} item={category} type="category" onSave={saveCategory} onDelete={deleteCategory} />) : <p className="text-muted">Категорий пока нет</p>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <input className="form-control" style={{ flex: 1 }} value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Название категории" />
          <button className="btn btn-primary" onClick={addCategory}>+ Добавить</button>
        </div>
      </Modal>

      <Modal open={directoryModal === 'methods'} title="Способы приготовления" onClose={() => setDirectoryModal(null)}>
        <div>
          {methods.length ? methods.map((method) => <DirectoryRow key={method.id} item={method} type="method" onSave={saveMethod} onDelete={deleteMethod} />) : <p className="text-muted">Способов приготовления пока нет</p>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <input className="form-control" style={{ width: 72, flexShrink: 0 }} value={newMethod.emoji} onChange={(event) => setNewMethod((prev) => ({ ...prev, emoji: event.target.value }))} placeholder="Emoji" />
          <input className="form-control" style={{ flex: 1 }} value={newMethod.name} onChange={(event) => setNewMethod((prev) => ({ ...prev, name: event.target.value }))} placeholder="Название" />
          <button className="btn btn-primary" onClick={addMethod}>+ Добавить</button>
        </div>
      </Modal>
    </div>
  )
}

