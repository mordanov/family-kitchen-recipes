import React, { useRef, useState } from 'react'

import { api } from '../../api'
import { Modal } from '../../components'

function findBestMatch(hint, items) {
  if (!hint || !items.length) return null
  const h = hint.toLowerCase()
  const exact = items.find((item) => item.name.toLowerCase() === h)
  if (exact) return exact
  return items.find((item) => h.includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(h)) || null
}

export function RecipePdfImportModal({ open, methods, categories, onClose, onImported }) {
  const [file, setFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  function reset() {
    setFile(null)
    setResult(null)
    setError('')
    setParsing(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function onFileSelected(event) {
    const selected = event.target.files?.[0]
    if (!selected) return
    const isPdf = selected.type === 'application/pdf' || selected.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setError('Можно загрузить только PDF-файл')
      event.target.value = ''
      return
    }
    setFile(selected)
    setError('')
    setResult(null)
    event.target.value = ''
  }

  async function parse() {
    if (!file) {
      setError('Выберите PDF-файл')
      return
    }
    setParsing(true)
    setError('')
    setResult(null)
    try {
      const data = await api.parseRecipePdf(file)
      const matchedCategory = findBestMatch(data.category_hint, categories)
      const matchedMethod = findBestMatch(data.cooking_method_hint, methods)
      setResult({
        raw: data,
        matchedCategoryId: matchedCategory ? String(matchedCategory.id) : (categories[0] ? String(categories[0].id) : ''),
        matchedMethodId: matchedMethod ? String(matchedMethod.id) : (methods[0] ? String(methods[0].id) : ''),
      })
    } catch (err) {
      setError(err.message || 'Ошибка при распознавании')
    } finally {
      setParsing(false)
    }
  }

  function accept() {
    if (!result) return
    const { raw, matchedCategoryId, matchedMethodId } = result
    onImported({
      title: raw.title || '',
      ingredients: raw.ingredients || '',
      recipe: raw.recipe_text || '',
      servings: raw.servings || 4,
      active_cooking_time_minutes: raw.active_cooking_time_minutes || '',
      cooking_time_minutes: raw.cooking_time_minutes || '',
      cooking_method: matchedMethodId,
      categories: matchedCategoryId ? [matchedCategoryId] : [],
      imageFile: null,
      imagePreview: '',
      shopping_list: '',
      extra_info: '',
      freezer_friendly: false,
      additionalMaterialName: '',
      materialFile: null,
      id: '',
    })
    reset()
  }

  const lowConfidence = result && result.raw.confidence < 0.9

  return (
    <Modal
      open={open}
      title="Добавить рецепт из PDF"
      onClose={handleClose}
      footer={
        result ? (
          <>
            <button className="btn btn-secondary" onClick={reset}>← Назад</button>
            <button className="btn btn-primary" onClick={accept}>Заполнить форму →</button>
          </>
        ) : (
          <>
            <button className="btn btn-secondary" onClick={handleClose}>Отмена</button>
            <button className="btn btn-primary" onClick={parse} disabled={parsing || !file}>
              {parsing ? 'Распознаём...' : 'Распознать'}
            </button>
          </>
        )
      }
    >
      {!result ? (
        <>
          <p className="ocr-hint">
            Загрузите PDF с рецептом. Каждая страница будет распознана автоматически (до 10 страниц).
          </p>

          <div className="ocr-drop-zone" onClick={() => inputRef.current?.click()}>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              style={{ display: 'none' }}
              onChange={onFileSelected}
            />
            <div className="ocr-drop-icon">📄</div>
            <div className="ocr-drop-label">Нажмите, чтобы выбрать PDF</div>
            {file && <div className="ocr-drop-count">{file.name}</div>}
          </div>

          {parsing && (
            <div className="ocr-parsing-banner">
              <span className="spinner" style={{ width: 20, height: 20, borderWidth: 3 }} />
              Конвертируем страницы и отправляем в OpenAI Vision...
            </div>
          )}

          {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}
        </>
      ) : (
        <>
          {lowConfidence && (
            <div className="ocr-low-confidence-banner">
              ⚠️ Низкая уверенность распознавания ({Math.round(result.raw.confidence * 100)}%).
              {result.raw.low_confidence_reason ? ` ${result.raw.low_confidence_reason}.` : ''}
              {' '}Проверьте заполненные поля перед сохранением.
            </div>
          )}

          <div className="ocr-result-fields">
            <ResultField label="Название блюда" value={result.raw.title} />
            <ResultField label="Категория (подобрана)" value={
              categories.find((c) => String(c.id) === result.matchedCategoryId)?.name ||
              result.raw.category_hint || '—'
            } />
            <ResultField label="Способ приготовления" value={
              methods.find((m) => String(m.id) === result.matchedMethodId)?.name ||
              result.raw.cooking_method_hint || '—'
            } />
            <div className="ocr-result-row-2col">
              <ResultField label="Порций" value={result.raw.servings ?? '—'} />
              <ResultField label="Время (мин)" value={result.raw.cooking_time_minutes ?? '—'} />
            </div>
            {result.raw.ingredients && (
              <ResultField label="Ингредиенты" value={result.raw.ingredients} multiline />
            )}
            {result.raw.recipe_text && (
              <ResultField label="Рецепт" value={result.raw.recipe_text} multiline />
            )}
          </div>

          <p className="ocr-hint" style={{ marginTop: 12 }}>
            Нажмите «Заполнить форму» — поля будут автоматически подставлены, вы сможете отредактировать их перед сохранением.
          </p>
        </>
      )}
    </Modal>
  )
}

function ResultField({ label, value, multiline }) {
  return (
    <div className="form-group" style={{ marginBottom: 12 }}>
      <div className="form-label">{label}</div>
      {multiline ? (
        <div className="ocr-result-text">{String(value)}</div>
      ) : (
        <div className="ocr-result-value">{String(value)}</div>
      )}
    </div>
  )
}
