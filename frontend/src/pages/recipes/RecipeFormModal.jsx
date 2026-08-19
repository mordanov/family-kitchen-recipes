import React, { useEffect, useRef, useState } from 'react'

import { ConfirmOverlay, Modal, TimeInput } from '../../components'
import { ImageCropModal } from './ImageCropModal'
import { RecipeImageSearchModal } from './RecipeImageSearchModal'

function CategoryCombobox({ categories, selectedIds, onChange, onAddCategory }) {
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedNames = categories
    .filter((c) => selectedIds.includes(String(c.id)))
    .map((c) => c.name)

  async function handleAdd() {
    if (!newName.trim() || adding) return
    setAdding(true)
    try {
      await onAddCategory(newName.trim())
      setNewName('')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="category-combobox" ref={ref}>
      <button
        type="button"
        className="category-combobox-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="category-combobox-value">
          {selectedNames.length ? selectedNames.join(', ') : 'Выберите категории'}
        </span>
        <span className="category-combobox-arrow">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="category-combobox-dropdown">
          {categories.map((c) => {
            const id = String(c.id)
            const checked = selectedIds.includes(id)
            return (
              <label key={c.id} className="category-combobox-option">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onChange(
                    e.target.checked
                      ? [...selectedIds, id]
                      : selectedIds.filter((s) => s !== id),
                  )}
                />
                {c.name}
              </label>
            )
          })}
          <div className="category-combobox-add">
            <input
              className="form-control"
              placeholder="Новая категория..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleAdd}
              disabled={adding || !newName.trim()}
            >
              {adding ? '...' : '+ Добавить'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function RecipeFormModal({
  open,
  form,
  methods,
  categories,
  onClose,
  onSave,
  onChange,
  onImageChange,
  onDocumentChange,
  onAddCategory,
  onImageFromUrl,
}) {
  const [cropSrc, setCropSrc] = useState(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [imageSearchOpen, setImageSearchOpen] = useState(false)
  const isDirtyRef = useRef(false)

  useEffect(() => {
    if (open) isDirtyRef.current = false
  }, [open])

  function handleChange(patch) {
    isDirtyRef.current = true
    onChange(patch)
  }

  function handleClose() {
    if (isDirtyRef.current) {
      setConfirmClose(true)
    } else {
      onClose()
    }
  }

  function confirmAndClose() {
    setConfirmClose(false)
    isDirtyRef.current = false
    onClose()
  }

  function handleImageSelect(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => setCropSrc(e.target.result)
    reader.readAsDataURL(file)
    // reset so selecting the same file again still fires onChange
    event.target.value = ''
  }

  function handleCropDone(file, preview) {
    setCropSrc(null)
    handleChange({ imageFile: file, imagePreview: preview })
  }

  function openCropExisting() {
    setCropSrc(form.imagePreview)
  }

  async function handleImageSearchSelect(url) {
    setImageSearchOpen(false)
    if (form.id) {
      await onImageFromUrl(url)
    } else {
      handleChange({ imagePreview: url, imageUrl: url })
    }
  }

  return (
    <>
      <Modal
        open={open}
        title={form.id ? 'Редактировать рецепт' : 'Новый рецепт'}
        onClose={handleClose}
        footer={(
          <>
            <button className="btn btn-secondary" onClick={handleClose}>Отмена</button>
            <button className="btn btn-primary" onClick={onSave}>{form.id ? 'Обновить' : 'Сохранить'}</button>
          </>
        )}
      >
        <div className="form-group">
          <label className="form-label">Название блюда *</label>
          <input className="form-control" value={form.title} onChange={(event) => handleChange({ title: event.target.value })} />
        </div>

        <div className="form-group">
          <label className="form-label">Категория блюда *</label>
          <CategoryCombobox
            categories={categories}
            selectedIds={form.categories}
            onChange={(ids) => handleChange({ categories: ids })}
            onAddCategory={onAddCategory}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Способ приготовления</label>
            <select className="form-control" value={form.cooking_method} onChange={(event) => handleChange({ cooking_method: event.target.value })}>
              {methods.map((method) => (
                <option key={method.id} value={method.id}>{`${method.emoji || ''} ${method.name}`.trim()}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Количество порций</label>
            <input type="number" min="1" max="50" className="form-control" value={form.servings} onChange={(event) => handleChange({ servings: event.target.value })} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Активное время приготовления</label>
            <TimeInput value={form.active_cooking_time_minutes} onChange={(v) => handleChange({ active_cooking_time_minutes: v })} />
          </div>
          <div className="form-group">
            <label className="form-label">Общее время приготовления</label>
            <TimeInput value={form.cooking_time_minutes} onChange={(v) => handleChange({ cooking_time_minutes: v })} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Заготовка для морозильной камеры</label>
          <div className="checkbox-group">
            <label className="checkbox-option">
              <input type="checkbox" checked={form.freezer_friendly} onChange={() => handleChange({ freezer_friendly: true })} /> Да
            </label>
            <label className="checkbox-option">
              <input type="checkbox" checked={!form.freezer_friendly} onChange={() => handleChange({ freezer_friendly: false })} /> Нет
            </label>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Ингредиенты для готовки</label>
          <textarea className="form-control" rows="5" value={form.ingredients} onChange={(event) => handleChange({ ingredients: event.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Рецепт</label>
          <textarea className="form-control" rows="5" value={form.recipe} onChange={(event) => handleChange({ recipe: event.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Закупочный список</label>
          <textarea className="form-control" rows="4" value={form.shopping_list} onChange={(event) => handleChange({ shopping_list: event.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Дополнительная информация</label>
          <textarea className="form-control" rows="3" value={form.extra_info} onChange={(event) => handleChange({ extra_info: event.target.value })} />
        </div>

        <div className="form-group">
          <label className="form-label">Фото блюда</label>
          {form.imagePreview ? (
            <div className="image-edit-wrap">
              <img className="image-preview" src={form.imagePreview} alt="preview" />
              <div className="image-edit-actions">
                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageSelect} />
                  Заменить
                </label>
                <button className="btn btn-secondary btn-sm" onClick={openCropExisting}>✂ Обрезать</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setImageSearchOpen(true)}>🔍 Найти</button>
                <button className="btn btn-sm" style={{ background: '#fff0f0', color: '#c0392b', border: '1.5px solid #ffc9cf' }} onClick={() => handleChange({ imageFile: null, imagePreview: '', imageUrl: '' })}>✕</button>
              </div>
            </div>
          ) : (
            <div>
              <label className="image-upload-area" style={{ cursor: 'pointer', marginBottom: 8 }}>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageSelect} />
                <div style={{ fontSize: 32 }}>📷</div>
                <div style={{ fontWeight: 700, marginTop: 8 }}>Нажмите или перетащите фото</div>
              </label>
              {form.title && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%' }}
                  onClick={() => setImageSearchOpen(true)}
                >
                  🔍 Найти фото в интернете
                </button>
              )}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Дополнительный материал</label>
          <div className="image-upload-area">
            <input type="file" accept="application/pdf" onChange={onDocumentChange} />
            <div>
              <div style={{ fontSize: 32 }}>📄</div>
              <div style={{ fontWeight: 700, marginTop: 8 }}>Нажмите или перетащите документ</div>
              {form.additionalMaterialName ? <div className="document-upload-info" style={{ display: 'block' }}>Выбран файл: {form.additionalMaterialName}</div> : null}
            </div>
          </div>
        </div>
      </Modal>

      <ImageCropModal
        open={Boolean(cropSrc)}
        src={cropSrc}
        onClose={() => setCropSrc(null)}
        onCrop={handleCropDone}
      />

      <ConfirmOverlay
        open={confirmClose}
        message="Изменения не сохранены. Закрыть форму и потерять данные?"
        onCancel={() => setConfirmClose(false)}
        onConfirm={confirmAndClose}
      />

      <RecipeImageSearchModal
        open={imageSearchOpen}
        recipeTitle={form.title}
        onClose={() => setImageSearchOpen(false)}
        onSelect={handleImageSearchSelect}
      />
    </>
  )
}
