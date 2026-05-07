import React from 'react'

import { Modal } from '../../components'

export function StockModal({ open, form, onClose, onSave, onChange, todayIso }) {
  return (
    <Modal
      open={open}
      title={form.id ? 'Редактировать продукт' : 'Добавить продукт'}
      onClose={onClose}
      maxWidth="460px"
      footer={(
        <>
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={onSave}>Сохранить</button>
        </>
      )}
    >
      <div className="form-group">
        <label className="form-label">Продукт</label>
        <input className="form-control" value={form.name} onChange={(event) => onChange('name', event.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Количество</label>
        <input className="form-control" value={form.quantity} onChange={(event) => onChange('quantity', event.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Дата</label>
        <input type="date" className="form-control" value={form.added_on || todayIso()} onChange={(event) => onChange('added_on', event.target.value)} />
      </div>
    </Modal>
  )
}

export function PreparedModal({ open, form, recipes, onClose, onSave, onChange, todayIso }) {
  return (
    <Modal
      open={open}
      title={form.id ? 'Редактировать заготовку' : 'Добавить заготовку'}
      onClose={onClose}
      maxWidth="460px"
      footer={(
        <>
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={onSave}>Сохранить</button>
        </>
      )}
    >
      <div className="form-group">
        <label className="form-label">Рецепт</label>
        <select className="form-control" value={form.recipe_id} onChange={(event) => onChange('recipe_id', event.target.value)}>
          <option value="">-- Выберите рецепт --</option>
          {recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.title}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Количество порций</label>
        <input type="number" min="0.5" step="0.5" className="form-control" value={form.servings} onChange={(event) => onChange('servings', event.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Заметка</label>
        <input className="form-control" value={form.note} onChange={(event) => onChange('note', event.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Дата</label>
        <input type="date" className="form-control" value={form.added_on || todayIso()} onChange={(event) => onChange('added_on', event.target.value)} />
      </div>
    </Modal>
  )
}

