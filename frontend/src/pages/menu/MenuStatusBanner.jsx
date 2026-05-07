import React from 'react'

import { Badge, ProgressBar } from '../../components'
import { formatDate, weeksLabel } from '../../utils'

export function MenuStatusBanner({ menu, totalItems, cookedItems, progress, onClose }) {
  return (
    <div className={`menu-status-banner ${menu.status === 'closed' ? 'closed' : ''}`}>
      <div>
        <h3>
          {menu.title}{' '}
          {menu.status === 'closed' ? <Badge style={{ background: '#e8e8ef', color: '#6B6B80' }}>Закрыто {formatDate(menu.closed_at)}</Badge> : null}
        </h3>
        <p>{menu.weeks} {weeksLabel(menu.weeks)} · {totalItems} слотов · Готово: {cookedItems}/{totalItems}</p>
        <div style={{ width: 200, marginTop: 10 }}><ProgressBar value={progress} /></div>
      </div>
      {menu.status !== 'closed' ? (
        <button className="btn btn-secondary" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', borderColor: 'rgba(255,255,255,0.3)' }} onClick={onClose}>
          Закрыть меню
        </button>
      ) : null}
    </div>
  )
}

