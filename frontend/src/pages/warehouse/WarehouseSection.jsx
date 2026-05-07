import React from 'react'

export function WarehouseSection({ title, onAdd, children }) {
  return (
    <section className="warehouse-section">
      <div className="warehouse-section-header">
        <h3>{title}</h3>
        <button className="btn btn-primary btn-sm" onClick={onAdd}>+ Добавить</button>
      </div>
      {children}
    </section>
  )
}

export function WarehouseRows({ items, renderRow, emptyLabel = 'Список пуст' }) {
  if (!items.length) return <p className="text-muted">{emptyLabel}</p>
  return <div className="warehouse-panel-list">{items.map(renderRow)}</div>
}

