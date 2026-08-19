import React, { useEffect, useState } from 'react'

import { Modal, Spinner } from '../../components'
import { api } from '../../api'

export function RecipeImageSearchModal({ open, recipeTitle, onClose, onSelect }) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open || !recipeTitle) return
    setResults([])
    setError(null)
    setLoading(true)
    api.searchRecipeImages(recipeTitle)
      .then((data) => {
        setResults(data || [])
        if (!data || data.length === 0) setError('Изображения не найдены')
      })
      .catch((err) => setError(err.message || 'Ошибка поиска'))
      .finally(() => setLoading(false))
  }, [open, recipeTitle])

  function handleRetry() {
    setResults([])
    setError(null)
    setLoading(true)
    api.searchRecipeImages(recipeTitle)
      .then((data) => {
        setResults(data || [])
        if (!data || data.length === 0) setError('Изображения не найдены')
      })
      .catch((err) => setError(err.message || 'Ошибка поиска'))
      .finally(() => setLoading(false))
  }

  return (
    <Modal
      open={open}
      title="🔍 Найти фото в интернете"
      onClose={onClose}
      footer={<button className="btn btn-secondary" onClick={onClose}>Отмена</button>}
    >
      <p style={{ fontSize: 13, color: 'var(--c-text-muted)', marginBottom: 16 }}>
        Результаты поиска по: <strong>{recipeTitle}</strong>
      </p>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <Spinner />
        </div>
      )}

      {error && !loading && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p style={{ color: 'var(--c-text-muted)', marginBottom: 12 }}>{error}</p>
          <button className="btn btn-secondary btn-sm" onClick={handleRetry}>Повторить</button>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="image-search-grid">
          {results.map((item, i) => (
            <button
              key={i}
              type="button"
              className="image-search-thumb"
              title={item.title}
              onClick={() => onSelect(item.url)}
            >
              <img
                src={item.thumbnail || item.url}
                alt={item.title}
                loading="lazy"
                onError={(e) => { e.currentTarget.src = item.url }}
              />
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}
