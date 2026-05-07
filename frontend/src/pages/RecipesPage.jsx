import React, { useEffect, useMemo, useRef, useState } from 'react'

import { api } from '../api'
import { Badge, EmptyState, Modal, PageHeader, Spinner } from '../components'
import { cookingMethodLabel, downloadBlob, formatDate, getRecipeEmoji, readFileAsDataUrl, toRgba } from '../utils'

const defaultForm = {
  id: '',
  title: '',
  cooking_method: '',
  servings: 4,
  active_cooking_time_minutes: '',
  cooking_time_minutes: '',
  ingredients: '',
  recipe: '',
  shopping_list: '',
  extra_info: '',
  freezer_friendly: false,
  categories: [],
  imageFile: null,
  materialFile: null,
  imagePreview: '',
  additionalMaterialName: '',
}

function buildFormData(form) {
  const fd = new FormData()
  fd.append('title', form.title.trim())
  form.categories.forEach((categoryId) => fd.append('categories', categoryId))
  fd.append('ingredients', form.ingredients.trim())
  fd.append('recipe', form.recipe.trim())
  fd.append('shopping_list', form.shopping_list.trim() || form.ingredients.trim())
  if (form.cooking_method) fd.append('cooking_method', form.cooking_method)
  fd.append('servings', String(form.servings))
  if (String(form.active_cooking_time_minutes).trim()) {
    fd.append('active_cooking_time_minutes', String(form.active_cooking_time_minutes).trim())
  }
  if (String(form.cooking_time_minutes).trim()) {
    fd.append('cooking_time_minutes', String(form.cooking_time_minutes).trim())
  }
  fd.append('freezer_friendly', String(Boolean(form.freezer_friendly)))
  fd.append('extra_info', form.extra_info || '')
  if (form.imageFile) fd.append('image', form.imageFile)
  if (form.materialFile) fd.append('additional_material', form.materialFile)
  return fd
}

function MemberFeedback({ recipe, compact = true }) {
  const feedback = recipe.member_feedback || []
  if (!feedback.length) return null

  return (
    <>
      {!compact ? <div className="section-title" style={{ marginTop: 10 }}>❤️ Предпочтения семьи</div> : null}
      <div className="recipe-feedback">
        {feedback.map((item) => {
          const color = item.member_color || '#FF6B35'
          const disliked = item.status === 'disliked'
          return (
            <span
              key={`${item.member_id}-${item.status}`}
              className={`recipe-feedback-chip ${disliked ? 'is-disliked' : 'is-preferred'}`}
              style={{
                borderColor: color,
                background: toRgba(color, 0.14),
                color,
              }}
            >
              {disliked ? '💔' : '❤️'} {item.member_name}
            </span>
          )
        })}
      </div>
    </>
  )
}

function RecipeCard({ recipe, onOpen }) {
  return (
    <div className="recipe-card" onClick={() => onOpen(recipe)}>
      <div className="recipe-card-img">
        {recipe.image_path ? <img src={recipe.image_path} alt={recipe.title} loading="lazy" /> : getRecipeEmoji(recipe.cooking_method)}
      </div>
      <div className="recipe-card-body">
        <div className="recipe-card-title">{recipe.title}</div>
        <div className="recipe-card-meta">
          <Badge className="badge-primary">{cookingMethodLabel(recipe.cooking_method)}</Badge>
          <Badge>{recipe.servings} порц.</Badge>
          {Number.isFinite(recipe.cooking_time_minutes) ? <Badge>⏱ {recipe.cooking_time_minutes} мин</Badge> : null}
          {Number.isFinite(recipe.active_cooking_time_minutes) ? <Badge>🔥 {recipe.active_cooking_time_minutes} мин активно</Badge> : null}
          {recipe.freezer_friendly ? <Badge>❄️ Для морозилки</Badge> : null}
          {recipe.additional_material_path ? <Badge>📄 PDF</Badge> : null}
          {(recipe.categories || []).slice(0, 3).map((category) => (
            <Badge key={category} className="badge-accent">{category}</Badge>
          ))}
        </div>
        {recipe.kbju_calculated ? (
          <div className="kbju-strip">
            <div className="kbju-item"><div className="kv">{recipe.calories?.toFixed(0) ?? '–'}</div><div className="kl">ккал</div></div>
            <div className="kbju-item"><div className="kv">{recipe.proteins?.toFixed(1) ?? '–'}</div><div className="kl">белки</div></div>
            <div className="kbju-item"><div className="kv">{recipe.fats?.toFixed(1) ?? '–'}</div><div className="kl">жиры</div></div>
            <div className="kbju-item"><div className="kv">{recipe.carbs?.toFixed(1) ?? '–'}</div><div className="kl">углев.</div></div>
          </div>
        ) : (
          <p className="kbju-pending">⏳ КБЖУ рассчитывается...</p>
        )}
        <MemberFeedback recipe={recipe} />
      </div>
    </div>
  )
}

export function RecipesPage({ active, toast }) {
  const [recipes, setRecipes] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [detailRecipe, setDetailRecipe] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [categories, setCategories] = useState([])
  const [methods, setMethods] = useState([])
  const [polling, setPolling] = useState(false)
  const pollRef = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    loadDirectories().catch(() => {})
  }, [])

  useEffect(() => {
    if (!active) return undefined
    clearTimeout(searchRef.current)
    searchRef.current = window.setTimeout(() => {
      loadRecipes(search)
    }, 300)
    return () => clearTimeout(searchRef.current)
  }, [active, search])

  useEffect(() => {
    if (!active) return undefined
    const hasPending = recipes.some((recipe) => !recipe.kbju_calculated)
    if (!hasPending || polling) return undefined

    let attempts = 0
    setPolling(true)
    pollRef.current = window.setInterval(async () => {
      attempts += 1
      try {
        const updated = await api.listRecipes(search)
        const newlyDone = updated.filter((recipe) => recipe.kbju_calculated && recipes.find((oldRecipe) => oldRecipe.id === recipe.id && !oldRecipe.kbju_calculated))
        setRecipes(updated)
        if (newlyDone.length) {
          toast(`КБЖУ рассчитан для: ${newlyDone.map((recipe) => recipe.title).join(', ')}`, 'success')
        }
        if (!updated.some((recipe) => !recipe.kbju_calculated) || attempts > 15) {
          window.clearInterval(pollRef.current)
          setPolling(false)
        }
      } catch {
        window.clearInterval(pollRef.current)
        setPolling(false)
      }
    }, 4000)

    return () => {
      window.clearInterval(pollRef.current)
      setPolling(false)
    }
  }, [active, polling, recipes, search, toast])

  async function loadDirectories() {
    const [loadedCategories, loadedMethods] = await Promise.all([
      api.getRecipeCategories(),
      api.getCookingMethods(),
    ])
    const nextCategories = loadedCategories.filter((item) => !item.is_deleted)
    const nextMethods = loadedMethods.filter((item) => !item.is_deleted)
    setCategories(nextCategories)
    setMethods(nextMethods)
    setForm((prev) => ({
      ...prev,
      cooking_method: prev.cooking_method || String(nextMethods[0]?.id || ''),
      categories: prev.categories.length ? prev.categories : (nextCategories[0] ? [String(nextCategories[0].id)] : []),
    }))
  }

  async function loadRecipes(searchText = '') {
    setLoading(true)
    try {
      const list = await api.listRecipes(searchText)
      setRecipes(list)
    } catch (error) {
      toast(error.message, 'error')
      setRecipes([])
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setForm({
      ...defaultForm,
      cooking_method: String(methods[0]?.id || ''),
      categories: categories[0] ? [String(categories[0].id)] : [],
    })
  }

  function openCreate() {
    resetForm()
    setFormOpen(true)
  }

  function openEdit(recipe) {
    setForm({
      id: String(recipe.id),
      title: recipe.title || '',
      cooking_method: String(recipe.cooking_method?.id || ''),
      servings: recipe.servings || 4,
      active_cooking_time_minutes: recipe.active_cooking_time_minutes ?? '',
      cooking_time_minutes: recipe.cooking_time_minutes ?? '',
      ingredients: recipe.ingredients || '',
      recipe: recipe.recipe || '',
      shopping_list: recipe.shopping_list || '',
      extra_info: recipe.extra_info || '',
      freezer_friendly: Boolean(recipe.freezer_friendly),
      categories: (recipe.categories || []).map((name) => String(categories.find((item) => item.name === name)?.id || name)).filter(Boolean),
      imageFile: null,
      materialFile: null,
      imagePreview: recipe.image_path || '',
      additionalMaterialName: recipe.additional_material_original_name || recipe.additional_material_path || '',
    })
    setFormOpen(true)
  }

  async function openDetail(recipe) {
    if (recipe.ingredients && recipe.updated_at) {
      setDetailRecipe(recipe)
      return
    }
    try {
      const fullRecipe = await api.getRecipe(recipe.id)
      setDetailRecipe(fullRecipe)
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  async function saveRecipe() {
    if (!form.title.trim()) {
      toast('Введите название блюда', 'error')
      return
    }
    if (!form.ingredients.trim()) {
      toast('Заполните ингредиенты для готовки', 'error')
      return
    }
    if (!form.categories.length) {
      toast('Выберите минимум одну категорию блюда', 'error')
      return
    }

    try {
      const fd = buildFormData(form)
      if (form.id) {
        await api.updateRecipe(form.id, fd)
        toast('Рецепт обновлён! КБЖУ пересчитывается...', 'success')
      } else {
        await api.createRecipe(fd)
        toast('Рецепт добавлен! Считаем КБЖУ...', 'success')
      }
      setFormOpen(false)
      resetForm()
      await loadRecipes(search)
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function deleteRecipe(recipeId) {
    if (!window.confirm('Удалить рецепт? Это действие нельзя отменить.')) return
    try {
      await api.deleteRecipe(recipeId)
      setDetailRecipe(null)
      await loadRecipes(search)
      toast('Рецепт удалён', 'success')
    } catch (error) {
      toast(`Ошибка удаления: ${error.message}`, 'error')
    }
  }

  async function removeAdditionalMaterial(recipeId) {
    if (!window.confirm('Удалить дополнительный материал из рецепта?')) return
    try {
      const updated = await api.deleteRecipeMaterial(recipeId)
      setRecipes((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setDetailRecipe(updated)
      toast('Дополнительный материал удалён', 'success')
    } catch (error) {
      toast(`Ошибка удаления материала: ${error.message}`, 'error')
    }
  }

  async function downloadAdditionalMaterial(recipeId, fileName = 'material.pdf') {
    try {
      const blob = await api.downloadRecipeMaterial(recipeId)
      if (!blob) return
      downloadBlob(blob, String(fileName || 'material.pdf').trim() || 'material.pdf')
    } catch (error) {
      toast(`Ошибка скачивания материала: ${error.message}`, 'error')
    }
  }

  async function recalc(recipeId) {
    try {
      await api.recalcKbju(recipeId)
      toast('КБЖУ пересчитывается...', 'info')
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function onImageChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const preview = await readFileAsDataUrl(file)
    setForm((prev) => ({ ...prev, imageFile: file, imagePreview: preview }))
  }

  function onDocumentChange(event) {
    const file = event.target.files?.[0]
    if (!file) {
      setForm((prev) => ({ ...prev, materialFile: null, additionalMaterialName: '' }))
      return
    }
    const isPdfByMime = (file.type || '').toLowerCase() === 'application/pdf'
    const isPdfByName = (file.name || '').toLowerCase().endsWith('.pdf')
    if (!isPdfByMime && !isPdfByName) {
      event.target.value = ''
      toast('Можно загрузить только PDF документ', 'error')
      return
    }
    setForm((prev) => ({ ...prev, materialFile: file, additionalMaterialName: file.name }))
  }

  const detailCategories = useMemo(() => detailRecipe?.categories || [], [detailRecipe])

  return (
    <div className={`page ${active ? 'active' : ''}`}>
      <PageHeader
        title="Мои"
        accent="рецепты"
        actions={<button className="btn btn-primary" onClick={openCreate}>+ Добавить рецепт</button>}
      />

      <div className="search-bar">
        <input
          type="text"
          className="search-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="🔍 Поиск по названию..."
        />
      </div>

      {loading ? <Spinner /> : null}
      {!loading && !recipes.length ? (
        <EmptyState
          emoji="🍽️"
          title="Рецептов пока нет"
          description="Добавьте первый семейный рецепт!"
          actions={<button className="btn btn-primary" onClick={openCreate}>+ Добавить рецепт</button>}
        />
      ) : null}
      {!loading && recipes.length ? (
        <div className="recipes-grid">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} onOpen={openDetail} />
          ))}
        </div>
      ) : null}

      <Modal
        open={formOpen}
        title={form.id ? 'Редактировать рецепт' : 'Новый рецепт'}
        onClose={() => { setFormOpen(false); resetForm() }}
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => { setFormOpen(false); resetForm() }}>Отмена</button>
            <button className="btn btn-primary" onClick={saveRecipe}>{form.id ? 'Обновить' : 'Сохранить'}</button>
          </>
        )}
      >
        <div className="form-group">
          <label className="form-label">Название блюда *</label>
          <input className="form-control" value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
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
                    onChange={(event) => setForm((prev) => ({
                      ...prev,
                      categories: event.target.checked
                        ? [...prev.categories, id]
                        : prev.categories.filter((item) => item !== id),
                    }))}
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
            <select className="form-control" value={form.cooking_method} onChange={(event) => setForm((prev) => ({ ...prev, cooking_method: event.target.value }))}>
              {methods.map((method) => (
                <option key={method.id} value={method.id}>{`${method.emoji || ''} ${method.name}`.trim()}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Количество порций</label>
            <input type="number" min="1" max="50" className="form-control" value={form.servings} onChange={(event) => setForm((prev) => ({ ...prev, servings: event.target.value }))} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Активное время приготовления</label>
            <input type="number" min="1" max="1440" className="form-control" value={form.active_cooking_time_minutes} onChange={(event) => setForm((prev) => ({ ...prev, active_cooking_time_minutes: event.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Общее время приготовления</label>
            <input type="number" min="1" max="1440" className="form-control" value={form.cooking_time_minutes} onChange={(event) => setForm((prev) => ({ ...prev, cooking_time_minutes: event.target.value }))} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Заготовка для морозильной камеры</label>
          <div className="checkbox-group">
            <label className="checkbox-option">
              <input type="checkbox" checked={form.freezer_friendly} onChange={() => setForm((prev) => ({ ...prev, freezer_friendly: true }))} /> Да
            </label>
            <label className="checkbox-option">
              <input type="checkbox" checked={!form.freezer_friendly} onChange={() => setForm((prev) => ({ ...prev, freezer_friendly: false }))} /> Нет
            </label>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Ингредиенты для готовки</label>
          <textarea className="form-control" rows="5" value={form.ingredients} onChange={(event) => setForm((prev) => ({ ...prev, ingredients: event.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Рецепт</label>
          <textarea className="form-control" rows="5" value={form.recipe} onChange={(event) => setForm((prev) => ({ ...prev, recipe: event.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Закупочный список</label>
          <textarea className="form-control" rows="4" value={form.shopping_list} onChange={(event) => setForm((prev) => ({ ...prev, shopping_list: event.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Дополнительная информация</label>
          <textarea className="form-control" rows="3" value={form.extra_info} onChange={(event) => setForm((prev) => ({ ...prev, extra_info: event.target.value }))} />
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

      <Modal
        open={Boolean(detailRecipe)}
        title="Рецепт"
        onClose={() => setDetailRecipe(null)}
        maxWidth="720px"
        headerActions={detailRecipe ? (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => { openEdit(detailRecipe); setDetailRecipe(null) }}>✏️ Изменить</button>
            <button className="btn btn-danger btn-sm" onClick={() => deleteRecipe(detailRecipe.id)}>🗑️</button>
          </>
        ) : null}
      >
        {detailRecipe ? (
          <>
            <div className="recipe-detail-header">
              <div className="recipe-detail-img">
                {detailRecipe.image_path ? <img src={detailRecipe.image_path} alt={detailRecipe.title} /> : getRecipeEmoji(detailRecipe.cooking_method)}
              </div>
              <div className="recipe-detail-info">
                <div className="recipe-detail-title">{detailRecipe.title}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Badge className="badge-primary">{cookingMethodLabel(detailRecipe.cooking_method)}</Badge>
                  <Badge>{detailRecipe.servings} порций</Badge>
                  {Number.isFinite(detailRecipe.cooking_time_minutes) ? <Badge>⏱ Общее время: {detailRecipe.cooking_time_minutes} мин</Badge> : null}
                  {Number.isFinite(detailRecipe.active_cooking_time_minutes) ? <Badge>🔥 Активное время: {detailRecipe.active_cooking_time_minutes} мин</Badge> : null}
                  <Badge>{detailRecipe.freezer_friendly ? '❄️ Подходит для морозильной камеры' : '🧊 Не для морозильной камеры'}</Badge>
                  <Badge style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>Обновлён: {formatDate(detailRecipe.updated_at)}</Badge>
                </div>
                <MemberFeedback recipe={detailRecipe} compact={false} />
                {detailRecipe.kbju_calculated ? (
                  <div className="kbju-big">
                    <div className="kbju-big-item"><span className="val">{detailRecipe.calories?.toFixed(0) ?? '–'}</span><span className="lbl">ккал</span></div>
                    <div className="kbju-big-item accent"><span className="val">{detailRecipe.proteins?.toFixed(1) ?? '–'}</span><span className="lbl">белки г</span></div>
                    <div className="kbju-big-item accent"><span className="val">{detailRecipe.fats?.toFixed(1) ?? '–'}</span><span className="lbl">жиры г</span></div>
                    <div className="kbju-big-item accent"><span className="val">{detailRecipe.carbs?.toFixed(1) ?? '–'}</span><span className="lbl">углев. г</span></div>
                  </div>
                ) : (
                  <p style={{ marginTop: 12, color: 'var(--c-text-muted)' }}>
                    ⏳ КБЖУ рассчитывается...
                    <button className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }} onClick={() => recalc(detailRecipe.id)}>Пересчитать</button>
                  </p>
                )}
              </div>
            </div>
            <div className="section-title">🏷️ Категория блюда</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {detailCategories.length ? detailCategories.map((category) => <Badge key={category} className="badge-accent">{category}</Badge>) : <em>Не указаны</em>}
            </div>
            <div className="section-title">📋 Ингредиенты</div>
            <div className="ingredients-text">{detailRecipe.ingredients || <em>Не указаны</em>}</div>
            {detailRecipe.recipe ? <><div className="section-title">👨‍🍳 Рецепт</div><div className="ingredients-text" style={{ borderColor: 'var(--c-accent)' }}>{detailRecipe.recipe}</div></> : null}
            {detailRecipe.shopping_list ? <><div className="section-title">🛒 Закупочный список</div><div className="ingredients-text" style={{ borderColor: 'var(--c-accent)' }}>{detailRecipe.shopping_list}</div></> : null}
            {detailRecipe.additional_material_path ? (
              <>
                <div className="section-title">📄 Дополнительный материал</div>
                <div className="ingredients-text" style={{ borderColor: 'var(--c-border)' }}>Файл: {detailRecipe.additional_material_original_name || 'material.pdf'}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => downloadAdditionalMaterial(detailRecipe.id, detailRecipe.additional_material_original_name || 'material.pdf')}>⬇️ Скачать PDF</button>
                  <button className="btn btn-danger btn-sm" onClick={() => removeAdditionalMaterial(detailRecipe.id)}>🗑️ Удалить материал</button>
                </div>
              </>
            ) : null}
            {detailRecipe.extra_info ? <><div className="section-title">📝 Доп. информация</div><div className="ingredients-text" style={{ borderColor: 'var(--c-secondary)' }}>{detailRecipe.extra_info}</div></> : null}
          </>
        ) : null}
      </Modal>
    </div>
  )
}

