import React, { useRef, useState } from 'react'

import { api } from '../../api'
import { Modal } from '../../components'
import { readFileAsDataUrl } from '../../utils'

const CATEGORY_MAP = {
  'завтрак': 'завтрак',
  'суп': 'суп',
  'основное блюдо': 'основное',
  'салат': 'салат',
  'выпечка': 'выпечка',
  'десерт': 'десерт',
  'закуска': 'закуска',
  'напиток': 'напиток',
}

const METHOD_MAP = {
  'варка': 'варка',
  'жарка': 'жарка',
  'запекание': 'запекание',
  'тушение': 'тушение',
  'приготовление на пару': 'пар',
  'гриль': 'гриль',
  'без термообработки': 'без',
}

function findBestMatch(hint, items, nameKey = 'name') {
  if (!hint || !items.length) return null
  const h = hint.toLowerCase()
  const exact = items.find((item) => item[nameKey].toLowerCase() === h)
  if (exact) return exact
  const partial = items.find((item) => h.includes(item[nameKey].toLowerCase()) || item[nameKey].toLowerCase().includes(h))
  return partial || null
}

export function RecipeImportModal({
  open,
  methods,
  categories,
  onClose,
  onImported,
}) {
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [parsing, setParsing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  function reset() {
    setFiles([])
    setPreviews([])
    setResult(null)
    setError('')
    setParsing(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function onFilesSelected(event) {
    const selected = Array.from(event.target.files || [])
    if (!selected.length) return
    const combined = [...files, ...selected].slice(0, 10)
    setFiles(combined)
    const newPreviews = await Promise.all(combined.map(readFileAsDataUrl))
    setPreviews(newPreviews)
    setError('')
    setResult(null)
    event.target.value = ''
  }

  function removeFile(index) {
    const nextFiles = files.filter((_, i) => i !== index)
    const nextPreviews = previews.filter((_, i) => i !== index)
    setFiles(nextFiles)
    setPreviews(nextPreviews)
    setResult(null)
  }

  async function parse() {
    if (!files.length) {
      setError('Добавьте хотя бы одно изображение')
      return
    }
    setParsing(true)
    setError('')
    setResult(null)
    try {
      const data = await api.parseRecipeImages(files)
      const coverPreview = data.cover_image_index != null ? previews[data.cover_image_index] : null
      const coverFile = data.cover_image_index != null ? files[data.cover_image_index] : null
      const matchedCategory = findBestMatch(data.category_hint, categories)
      const matchedMethod = findBestMatch(data.cooking_method_hint, methods)
      setResult({
        raw: data,
        coverPreview,
        coverFile,
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
    const { raw, coverPreview, coverFile, matchedCategoryId, matchedMethodId } = result
    onImported({
      title: raw.title || '',
      ingredients: raw.ingredients || '',
      recipe: raw.recipe_text || '',
      servings: raw.servings || 4,
      active_cooking_time_minutes: raw.active_cooking_time_minutes || '',
      cooking_time_minutes: raw.cooking_time_minutes || '',
      cooking_method: matchedMethodId,
      categories: matchedCategoryId ? [matchedCategoryId] : [],
      imageFile: coverFile || null,
      imagePreview: coverPreview || '',
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
      title="Добавить рецепт из фото"
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
            <button className="btn btn-primary" onClick={parse} disabled={parsing || !files.length}>
              {parsing ? 'Распознаём...' : 'Распознать'}
            </button>
          </>
        )
      }
    >
      {!result ? (
        <>
          <p className="ocr-hint">
            Загрузите одно или несколько фото рецепта (до 10). Страницы рецептной карточки, скриншоты из Instagram/TikTok — всё подойдёт.
          </p>

          <div
            className="ocr-drop-zone"
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={onFilesSelected}
            />
            <div className="ocr-drop-icon">📷</div>
            <div className="ocr-drop-label">Нажмите или перетащите фото</div>
            {files.length > 0 && (
              <div className="ocr-drop-count">{files.length} фото выбрано</div>
            )}
          </div>

          {previews.length > 0 && (
            <div className="ocr-preview-strip">
              {previews.map((src, i) => (
                <div key={i} className="ocr-thumb-wrap">
                  <img src={src} className="ocr-thumb" alt={`фото ${i + 1}`} />
                  <button
                    className="ocr-thumb-remove"
                    onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                    title="Удалить"
                  >×</button>
                  <div className="ocr-thumb-num">{i + 1}</div>
                </div>
              ))}
              {files.length < 10 && (
                <div
                  className="ocr-thumb-add"
                  onClick={() => inputRef.current?.click()}
                >
                  +
                </div>
              )}
            </div>
          )}

          {parsing && (
            <div className="ocr-parsing-banner">
              <span className="spinner" style={{ width: 20, height: 20, borderWidth: 3 }} />
              Отправляем фото в OpenAI Vision...
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

          <div className="ocr-result-grid">
            {result.coverPreview && (
              <div className="ocr-result-cover">
                <div className="form-label" style={{ marginBottom: 6 }}>Обложка рецепта</div>
                <img src={result.coverPreview} className="ocr-result-cover-img" alt="обложка" />
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
