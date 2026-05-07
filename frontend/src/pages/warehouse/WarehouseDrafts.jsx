import React from 'react'

import { Modal } from '../../components'
import { pluralItems } from '../../utils'

export function WarehouseDraftsZone({ drafts, onOpenDraft }) {
  if (!drafts.length) return null

  return (
    <div className="draft-zone">
      <div className="draft-zone-header">📋 Черновики чеков ({drafts.length})</div>
      <div className="draft-list">
        {drafts.map((draft) => {
          const date = new Date(draft.created_at)
          return (
            <div key={draft.id} className="draft-list-row" onClick={() => onOpenDraft(draft)}>
              <span className="draft-list-date">{date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })} {date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="draft-list-count">{draft.items.length} {pluralItems(draft.items.length)}</span>
              <span className="draft-list-arrow">›</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function WarehouseDraftModal({ draftForm, onClose, onDelete, onCommit, onUpdateItem, onRemoveItem, onAddRow }) {
  return (
    <Modal
      open={Boolean(draftForm)}
      title={draftForm ? `Чек от ${new Date(draftForm.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${new Date(draftForm.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : 'Чек'}
      onClose={onClose}
      maxWidth="520px"
      footer={(
        <>
          <button className="btn btn-secondary warehouse-delete-btn" onClick={onDelete}>Удалить черновик</button>
          <button className="btn btn-primary" onClick={onCommit}>Применить</button>
        </>
      )}
    >
      {draftForm ? (
        <>
          <div>
            {draftForm.items.map((item, index) => (
              <div key={index} className="draft-item-row">
                <input className="form-control draft-item-name" value={item.name} placeholder="Продукт" onChange={(event) => onUpdateItem(index, 'name', event.target.value)} />
                <input className="form-control draft-item-qty" value={item.quantity} placeholder="Кол-во" onChange={(event) => onUpdateItem(index, 'quantity', event.target.value)} />
                <button className="btn btn-secondary btn-sm warehouse-delete-btn" onClick={() => onRemoveItem(index)}>✕</button>
              </div>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={onAddRow}>+ Добавить позицию</button>
          {draftForm.ocr_text ? (
            <details className="draft-ocr-details">
              <summary className="draft-ocr-summary">Текст с чека (OCR)</summary>
              <pre className="draft-ocr-text">{draftForm.ocr_text}</pre>
            </details>
          ) : null}
        </>
      ) : null}
    </Modal>
  )
}

