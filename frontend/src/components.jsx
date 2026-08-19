import React, { useEffect, useRef, useState } from 'react'

export function Spinner() {
  return <div className="spinner" />
}

export function EmptyState({ emoji, title, description, actions = null }) {
  return (
    <div className="empty-state">
      <span className="emoji">{emoji}</span>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {actions}
    </div>
  )
}

export function Modal({ open, title, onClose, children, footer = null, maxWidth = null, headerActions = null }) {
  if (!open) return null

  return (
    <div className="modal-backdrop open" onClick={(event) => event.target === event.currentTarget && onClose?.()}>
      <div className="modal" style={maxWidth ? { maxWidth } : undefined}>
        <div className="modal-header">
          <h2>{title}</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {headerActions}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  )
}

export function Badge({ className = '', style, children }) {
  return (
    <span className={`badge ${className}`.trim()} style={style}>
      {children}
    </span>
  )
}

export function PageHeader({ title, accent, actions = null }) {
  return (
    <div className="page-header">
      <h1 className="page-title">
        {title} <span>{accent}</span>
      </h1>
      {actions}
    </div>
  )
}

export function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          <span>{toast.icon}</span>
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => onRemove(toast.id)}>✕</button>
        </div>
      ))}
    </div>
  )
}

export function TimeInput({ value, onChange }) {
  const total = (value === '' || value === null || value === undefined) ? 0 : Number(value)
  const hours = Math.floor(total / 60)
  const minutes = total % 60

  function update(h, m) {
    const newTotal = h * 60 + m
    onChange(newTotal === 0 ? '' : newTotal)
  }

  return (
    <div className="time-input">
      <input
        type="number"
        min="0"
        max="99"
        className="form-control time-part"
        value={hours}
        onChange={(e) => update(Math.max(0, Math.min(99, Number(e.target.value) || 0)), minutes)}
      />
      <span className="time-sep">ч</span>
      <input
        type="number"
        min="0"
        max="59"
        className="form-control time-part"
        value={minutes}
        onChange={(e) => update(hours, Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
      />
      <span className="time-sep">мин</span>
    </div>
  )
}

export function ProgressBar({ value }) {
  return (
    <div className="progress-bar">
      <div className="progress-fill" style={{ width: `${value}%` }} />
    </div>
  )
}

export function ConfirmOverlay({ open, message, onCancel, onConfirm, allowSkip = false, skip, onSkipChange }) {
  if (!open) return null

  return (
    <div className="confirm-overlay" onClick={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="confirm-box">
        <div className="confirm-title">Подтверждение</div>
        <div className="confirm-message">{message}</div>
        {allowSkip ? (
          <label className="confirm-skip">
            <input type="checkbox" checked={skip} onChange={(event) => onSkipChange(event.target.checked)} />
            Не спрашивать снова
          </label>
        ) : null}
        <div className="confirm-actions">
          <button className="btn btn-secondary" onClick={onCancel}>Отмена</button>
          <button className="btn btn-primary" onClick={onConfirm}>Подтвердить</button>
        </div>
      </div>
    </div>
  )
}

