import React, { useEffect, useMemo, useRef, useState } from 'react'

import { api } from '../api'
import { EmptyState, PageHeader, Spinner } from '../components'
import { downloadBlob } from '../utils'
import { RecipeCard } from './recipes/RecipeCard'
import { RecipeDetailModal } from './recipes/RecipeDetailModal'
import { RecipeFormModal } from './recipes/RecipeFormModal'
import { RecipeImportModal } from './recipes/RecipeImportModal'
import { buildRecipeFormData, createEmptyRecipeForm, defaultRecipeForm } from './recipes/recipeForm'

export function RecipesPage({ active, toast }) {
  const [recipes, setRecipes] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [detailRecipe, setDetailRecipe] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [form, setForm] = useState(defaultRecipeForm)
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
    setForm(createEmptyRecipeForm(methods, categories))
  }

  function openCreate() {
    resetForm()
    setFormOpen(true)
  }

  function openImport() {
    setImportOpen(true)
  }

  function onImported(prefilled) {
    setImportOpen(false)
    setForm(prefilled)
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
      is_dietary: Boolean(recipe.is_dietary),
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
      const fd = buildRecipeFormData(form)
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

  function updateForm(patch) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  async function addCategory(name) {
    const created = await api.createRecipeCategory({ name })
    setCategories((prev) => [...prev, created])
    setForm((prev) => ({ ...prev, categories: [...prev.categories, String(created.id)] }))
  }

  async function imageFromUrl(url) {
    try {
      const updated = await api.setImageFromUrl(form.id, url)
      updateForm({ imagePreview: updated.image_path, imageUrl: '' })
    } catch (error) {
      toast(`Ошибка загрузки изображения: ${error.message}`, 'error')
      throw error
    }
  }

  return (
    <div className={`page ${active ? 'active' : ''}`}>
      <PageHeader
        title="Мои"
        accent="рецепты"
        actions={(
          <div className="btn-group">
            <button className="btn btn-secondary" onClick={openImport}>📷 Из фото</button>
            <button className="btn btn-primary" onClick={openCreate}>+ Вручную</button>
          </div>
        )}
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
          actions={(
            <div className="btn-group">
              <button className="btn btn-secondary" onClick={openImport}>📷 Из фото</button>
              <button className="btn btn-primary" onClick={openCreate}>+ Вручную</button>
            </div>
          )}
        />
      ) : null}
      {!loading && recipes.length ? (
        <div className="recipes-grid">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} onOpen={openDetail} />
          ))}
        </div>
      ) : null}

      <RecipeImportModal
        open={importOpen}
        methods={methods}
        categories={categories}
        onClose={() => setImportOpen(false)}
        onImported={onImported}
      />

      <RecipeFormModal
        open={formOpen}
        form={form}
        methods={methods}
        categories={categories}
        onClose={() => { setFormOpen(false); resetForm() }}
        onSave={saveRecipe}
        onChange={updateForm}
        onDocumentChange={onDocumentChange}
        onAddCategory={addCategory}
        onImageFromUrl={imageFromUrl}
      />

      <RecipeDetailModal
        recipe={detailRecipe}
        onClose={() => setDetailRecipe(null)}
        onEdit={() => { openEdit(detailRecipe); setDetailRecipe(null) }}
        onDelete={() => deleteRecipe(detailRecipe.id)}
        onRecalc={() => recalc(detailRecipe.id)}
        onDownloadMaterial={() => downloadAdditionalMaterial(detailRecipe.id, detailRecipe.additional_material_original_name || 'material.pdf')}
        onRemoveMaterial={() => removeAdditionalMaterial(detailRecipe.id)}
      />
    </div>
  )
}


