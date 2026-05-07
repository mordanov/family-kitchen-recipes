import React, { useEffect, useMemo, useState } from 'react'

import { api } from '../api'
import { Badge, ConfirmOverlay, EmptyState, Modal, PageHeader, ProgressBar, Spinner } from '../components'
import { cookingMethodLabel, DAY_LABELS, formatDate, MEAL_LABELS, MEAL_ORDER, presetMenuTitle, weeksLabel } from '../utils'

function isMealSlotMenu(menu) {
  return Boolean(menu?.items?.some((item) => item.meal_type && item.day_of_week))
}

function buildAssignments(pendingAssignments) {
  return Object.entries(pendingAssignments)
    .filter(([memberId, recipeId]) => memberId !== '__shared' && Number.isFinite(Number(memberId)) && recipeId)
    .map(([memberId, recipeId]) => ({
      member_id: Number(memberId),
      recipe_id: recipeId,
    }))
}

export function MenuPage({ active, toast, quickActions, setQuickActions }) {
  const [loading, setLoading] = useState(false)
  const [activeMenu, setActiveMenu] = useState(null)
  const [currentWeek, setCurrentWeek] = useState(1)
  const [allRecipes, setAllRecipes] = useState([])
  const [allMembers, setAllMembers] = useState([])
  const [preparedByRecipeId, setPreparedByRecipeId] = useState({})
  const [stockNames, setStockNames] = useState(new Set())
  const [addItemMealType, setAddItemMealType] = useState('')
  const [addItemDay, setAddItemDay] = useState('')
  const [selectedRecipeId, setSelectedRecipeId] = useState('')
  const [pendingAssignments, setPendingAssignments] = useState({})
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ title: '', weeks: 1 })
  const [autoModalOpen, setAutoModalOpen] = useState(false)
  const [autoForm, setAutoForm] = useState({
    title: presetMenuTitle(),
    weeks: 1,
    recipes_per_week: 5,
    use_meal_slots: false,
    meals: ['breakfast', 'lunch', 'dinner'],
    days: [1, 2, 3, 4, 5, 6, 7],
  })
  const [shoppingModalData, setShoppingModalData] = useState(null)

  useEffect(() => {
    if (!active) return
    load()
  }, [active])

  async function load() {
    setLoading(true)
    try {
      const [activeMenuRes, recipesRes, preparedRes, stockRes, membersRes] = await Promise.allSettled([
        api.getActiveMenu(),
        api.listRecipes(),
        api.listPrepared(),
        api.listStock(),
        api.listMembers(),
      ])

      const menu = activeMenuRes.status === 'fulfilled' ? activeMenuRes.value : null
      const recipes = recipesRes.status === 'fulfilled' ? recipesRes.value : []
      const members = membersRes.status === 'fulfilled' ? membersRes.value : []

      const preparedMap = {}
      if (preparedRes.status === 'fulfilled') {
        for (const item of preparedRes.value || []) {
          preparedMap[item.recipe_id] = (preparedMap[item.recipe_id] || 0) + Number(item.servings || 0)
        }
      }

      const nextStockNames = new Set()
      if (stockRes.status === 'fulfilled') {
        for (const item of stockRes.value || []) {
          if (item.name) nextStockNames.add(String(item.name).trim().toLowerCase())
        }
      }

      setActiveMenu(menu)
      setAllRecipes(recipes)
      setAllMembers(members)
      setPreparedByRecipeId(preparedMap)
      setStockNames(nextStockNames)
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const weekItems = useMemo(() => {
    return (activeMenu?.items || [])
      .filter((item) => item.week_number === currentWeek)
      .sort((a, b) => a.position - b.position)
  }, [activeMenu, currentWeek])

  async function addItem(recipeId = null) {
    if (!activeMenu) return
    try {
      const updated = await api.addMenuItem(activeMenu.id, {
        recipe_id: recipeId,
        week_number: currentWeek,
        day_of_week: addItemDay ? Number(addItemDay) : null,
        meal_type: addItemMealType || null,
        member_assignments: buildAssignments(pendingAssignments),
      })
      setActiveMenu(updated)
      setPendingAssignments({})
      setSelectedRecipeId('')
      toast(recipeId ? 'Блюдо добавлено в меню' : 'Блюда добавлены в меню', 'success')
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function toggleCooked(itemId, isCooked) {
    if (!activeMenu) return
    try {
      setActiveMenu(await api.updateMenuItem(activeMenu.id, itemId, { is_cooked: isCooked }))
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function removeItem(itemId) {
    if (!activeMenu) return
    try {
      setActiveMenu(await api.removeMenuItem(activeMenu.id, itemId))
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function confirmClose() {
    if (!activeMenu) return
    if (!window.confirm('Закрыть меню досрочно? Его можно будет просмотреть в истории.')) return
    try {
      await api.closeMenu(activeMenu.id)
      toast('Меню закрыто', 'success')
      await load()
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function openShoppingList() {
    if (!activeMenu) {
      toast('Нет активного меню', 'error')
      return
    }

    try {
      setShoppingModalData(await api.getShoppingList(activeMenu.id))
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function createMenu() {
    if (!createForm.title.trim()) {
      toast('Введите название меню', 'error')
      return
    }
    try {
      await api.createMenu({ title: createForm.title.trim(), weeks: Number(createForm.weeks) })
      setCreateModalOpen(false)
      setCreateForm({ title: '', weeks: 1 })
      setCurrentWeek(1)
      await load()
      toast('Меню создано!', 'success')
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function createAutoMenu() {
    if (!autoForm.title.trim()) {
      toast('Введите название меню', 'error')
      return
    }
    if (!autoForm.use_meal_slots && (Number(autoForm.recipes_per_week) < 1 || Number(autoForm.recipes_per_week) > 21)) {
      toast('Укажите от 1 до 21 блюда в неделю', 'error')
      return
    }

    const payload = {
      use_meal_slots: autoForm.use_meal_slots,
      days: autoForm.days,
      meals: autoForm.meals,
    }
    if (!autoForm.use_meal_slots) payload.recipes_per_week = Number(autoForm.recipes_per_week)

    try {
      let menu
      try {
        menu = await api.createMenu({ title: autoForm.title.trim(), weeks: Number(autoForm.weeks) })
      } catch (createError) {
        const message = String(createError?.message || '')
        const activeExists = message.includes('Уже есть активное меню') || message.toLowerCase().includes('active menu')
        if (!activeExists) throw createError

        const existing = await api.getActiveMenu().catch(() => null)
        if (existing && Array.isArray(existing.items) && existing.items.length === 0) {
          const result = await api.autoFillMenu(existing.id, payload)
          setAutoModalOpen(false)
          setCurrentWeek(1)
          await load()
          const added = result?.added || 0
          toast(
            added > 0 ? `Заполнил текущее активное меню: добавлено ${added} блюд` : 'Текущее активное меню найдено, но блюда не добавлены',
            added > 0 ? 'success' : 'info',
          )
          return
        }

        setAutoModalOpen(false)
        await load()
        toast('Уже есть активное меню. Закройте текущее меню или очистите его перед авто-подбором.', 'error')
        return
      }

      const result = await api.autoFillMenu(menu.id, payload).catch((fillError) => {
        toast(`Меню создано, но авто-подбор не удался: ${fillError.message}`, 'error')
        return { added: 0 }
      })

      setAutoModalOpen(false)
      setCurrentWeek(1)
      await load()
      const added = result?.added || 0
      toast(added > 0 ? `Готово! Добавлено ${added} блюд в меню` : 'Меню создано, блюда не добавлены', added > 0 ? 'success' : 'info')
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function confirmQuickAction(message, action) {
    if (quickActions.skipConfirm) {
      await action()
      return
    }
    setQuickActions((prev) => ({
      ...prev,
      open: true,
      message,
      onConfirm: action,
    }))
  }

  async function makeSameForAll(item) {
    await confirmQuickAction('Назначить одинаковое блюдо всем членам семьи в этом слоте?', async () => {
      let recipeId = item?.recipe_id || item?.recipe?.id
      if (!recipeId && item?.member_assignments?.length) recipeId = item.member_assignments[0].recipe_id
      if (!recipeId) {
        toast('Нет базового блюда для копирования', 'error')
        return
      }
      try {
        setActiveMenu(await api.setItemAssignments(activeMenu.id, item.id, allMembers.map((member) => ({ member_id: member.id, recipe_id: recipeId }))))
        toast('Назначено одинаковое блюдо всем', 'success')
      } catch (error) {
        toast(`Ошибка: ${error.message}`, 'error')
      }
    })
  }

  async function makeDifferentForAll(item) {
    await confirmQuickAction('Подобрать разные блюда для каждого члена семьи в этом слоте? Текущие назначения будут перезаписаны.', async () => {
      if (!allRecipes.length) {
        toast('Нет рецептов для назначения', 'error')
        return
      }
      const used = new Set()
      const assignments = []
      for (const member of allMembers) {
        let chosenId = null
        const preferredIds = Array.isArray(member.preferred_recipe_ids) ? member.preferred_recipe_ids : []
        for (const recipeId of preferredIds) {
          if (!used.has(recipeId) && allRecipes.some((recipe) => recipe.id === recipeId)) {
            chosenId = recipeId
            break
          }
        }
        if (!chosenId) chosenId = allRecipes.find((recipe) => !used.has(recipe.id))?.id || allRecipes[0]?.id
        if (!chosenId) continue
        used.add(chosenId)
        assignments.push({ member_id: member.id, recipe_id: chosenId })
      }
      try {
        setActiveMenu(await api.setItemAssignments(activeMenu.id, item.id, assignments))
        toast('Назначены разные блюда по членам семьи', 'success')
      } catch (error) {
        toast(`Ошибка: ${error.message}`, 'error')
      }
    })
  }

  const usesSlots = isMealSlotMenu(activeMenu)
  const totalItems = activeMenu?.items?.length || 0
  const cookedItems = activeMenu?.items?.filter((item) => item.is_cooked).length || 0
  const progress = totalItems ? Math.round((cookedItems / totalItems) * 100) : 0

  function renderSlotCard(item) {
    const closed = activeMenu?.status === 'closed'
    const body = item.member_assignments?.length ? item.member_assignments.map((assignment) => {
      const member = allMembers.find((value) => value.id === assignment.member_id)
      return (
        <div key={`${item.id}-${assignment.member_id}`} className="slot-member-row">
          <span className="slot-member-dot" style={{ background: member?.color || '#999' }} />
          <span className="slot-member-name">{member?.name || `#${assignment.member_id}`}:</span>
          <span className="slot-recipe-title">{assignment.recipe?.title || '—'}</span>
        </div>
      )
    }) : (
      <>
        <div className="slot-recipe-title">{item.recipe?.title || 'Удалённый рецепт'}</div>
        {item.recipe?.kbju_calculated ? <div className="slot-meta">{item.recipe.calories?.toFixed(0)} ккал</div> : null}
      </>
    )

    return (
      <div key={item.id} className={`slot-card ${item.is_cooked ? 'cooked' : ''}`}>
        <button className={`slot-card-check ${item.is_cooked ? 'checked' : ''}`} onClick={() => toggleCooked(item.id, !item.is_cooked)}>{item.is_cooked ? '✓' : ''}</button>
        <div className="slot-card-body">
          {body}
          {!closed && allMembers.length ? (
            <div className="slot-quick-actions">
              <button className="slot-quick-btn" onClick={() => makeSameForAll(item)}>👥 Одинаковое всем</button>
              <button className="slot-quick-btn" onClick={() => makeDifferentForAll(item)}>🧩 Разные блюда</button>
            </div>
          ) : null}
        </div>
        {!closed ? <button className="slot-remove-btn" onClick={() => removeItem(item.id)}>✕</button> : null}
      </div>
    )
  }

  function renderFlatRow(item) {
    const preparedServings = item.recipe ? preparedByRecipeId[item.recipe.id] || 0 : 0
    const matchedStock = item.recipe?.shopping_list
      ? item.recipe.shopping_list
        .split('\n')
        .map((line) => line.trim().toLowerCase().split(' ')[0])
        .filter(Boolean)
        .filter((token) => stockNames.has(token)).length
      : 0

    return (
      <div key={item.id} className={`menu-item-row ${item.is_cooked ? 'cooked' : ''}`}>
        <button className={`menu-item-check ${item.is_cooked ? 'checked' : ''}`} onClick={() => toggleCooked(item.id, !item.is_cooked)}>{item.is_cooked ? '✓' : ''}</button>
        <div style={{ flex: 1 }}>
          <div className="menu-item-title">{item.recipe ? item.recipe.title : (item.member_assignments?.length ? 'Разные блюда' : 'Удалённый рецепт')}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {item.day_of_week ? <Badge style={{ background: 'var(--c-surface2)', color: 'var(--c-text-muted)' }}>{DAY_LABELS[(item.day_of_week - 1) % 7]}</Badge> : null}
            {item.meal_type ? <Badge style={{ background: 'var(--c-surface2)', color: 'var(--c-text-muted)' }}>{MEAL_LABELS[item.meal_type] || item.meal_type}</Badge> : null}
            {item.recipe ? <span className="menu-item-meta">{cookingMethodLabel(item.recipe.cooking_method)} · {item.recipe.servings} порц.</span> : null}
            {item.recipe?.kbju_calculated ? <span className="menu-item-kbju">{item.recipe.calories?.toFixed(0)} ккал</span> : null}
            {preparedServings > 0 ? <Badge style={{ background: '#eef7ff', color: '#2b5a9a' }}>🍱 Заготовка: {preparedServings} порц.</Badge> : null}
            {matchedStock > 0 ? <Badge style={{ background: '#f0fff8', color: '#1f7d4f' }}>✅ На складе: {matchedStock} поз.</Badge> : null}
            {(item.member_assignments || []).map((assignment) => {
              const member = allMembers.find((value) => value.id === assignment.member_id)
              return (
                <Badge key={`${item.id}-${assignment.member_id}`} style={{ background: `${member?.color || '#999'}20`, color: member?.color || '#999', border: '1px solid currentColor' }}>
                  {member?.name || `#${assignment.member_id}`}: {assignment.recipe?.title || '—'}
                </Badge>
              )
            })}
          </div>
        </div>
        {activeMenu?.status !== 'closed' ? <button className="btn btn-secondary btn-sm" onClick={() => removeItem(item.id)}>✕</button> : null}
      </div>
    )
  }

  function renderItems() {
    if (!weekItems.length) {
      return (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--c-text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🍽️</div>
          <p>Блюда для этой недели ещё не добавлены</p>
        </div>
      )
    }

    if (!usesSlots) {
      return weekItems.map(renderFlatRow)
    }

    const sortedDays = [...new Set(weekItems.filter((item) => item.day_of_week).map((item) => item.day_of_week))].sort((a, b) => a - b)
    const sortedMeals = MEAL_ORDER.filter((meal) => weekItems.some((item) => item.meal_type === meal))
    const grid = {}
    weekItems.forEach((item) => {
      if (!item.day_of_week || !item.meal_type) return
      grid[item.day_of_week] ||= {}
      grid[item.day_of_week][item.meal_type] ||= []
      grid[item.day_of_week][item.meal_type].push(item)
    })

    return (
      <div className="meal-grid">
        <div className="meal-grid-header">
          <div className="meal-grid-corner" />
          {sortedMeals.map((meal) => <div key={meal} className="meal-grid-meal-label">{MEAL_LABELS[meal]}</div>)}
        </div>
        {sortedDays.map((day) => (
          <div key={day} className="meal-grid-row">
            <div className="meal-grid-day-label">{DAY_LABELS[(day - 1) % 7]}</div>
            {sortedMeals.map((meal) => (
              <div key={`${day}-${meal}`} className="meal-grid-cell">
                {(grid[day]?.[meal] || []).length ? (grid[day]?.[meal] || []).map(renderSlotCard) : <div className="meal-grid-empty">—</div>}
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (!active) return <div className="page" />

  return (
    <div className="page active">
      <PageHeader
        title="Активное"
        accent="меню"
        actions={(
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={openShoppingList}>🛒 Список покупок</button>
            <button className="btn btn-secondary" onClick={() => { setAutoForm((prev) => ({ ...prev, title: presetMenuTitle() })); setAutoModalOpen(true) }}>🎲 Авто-подбор</button>
            <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>+ Новое меню</button>
          </div>
        )}
      />

      {loading ? <Spinner /> : null}
      {!loading && !activeMenu ? (
        <EmptyState
          emoji="📅"
          title="Нет активного меню"
          description="Создайте меню вручную или воспользуйтесь авто-подбором"
          actions={
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>+ Создать меню</button>
              <button className="btn btn-secondary" onClick={() => setAutoModalOpen(true)}>🎲 Авто-подбор</button>
            </div>
          }
        />
      ) : null}

      {!loading && activeMenu ? (
        <>
          <div className={`menu-status-banner ${activeMenu.status === 'closed' ? 'closed' : ''}`}>
            <div>
              <h3>
                {activeMenu.title}{' '}
                {activeMenu.status === 'closed' ? <Badge style={{ background: '#e8e8ef', color: '#6B6B80' }}>Закрыто {formatDate(activeMenu.closed_at)}</Badge> : null}
              </h3>
              <p>{activeMenu.weeks} {weeksLabel(activeMenu.weeks)} · {totalItems} слотов · Готово: {cookedItems}/{totalItems}</p>
              <div style={{ width: 200, marginTop: 10 }}><ProgressBar value={progress} /></div>
            </div>
            {activeMenu.status !== 'closed' ? <button className="btn btn-secondary" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', borderColor: 'rgba(255,255,255,0.3)' }} onClick={confirmClose}>Закрыть меню</button> : null}
          </div>

          <div className="weeks-tabs">
            {Array.from({ length: activeMenu.weeks }, (_, index) => index + 1).map((week) => (
              <button key={week} className={`week-tab ${currentWeek === week ? 'active' : ''}`} onClick={() => setCurrentWeek(week)}>Неделя {week}</button>
            ))}
          </div>

          <div className="menu-items-list">{renderItems()}</div>

          {activeMenu.status !== 'closed' ? (
            <div className="add-recipe-panel">
              <h4>➕ Добавить блюдо в меню (неделя {currentWeek})</h4>
              <div className="form-row" style={{ gap: 8, marginBottom: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">День</label>
                  <select className="form-control" value={addItemDay} onChange={(event) => setAddItemDay(event.target.value)}>
                    <option value="">— без дня —</option>
                    {DAY_LABELS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Приём пищи</label>
                  <select className="form-control" value={addItemMealType} onChange={(event) => setAddItemMealType(event.target.value)}>
                    <option value="">— без приёма —</option>
                    <option value="breakfast">🌅 Завтрак</option>
                    <option value="lunch">☀️ Обед</option>
                    <option value="dinner">🌙 Ужин</option>
                  </select>
                </div>
              </div>

              {allMembers.length ? (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-muted)', marginBottom: 6 }}>Назначение по членам семьи (необязательно)</div>
                  {allMembers.map((member) => (
                    <div key={member.id} className="member-assignment-row" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span className="member-dot" style={{ background: member.color, width: 10, height: 10, borderRadius: '50%', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, minWidth: 80 }}>{member.name}</span>
                      <select
                        className="form-control"
                        style={{ flex: 1, fontSize: 13 }}
                        value={pendingAssignments[member.id] || ''}
                        onChange={(event) => setPendingAssignments((prev) => {
                          const next = { ...prev }
                          if (event.target.value) next[member.id] = Number(event.target.value)
                          else delete next[member.id]
                          return next
                        })}
                      >
                        <option value="">— как у всех —</option>
                        {allRecipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.title}</option>)}
                      </select>
                    </div>
                  ))}
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 14 }} onClick={() => addItem(null)}>+ Добавить назначения членам семьи</button>
                  <hr className="divider" style={{ margin: '14px 0' }} />
                </div>
              ) : null}

              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label">Общее блюдо для всей семьи</label>
                <select className="form-control" value={selectedRecipeId} onChange={(event) => setSelectedRecipeId(event.target.value)}>
                  <option value="">— выберите рецепт —</option>
                  {allRecipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.title}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => {
                const recipeId = Number(selectedRecipeId)
                if (!recipeId) {
                  toast('Выберите рецепт из списка', 'error')
                  return
                }
                addItem(recipeId)
              }}>+ Добавить общее блюдо</button>
            </div>
          ) : null}
        </>
      ) : null}

      <Modal
        open={createModalOpen}
        title="Новое меню"
        onClose={() => setCreateModalOpen(false)}
        maxWidth="460px"
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => setCreateModalOpen(false)}>Отмена</button>
            <button className="btn btn-primary" onClick={createMenu}>Создать меню</button>
          </>
        )}
      >
        <div className="form-group">
          <label className="form-label">Название меню</label>
          <input className="form-control" value={createForm.title} onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Количество недель</label>
          <select className="form-control" value={createForm.weeks} onChange={(event) => setCreateForm((prev) => ({ ...prev, weeks: Number(event.target.value) }))}>
            {[1, 2, 3, 4].map((week) => <option key={week} value={week}>{week} {week === 1 ? 'неделя' : 'недели'}</option>)}
          </select>
        </div>
      </Modal>

      <Modal
        open={autoModalOpen}
        title="🎲 Авто-подбор меню"
        onClose={() => setAutoModalOpen(false)}
        maxWidth="520px"
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => setAutoModalOpen(false)}>Отмена</button>
            <button className="btn btn-primary" onClick={createAutoMenu}>🎲 Подобрать меню</button>
          </>
        )}
      >
        <div style={{ background: 'var(--c-surface2)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 20, fontSize: 13, lineHeight: 1.7, borderLeft: '4px solid var(--c-primary)' }}>
          <strong>Как работает авто-подбор:</strong><br />
          🥇 Любимые блюда членов семьи + совпадение со складом<br />
          🥈 Просто любимые блюда · 🥉 Нейтральные рецепты<br />
          🔄 Рецепты прошлого меню — в конце каждой группы
        </div>
        <div className="form-group">
          <label className="form-label">Название меню</label>
          <input className="form-control" value={autoForm.title} onChange={(event) => setAutoForm((prev) => ({ ...prev, title: event.target.value }))} />
        </div>
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Количество недель</label>
            <select className="form-control" value={autoForm.weeks} onChange={(event) => setAutoForm((prev) => ({ ...prev, weeks: Number(event.target.value) }))}>
              {[1, 2, 3, 4].map((week) => <option key={week} value={week}>{week} неделя</option>)}
            </select>
          </div>
          {!autoForm.use_meal_slots ? (
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Блюд в неделю</label>
              <input type="number" min="1" max="21" className="form-control" value={autoForm.recipes_per_week} onChange={(event) => setAutoForm((prev) => ({ ...prev, recipes_per_week: Number(event.target.value) }))} />
            </div>
          ) : null}
        </div>
        <div style={{ border: '1px solid var(--c-border)', borderRadius: 'var(--radius-sm)', padding: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600 }}>
            <input type="checkbox" checked={autoForm.use_meal_slots} onChange={(event) => setAutoForm((prev) => ({ ...prev, use_meal_slots: event.target.checked }))} />
            Режим завтрак / обед / ужин (по дням)
          </label>
          {autoForm.use_meal_slots ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Приёмы пищи:</div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                {MEAL_ORDER.map((meal) => (
                  <label key={meal} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={autoForm.meals.includes(meal)}
                      onChange={(event) => setAutoForm((prev) => ({
                        ...prev,
                        meals: event.target.checked ? [...prev.meals, meal] : prev.meals.filter((value) => value !== meal),
                      }))}
                    />
                    {MEAL_LABELS[meal]}
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Дни недели:</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {DAY_LABELS.map((day, index) => (
                  <label key={day} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={autoForm.days.includes(index + 1)}
                      onChange={(event) => setAutoForm((prev) => ({
                        ...prev,
                        days: event.target.checked ? [...prev.days, index + 1] : prev.days.filter((value) => value !== index + 1),
                      }))}
                    />
                    {day}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal open={Boolean(shoppingModalData)} title="🛒 Список покупок" onClose={() => setShoppingModalData(null)} maxWidth="600px">
        {shoppingModalData ? (
          Object.keys(shoppingModalData.shopping_lists || {}).length ? (
            Object.entries(shoppingModalData.shopping_lists).map(([title, list]) => (
              <div key={title} className="shopping-recipe">
                <h4>{title}</h4>
                <pre>{list}</pre>
              </div>
            ))
          ) : <EmptyState emoji="🎉" title="Всё готово!" description="Все блюда уже приготовлены" />
        ) : null}
      </Modal>

      <ConfirmOverlay
        open={quickActions.open}
        message={quickActions.message}
        allowSkip
        skip={quickActions.skipNext}
        onSkipChange={(value) => setQuickActions((prev) => ({ ...prev, skipNext: value }))}
        onCancel={() => setQuickActions((prev) => ({ ...prev, open: false }))}
        onConfirm={async () => {
          const shouldSkip = quickActions.skipNext
          if (shouldSkip) localStorage.setItem('menu.quickActions.skipConfirm', '1')
          setQuickActions((prev) => ({ ...prev, open: false, skipConfirm: prev.skipConfirm || shouldSkip }))
          await quickActions.onConfirm?.()
        }}
      />
    </div>
  )
}




