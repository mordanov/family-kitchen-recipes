import React from 'react'

import { Modal } from '../../components'

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
}) {
  return (
    <Modal
      open={open}
      title={form.id ? 'Редактировать рецепт' : 'Новый рецепт'}
      onClose={onClose}
      footer={(
        <>
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={onSave}>{form.id ? 'Обновить' : 'Сохранить'}</button>
        </>
      )}
    >
      <div className="form-group">
        <label className="form-label">Название блюда *</label>
        <input className="form-control" value={form.title} onChange={(event) => onChange({ title: event.target.value })} />
      </div>

      <div className="form-group">
        <label className="form-label">Категория блюда *</label>
        <div className="checkbox-group">
          {categories.map((category) => {
            const id = String(category.id)
            const checked = form.categories.includes(id)
            return (
              <label key={category.id} className="checkbox-option">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => onChange({
                    categories: event.target.checked
                      ? [...form.categories, id]
                      : form.categories.filter((item) => item !== id),
                  })}
                />
                {category.name}
              </label>
            )
          })}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Способ приготовления</label>
          <select className="form-control" value={form.cooking_method} onChange={(event) => onChange({ cooking_method: event.target.value })}>
            {methods.map((method) => (
              <option key={method.id} value={method.id}>{`${method.emoji || ''} ${method.name}`.trim()}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Количество порций</label>
          <input type="number" min="1" max="50" className="form-control" value={form.servings} onChange={(event) => onChange({ servings: event.target.value })} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Активное время приготовления</label>
          <input type="number" min="1" max="1440" className="form-control" value={form.active_cooking_time_minutes} onChange={(event) => onChange({ active_cooking_time_minutes: event.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Общее время приготовления</label>
          <input type="number" min="1" max="1440" className="form-control" value={form.cooking_time_minutes} onChange={(event) => onChange({ cooking_time_minutes: event.target.value })} />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Заготовка для морозильной камеры</label>
        <div className="checkbox-group">
          <label className="checkbox-option">
            <input type="checkbox" checked={form.freezer_friendly} onChange={() => onChange({ freezer_friendly: true })} /> Да
          </label>
          <label className="checkbox-option">
            <input type="checkbox" checked={!form.freezer_friendly} onChange={() => onChange({ freezer_friendly: false })} /> Нет
          </label>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Ингредиенты для готовки</label>
        <textarea className="form-control" rows="5" value={form.ingredients} onChange={(event) => onChange({ ingredients: event.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">Рецепт</label>
        <textarea className="form-control" rows="5" value={form.recipe} onChange={(event) => onChange({ recipe: event.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">Закупочный список</label>
        <textarea className="form-control" rows="4" value={form.shopping_list} onChange={(event) => onChange({ shopping_list: event.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">Дополнительная информация</label>
        <textarea className="form-control" rows="3" value={form.extra_info} onChange={(event) => onChange({ extra_info: event.target.value })} />
      </div>

      <div className="form-group">
        <label className="form-label">Фото блюда</label>
        <div className="image-upload-area">
          <input type="file" accept="image/*" onChange={onImageChange} />
          {!form.imagePreview ? (
            <div>
              <div style={{ fontSize: 32 }}>📷</div>
              <div style={{ fontWeight: 700, marginTop: 8 }}>Нажмите или перетащите фото</div>
            </div>
          ) : <img className="image-preview" src={form.imagePreview} alt="preview" />}
        </div>
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
  )
}

